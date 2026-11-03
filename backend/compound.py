"""Packing rigid assemblies. Empty space stays empty in collision/unloading tests.

Conservative support: all lowest feet rest on the floor or on one rigid object.
Uniform material density, horizontal rotations only, straight withdrawal in +Z.
"""
from copy import copy
from itertools import product
from time import monotonic
from math import pi, cos, sin
try:
    from .shapes import polygon_points
except ImportError:
    from shapes import polygon_points


class RigidBox:
    def __init__(self, data):
        self.data = data
        self.id, self.color = data.id, data.color
        self.w, self.h, self.d = data.width, data.height, data.depth
        self.weight, self.delivery_order = data.weight, data.delivery_order
        self.max_load = (0 if data.parts else None) if data.max_load is None else data.max_load
        self.allow_rotation = data.allow_rotation
        self.parts = tuple((p.x, p.y, p.z, p.width, p.height, p.depth) for p in data.parts) if data.parts else ((0, 0, 0, self.w, self.h, self.d),)
        self.metadata = tuple((p.kind, p.sides, p.yaw) for p in data.parts) if data.parts else (('box', 6, 0),)
        self.curved = any(m[0] != 'box' for m in self.metadata)
        self.round_bottom = any(m[0] == 'ellipsoid' and p[1] == 0 for p,m in zip(self.parts,self.metadata))
        # Flat cylinder/prism bottoms may rest on verified supports. Round
        # bottoms stay on the floor; curved assemblies cannot support cargo yet.
        if self.curved:
            self.max_load = 0
        self.vol = sum(self.part_mass(p, m)[0] for p, m in zip(self.parts, self.metadata))
        masses = [self.part_mass(p,m) for p,m in zip(self.parts,self.metadata)]
        self.local_center = tuple(sum(center[i]*mass for mass,center in masses)/self.vol for i in range(3))
        self.x = self.y = self.z = 0.

    def rotated(self):
        result = copy(self)
        result.w, result.d = self.d, self.w
        result.parts = tuple((max(0., self.d-z-d), y, x, d, h, w) for x, y, z, w, h, d in self.parts)
        result.metadata = tuple((kind, sides, (yaw+1)%4) for kind, sides, yaw in self.metadata)
        result.local_center = (self.d-self.local_center[2], self.local_center[1], self.local_center[0])
        return result

    @staticmethod
    def part_mass(p, metadata):
        kind, sides, yaw = metadata
        factor, cx, cz = 1., .5, .5
        if kind == 'ellipsoid':
            factor = pi/6
        elif kind == 'cylinder':
            factor = pi/4
        elif kind == 'prism':
            pts = polygon_points(sides, yaw)
            factor = abs(sum(a[0]*b[1]-b[0]*a[1] for a,b in zip(pts,pts[1:]+pts[:1])))/2
            cx, cz = sum(a[0] for a in pts)/sides, sum(a[1] for a in pts)/sides
        return p[3]*p[4]*p[5]*factor, (p[0]+p[3]*cx, p[1]+p[4]/2, p[2]+p[5]*cz)

    def solids(self):
        key = (self.x, self.y, self.z, self.parts)
        if getattr(self, '_solids_key', None) != key:
            self._solids_key = key
            self._solids = [(self.x+x, self.y+y, self.z+z, w, h, d) for x, y, z, w, h, d in self.parts]
        return self._solids

    def center(self):
        return tuple(offset + self.local_center[i]
                     for i, offset in enumerate((self.x, self.y, self.z)))

    def output(self):
        result = self.data.model_dump()
        result.update(width=self.w, height=self.h, depth=self.d, x=self.x, y=self.y, z=self.z, max_load=self.max_load)
        if self.data.parts:
            result['parts'] = [dict(zip(('x', 'y', 'z', 'width', 'height', 'depth'), p), kind=m[0], sides=m[1], yaw=m[2]) for p,m in zip(self.parts,self.metadata)]
        return result


def overlap(a, b, i, eps):
    return min(a[i]+a[i+3], b[i]+b[i+3])-max(a[i], b[i]) > eps


def collides(a, b, eps):
    if not all(overlap((a.x,a.y,a.z,a.w,a.h,a.d),(b.x,b.y,b.z,b.w,b.h,b.d),i,eps) for i in range(3)):
        return False
    return any(all(overlap(p, q, i, eps) for i in range(3)) for p in a.solids() for q in b.solids())


