"""Carga com porta em +Z, Y vertical; caixas rígidas e homogêneas.
Equilíbrio estático com um único apoio por caixa, sem pontes entre bases.
"""
from copy import copy
from math import isfinite
from time import monotonic
from typing import List, Optional
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field, model_validator
try:
    from .transport import TransportConfig, assess_transport, assess_route
    from .search import column_beam, unpack_columns, repair
    from .storage import router as storage_router
except ImportError:  # uvicorn main:app e entrada da Vercel
    from transport import TransportConfig, assess_transport, assess_route
    from search import column_beam, unpack_columns, repair
    from storage import router as storage_router

app = FastAPI()
app.include_router(storage_router)
app.add_middleware(CORSMiddleware, allow_origins=['*'], allow_credentials=True,
                   allow_methods=['*'], allow_headers=['*'])


class BoxInput(BaseModel):
    id: str
    width: float = Field(gt=0, allow_inf_nan=False)
    height: float = Field(gt=0, allow_inf_nan=False)
    depth: float = Field(gt=0, allow_inf_nan=False)
    color: str
    weight: float = Field(default=10, gt=0, allow_inf_nan=False)
    delivery_order: int = Field(default=1, ge=1)
    max_load: Optional[float] = Field(default=None, ge=0, allow_inf_nan=False)
    allow_rotation: bool = True  # Giro horizontal; altura preservada.


class OptimizeRequest(BaseModel):
    truck_w: float = Field(gt=0, allow_inf_nan=False)
    truck_h: float = Field(gt=0, allow_inf_nan=False)
    truck_d: float = Field(gt=0, allow_inf_nan=False)
    boxes: List[BoxInput]
    transport: TransportConfig = Field(default_factory=TransportConfig)

    @model_validator(mode='after')
    def validate_cargo(self):
        if len({b.id for b in self.boxes}) != len(self.boxes):
            raise ValueError('Cada caixa deve ter um id único.')
        volumes = [self.truck_w * self.truck_h * self.truck_d]
        volumes.extend(b.width * b.height * b.depth for b in self.boxes)
        if any(not isfinite(v) or v <= 0 for v in volumes):
            raise ValueError('Os volumes devem ser finitos e positivos.')
        return self


class Box:
    def __init__(self, data: BoxInput):
        self.id, self.color = data.id, data.color
        self.w, self.h, self.d = data.width, data.height, data.depth
        self.weight, self.delivery_order = data.weight, data.delivery_order
        self.max_load, self.allow_rotation = data.max_load, data.allow_rotation
        self.vol = self.w * self.h * self.d
        self.x = self.y = self.z = 0.0

    def output(self):
        return dict(id=self.id, color=self.color, width=self.w, height=self.h,
                    depth=self.d, x=self.x, y=self.y, z=self.z,
                    weight=self.weight, delivery_order=self.delivery_order,
                    max_load=self.max_load, allow_rotation=self.allow_rotation)


class TruckBin:
    def __init__(self, w, h, d, transport=None):
        self.w, self.h, self.d = w, h, d
        self.placed_boxes: List[Box] = []
        self.eps = 1e-8 * min(w, h, d)
        self.search_truncated = False
        self.transport = transport or TransportConfig()
        self.min_support_ratio = 1.0

    def overlap(self, a, b, axis, size):
        return min(getattr(a, axis) + getattr(a, size),
                   getattr(b, axis) + getattr(b, size)) - max(
                       getattr(a, axis), getattr(b, axis)) > self.eps

    def support(self, box, boxes):
        if box.y <= self.eps:
            return None
        contacts = [b for b in boxes if b is not box
                    and abs(b.y + b.h - box.y) <= self.eps
                    and self.overlap(box, b, 'x', 'w')
                    and self.overlap(box, b, 'z', 'd')]
        return contacts[0] if len(contacts) == 1 else False

    def check_physics(self, boxes):
        # Soma pesos e momentos de toda a subpilha, de cima para baixo.
        loads = {b.id: [b.weight, b.weight * (b.x + b.w / 2),
                        b.weight * (b.z + b.d / 2)] for b in boxes}
        for b in sorted(boxes, key=lambda item: item.y, reverse=True):
            mass, mx, mz = loads[b.id]
            if b.max_load is not None and mass - b.weight > b.max_load + 1e-9:
                return False
            base = self.support(b, boxes)
            if base is False:
                return False
            if base is None:
                left, right, back, front = b.x, b.x + b.w, b.z, b.z + b.d
            else:
                if b.weight > base.weight or b.delivery_order > base.delivery_order:
                    return False
                left, right = max(b.x, base.x), min(b.x + b.w, base.x + base.w)
                back, front = max(b.z, base.z), min(b.z + b.d, base.z + base.d)
                if (right - left) * (front - back) < (self.min_support_ratio - 1e-9) * b.w * b.d:
                    return False
            # Centro de massa estritamente dentro do contato: evita tombamento.
            if not (left + self.eps < mx / mass < right - self.eps
                    and back + self.eps < mz / mass < front - self.eps):
                return False
            if base is not None:
                for i, value in enumerate((mass, mx, mz)):
                    loads[base.id][i] += value
        return True

    def validate_layout(self):
        boxes = self.placed_boxes
        if len({b.id for b in boxes}) != len(boxes):
            return False
        for i, b in enumerate(boxes):
            if (not all(isfinite(v) for v in (b.x, b.y, b.z, b.w, b.h, b.d))
                    or min(b.x, b.y, b.z) < -self.eps
                    or b.x + b.w > self.w + self.eps
                    or b.y + b.h > self.h + self.eps
                    or b.z + b.d > self.d + self.eps):
                return False
            for other in boxes[i + 1:]:
                if all(self.overlap(b, other, axis, size)
                       for axis, size in [('x', 'w'), ('y', 'h'), ('z', 'd')]):
                    return False
        return self.check_physics(boxes) and self.unloading_sequence(boxes) is not None

    def unloading_sequence(self, boxes):
        # Retirada reta em +Z. A base só sai após as caixas apoiadas nela.
        blockers = {b.id: set() for b in boxes}
        by_id = {b.id: b for b in boxes}
        has_overhang = False
        for b in boxes:
            base = self.support(b, boxes)
            if base is not None and base is not False:
                blockers[base.id].add(b.id)
                has_overhang |= (b.x < base.x or b.x + b.w > base.x + base.w
                                 or b.z < base.z or b.z + b.d > base.z + base.d)
            for other in boxes:
                if (other is not b and other.z >= b.z + b.d - self.eps
                        and self.overlap(b, other, 'x', 'w')
                        and self.overlap(b, other, 'y', 'h')):
                    blockers[b.id].add(other.id)
        sequence = []
        while blockers:
            order = min(by_id[key].delivery_order for key in blockers)
            available = [key for key, dependencies in blockers.items()
                         if not dependencies and by_id[key].delivery_order == order]
            if not available:
                return None
            available.sort(key=lambda k: (-by_id[k].y, -by_id[k].z, k))
            # Com bases integralmente contidas, retirar folhas preserva equilíbrio.
            # Com balanços, uma folha pode ser um contrapeso necessário.
            key = next((k for k in available if not has_overhang or self.check_physics(
                [by_id[other] for other in blockers if other != k])), None)
            if key is None:
                return None
            sequence.append(key)
            del blockers[key]
            for dependencies in blockers.values():
                dependencies.discard(key)
        return sequence

    def can_place(self, box, cx, cy, cz):
        candidate = copy(box)
        candidate.x, candidate.y, candidate.z = cx, cy, cz
        if (min(cx, cy, cz) < -self.eps or cx + box.w > self.w + self.eps
                or cy + box.h > self.h + self.eps or cz + box.d > self.d + self.eps):
            return False
        for b in self.placed_boxes:
            if (self.overlap(candidate, b, 'x', 'w')
                    and self.overlap(candidate, b, 'y', 'h')):
                if self.overlap(candidate, b, 'z', 'd'):
                    return False
                front, rear = (candidate, b) if cz > b.z else (b, candidate)
                if front.delivery_order > rear.delivery_order:
                    return False
        boxes = self.placed_boxes + [candidate]
        return self.check_physics(boxes) and self.unloading_sequence(boxes) is not None

    def positions(self, box):
        # Alinha ambas as bordas, sem deslizar uma caixa para fora do apoio.
        zones = {(0.0, 0.0, 0.0), (self.w - box.w, 0.0, 0.0)}
        for b in self.placed_boxes:
            xs = (b.x, b.x + b.w - box.w)
            zs = (b.z, b.z + b.d - box.d)
            for x in xs:
                for z in zs:
                    zones.add((x, b.y + b.h, z))
            for x in (0.0, *xs):
                zones.add((x, 0.0, b.z + b.d))
                zones.add((x, b.y, b.z + b.d))
            for z in (0.0, *zs):
                zones.add((b.x + b.w, 0.0, z))
                zones.add((b.x + b.w, b.y, z))
        return sorted(zones, key=lambda p: (p[2], p[1], p[0]))

    def pack(self, boxes, deadline=None, floor_first=False):
        remaining = list(boxes)
        while remaining:
            deferred, progress = [], False
            for original in remaining:
                best = None
                orientations = [(original.w, original.d)]
                if original.allow_rotation and original.w != original.d:
                    orientations.append((original.d, original.w))
                for w, d in orientations:
                    box = copy(original)
                    box.w, box.d = w, d
                    for x, y, z in self.positions(box):
                        if deadline is not None and monotonic() >= deadline:
                            self.search_truncated = True
                            return
                        score = (y, z, x, w) if floor_first else (z, y, x, w)
                        if best is not None and score >= best[0]:
                            continue
                        if self.can_place(box, x, y, z):
                            box.x, box.y, box.z = x, y, z
                            best = score, copy(box)
                if best is None:
                    deferred.append(original)
                else:
                    self.placed_boxes.append(best[1])
                    progress = True
            if not progress:
                break
            remaining = deferred