def blocks_exit(a, b, eps):
    if not (overlap((a.x,a.y,a.z,a.w,a.h,a.d),(b.x,b.y,b.z,b.w,b.h,b.d),0,eps)
            and overlap((a.x,a.y,a.z,a.w,a.h,a.d),(b.x,b.y,b.z,b.w,b.h,b.d),1,eps)
            and b.z+b.d > a.z+eps):
        return False
    # Swept volume of every component, not just objects entirely ahead.
    return any(overlap(p, q, 0, eps) and overlap(p, q, 1, eps)
               and q[2]+q[5] > p[2]+eps for p in a.solids() for q in b.solids())


def hull(points):
    points = sorted(set(points))
    def cross(o, a, b):
        return (a[0]-o[0])*(b[1]-o[1])-(a[1]-o[1])*(b[0]-o[0])
    lower, upper = [], []
    for chain, values in ((lower, points), (upper, reversed(points))):
        for p in values:
            while len(chain) >= 2 and cross(chain[-2], chain[-1], p) <= 0:
                chain.pop()
            chain.append(p)
    return lower[:-1]+upper[:-1]


def inside(points, x, z, eps):
    polygon = hull(points)
    return len(polygon) >= 3 and all((b[0]-a[0])*(z-a[1])-(b[1]-a[1])*(x-a[0])
        > eps*((b[0]-a[0])**2+(b[1]-a[1])**2)**.5
        for a, b in zip(polygon, polygon[1:]+polygon[:1]))


class CompoundTruck:
    def __init__(self, w, h, d):
        self.w, self.h, self.d = w, h, d
        self.eps = min(w, h, d)*1e-8
        self.placed_boxes = []
        self.search_truncated = False

    def contact(self, box, boxes):
        foot_pairs = [(p,m) for p,m in zip(box.solids(),box.metadata) if abs(p[1]-box.y) <= self.eps]
        feet = [p for p,m in foot_pairs]
        corners = []
        for p,(kind,sides,yaw) in foot_pairs:
            points = (polygon_points(sides,yaw) if kind == 'prism' else
                      [(.5+.5*cos(i*pi/16),.5+.5*sin(i*pi/16)) for i in range(32)] if kind == 'cylinder' else
                      [(x,z) for x in (0,1) for z in (0,1)])
            corners.extend((p[0]+x*p[3],p[2]+z*p[5]) for x,z in points)
        if box.y <= self.eps:
            return None, corners
        for base in boxes:
            if base is box or base.y >= box.y-self.eps:
                continue
            tops = [p for p in base.solids() if abs(p[1]+p[4]-box.y) <= self.eps]
            if all(sum(max(0, min(p[0]+p[3], q[0]+q[3])-max(p[0], q[0])) *
                           max(0, min(p[2]+p[5], q[2]+q[5])-max(p[2], q[2])) for q in tops)
                   >= p[3]*p[5]*(1-1e-9) for p in feet):
                return base, corners
        return False, corners

    def check_physics(self, boxes):
        loads = {b.id: [b.weight, b.weight*b.center()[0], b.weight*b.center()[2]] for b in boxes}
        for b in sorted(boxes, key=lambda b: b.y, reverse=True):
            mass, mx, mz = loads[b.id]
            if b.max_load is not None and mass-b.weight > b.max_load+1e-9:
                return False
            base, corners = self.contact(b, boxes)
            if base is False or not inside(corners, mx/mass, mz/mass, self.eps):
                return False
            if base is not None:
                if b.weight > base.weight or b.delivery_order > base.delivery_order:
                    return False
                for i, v in enumerate((mass, mx, mz)):
                    loads[base.id][i] += v
        return True

    def unloading_sequence(self, boxes):
        blockers = {b.id: set() for b in boxes}
        by_id = {b.id: b for b in boxes}
        for b in boxes:
            base, _ = self.contact(b, boxes)
            if base is False:
                return None
            if base is not None:
                blockers[base.id].add(b.id)
            for other in boxes:
                if other is not b and blocks_exit(b, other, self.eps):
                    blockers[b.id].add(other.id)
        sequence = []
        while blockers:
            priority = min(by_id[k].delivery_order for k in blockers)
            available = sorted(k for k, deps in blockers.items() if not deps and by_id[k].delivery_order == priority)
            key = next((k for k in available if self.check_physics([by_id[j] for j in blockers if j != k])), None)
            if key is None:
                return None
            sequence.append(key)
            del blockers[key]
            for deps in blockers.values():
                deps.discard(key)
        return sequence

    def in_bounds(self, b):
        return (not b.round_bottom or b.y <= self.eps) and min(b.x, b.y, b.z) >= -self.eps and all(
            a+s <= limit+self.eps for a, s, limit in ((b.x, b.w, self.w), (b.y, b.h, self.h), (b.z, b.d, self.d)))

    def validate_layout(self):
        boxes = self.placed_boxes
        return (len({b.id for b in boxes}) == len(boxes) and all(self.in_bounds(b) for b in boxes)
                and not any(collides(a, b, self.eps) for i, a in enumerate(boxes) for b in boxes[:i])
                and self.check_physics(boxes) and self.unloading_sequence(boxes) is not None)

    def can_place(self, box, x, y, z):
        b = copy(box)
        b.x, b.y, b.z = x, y, z
        if not self.in_bounds(b) or any(collides(b, other, self.eps) for other in self.placed_boxes):
            return False
        boxes = self.placed_boxes+[b]
        return self.check_physics(boxes) and self.unloading_sequence(boxes) is not None

    def positions(self, box, deadline):
        # Align component faces: candidates include the void under a tabletop.
        xs, ys, zs = {0., self.w-box.w}, {0.}, {0., self.d-box.d}
        for b in self.placed_boxes:
            for q in b.solids():
                ys.add(q[1]+q[4])
                for p in box.parts:
                    for i, values in ((0, xs), (2, zs)):
                        values.update((q[i]-p[i], q[i]+q[i+3]-p[i],
                                       q[i]-p[i]-p[i+3], q[i]+q[i+3]-p[i]-p[i+3]))
        xs = sorted(x for x in xs if -self.eps <= x <= self.w-box.w+self.eps)
        ys = sorted(y for y in ys if -self.eps <= y <= self.h-box.h+self.eps)
        zs = sorted(z for z in zs if -self.eps <= z <= self.d-box.d+self.eps)
        for y, z, x in product(ys, zs, xs):
            if monotonic() >= deadline:
                return
            yield max(0., x), max(0., y), max(0., z)