def solve(req, time_limit=8.0):
    boxes = [Box(b) for b in req.boxes]
    keys = [lambda b: (-b.delivery_order, -b.weight, -b.vol, b.id),
            lambda b: (b.vol, -b.weight, -b.delivery_order, b.id),
            lambda b: (-b.weight, -b.delivery_order, b.vol, b.id),
            lambda b: (-b.delivery_order, b.vol, -b.weight, b.id)]
    best = TruckBin(req.truck_w, req.truck_h, req.truck_d, req.transport)
    started = monotonic()
    deadline = started + time_limit
    greedy_deadline = started + time_limit * 0.40
    truncated = False

    def quality(truck):
        report = assess_transport(truck, truck.placed_boxes)
        tipping_cases = sum(case["tipping"] for issue in report["issues"] for case in issue["cases"])
        return (len(truck.placed_boxes), round(sum(b.vol for b in truck.placed_boxes), 8),
                -tipping_cases, -sum(b.weight * (b.y + b.h / 2) for b in truck.placed_boxes))

    for index, key in enumerate(keys):
        truck = TruckBin(req.truck_w, req.truck_h, req.truck_d, req.transport)
        attempt_deadline = monotonic() + max(0, greedy_deadline - monotonic()) / (len(keys) - index)
        truck.pack(sorted(boxes, key=key), attempt_deadline, floor_first=index == 2)
        truncated |= truck.search_truncated
        if quality(truck) > quality(best):
            best = truck
    layouts = []
    column_deadline = started + time_limit * 0.82
    # Altura da pilha é uma escolha da busca, não a altura obrigatória do baú.
    for fraction in (0.6, 0.8, 1.0):
        layouts.extend(column_beam(boxes, best,
            min(column_deadline, monotonic() + max(0, column_deadline - monotonic()) /
                (3 if fraction == 0.6 else 2 if fraction == 0.8 else 1)),
            height_limit=req.truck_h * fraction))
    for layout in layouts:
        trial = unpack_columns(layout, best)
        if trial.validate_layout():
            if quality(trial) > quality(best):
                best = trial
    best, repair_attempts = repair(best, boxes, deadline, quality)
    if not best.validate_layout():
        raise RuntimeError('A busca produziu uma disposição inválida.')
    best.search_truncated = truncated or monotonic() >= deadline
    best.search_details = dict(column_alternatives=len(layouts), repair_attempts=repair_attempts)
    return best


@app.get('/api')
def health_check():
    return {'status': 'online'}


@app.post('/api/optimize')
def optimize_load(req: OptimizeRequest):
    truck = solve(req)
    packed_ids = {b.id for b in truck.placed_boxes}
    volume = sum(b.vol for b in truck.placed_boxes)
    return {
        'packed_boxes': [b.output() for b in truck.placed_boxes],
        'max_volume': volume,  # Campo legado: volume encontrado, não ótimo provado.
        'packed_count': len(packed_ids),
        'unpacked_boxes': [dict(b.model_dump(), reason='not_placed_by_heuristic')
                           for b in req.boxes if b.id not in packed_ids],
        'volume_utilization': volume / (req.truck_w * req.truck_h * req.truck_d),
        'unloading_order': truck.unloading_sequence(truck.placed_boxes),
        'search_truncated': truck.search_truncated,
        'optimality_proven': False,
        'static_stability': {'validated': True, 'minimum_base_support': 1.0},
        'search_details': truck.search_details,
        'transport_assessment': assess_route(truck, truck.placed_boxes),
    }