def load_quality(truck):
    # Transport occupied volume first; count breaks ties without discarding bulky cargo.
    return (round(sum(b.vol for b in truck.placed_boxes), 9), len(truck.placed_boxes),
            -sum(b.weight*b.center()[1] for b in truck.placed_boxes))


def insert_remaining(truck, remaining, deadline):
    while remaining and monotonic() < deadline:
        deferred = []
        for original in remaining:
            orientations, b = [], original
            for _ in range(4 if original.allow_rotation else 1):
                if b.parts not in [o.parts for o in orientations]:
                    orientations.append(b)
                b = b.rotated()
            chosen = None
            for b in orientations:
                for x, y, z in truck.positions(b, deadline):
                    if truck.can_place(b, x, y, z):
                        candidate = copy(b)
                        candidate.x, candidate.y, candidate.z = x, y, z
                        if chosen is None or (y, z, x) < (chosen.y, chosen.z, chosen.x):
                            chosen = candidate
                        break
            if chosen is not None:
                truck.placed_boxes.append(chosen)
            else:
                deferred.append(original)
        if len(deferred) == len(remaining):
            break
        remaining = deferred


def solve_compound(req, time_limit):
    boxes = [RigidBox(b) for b in req.boxes]
    best = CompoundTruck(req.truck_w, req.truck_h, req.truck_d)
    start = monotonic()
    deadline = start + time_limit
    search_deadline = start + time_limit * .75
    keys = [lambda b: (-b.delivery_order, -int(b.round_bottom), -b.w*b.h*b.d, -b.weight, b.id),
            lambda b: (-b.vol, -b.weight, b.id),
            lambda b: (-b.weight, -b.delivery_order, b.id),
            lambda b: (b.vol, -b.delivery_order, b.id)]
    attempts = 0
    for i, key in enumerate(keys):
        if monotonic() >= search_deadline:
            break
        truck = CompoundTruck(req.truck_w, req.truck_h, req.truck_d)
        attempt_deadline = monotonic()+max(0, search_deadline-monotonic())/(len(keys)-i)
        insert_remaining(truck, sorted(boxes, key=key), attempt_deadline)
        if load_quality(truck) > load_quality(best):
            best = truck
        attempts += 1
        if len(best.placed_boxes) == len(boxes):
            break
    # Reserve time for the winning layout instead of spending it all on discarded starts.
    loaded = {b.id for b in best.placed_boxes}
    insert_remaining(best, sorted((b for b in boxes if b.id not in loaded),
                                  key=lambda b: (-b.vol, b.id)), deadline)
    if not best.validate_layout():
        raise RuntimeError('Disposição composta inválida.')
    best.search_truncated = monotonic() >= deadline
    best.search_details = dict(engine='rigid_parts', attempts=attempts, objective='volume_then_count')
    return best
