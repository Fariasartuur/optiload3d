"""Packing rigid assemblies. Empty space stays empty in collision/unloading tests.

Conservative support: all lowest feet rest on the floor or on one rigid object.
Uniform material density, horizontal rotations only, straight withdrawal in +Z.
"""
from copy import copy
from itertools import product
from time import monotonic
from math import pi, cos, sin
from random import Random
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
        self.contains_bag = data.shape == 'bag' or any(m[0] == 'bag' for m in self.metadata)
        self.curved = any(m[0] != 'box' for m in self.metadata)
        self.round_bottom = any(m[0] == 'ellipsoid' and p[1] == 0 for p,m in zip(self.parts,self.metadata))
        # Resistance of curved top surfaces is unspecified.
        if self.curved or self.contains_bag:
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
        if kind in ('ellipsoid','bag'):
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
            if kind == 'bag':
                # The tied-bag template has a flattened bottom. Use a smaller
                # contact patch inside the rendered base; keep the full clearance envelope.
                corners.extend((p[0]+p[3]*(.5+.20*cos(i*pi/8)),
                                p[2]+p[5]*(.5+.20*sin(i*pi/8))) for i in range(16))
                continue
            points = (polygon_points(sides,yaw) if kind == 'prism' else
                      [(.5+.5*cos(i*pi/16),.5+.5*sin(i*pi/16)) for i in range(32)] if kind == 'cylinder' else
                      [(.5,.5)] if kind == 'ellipsoid' and box.y > self.eps else
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

    def opposed_stops(self, box, boxes, axis):
        """Opposing rigid faces tangent to the ellipsoid at equator height."""
        x, y, z, w, h, d = box.solids()[0]
        low, high, limit = (x, x+w, self.w) if axis == 0 else (z, z+d, self.d)
        cross_axis = 2 if axis == 0 else 0
        cross_center = z+d/2 if axis == 0 else x+w/2
        equator = y+h/2
        # The cargo compartment is closed during transport.
        negative, positive = low <= self.eps, high >= limit-self.eps
        for other in boxes:
            if other is box:
                continue
            for face, metadata in zip(other.solids(), other.metadata):
                if metadata[0] != 'box':
                    continue
                if not (face[1]+self.eps < equator < face[1]+face[4]-self.eps
                        and face[cross_axis]+self.eps < cross_center
                        < face[cross_axis]+face[cross_axis+3]-self.eps):
                    continue
                negative |= abs(face[axis]+face[axis+3]-low) <= self.eps
                positive |= abs(face[axis]-high) <= self.eps
        return negative and positive

    def stable_contact(self, box, boxes, points, cx, cz):
        if inside(points, cx, cz, self.eps):
            return True
        # A lone ellipsoid touches a horizontal plane at a point. With uniform
        # density, tipping through angle t raises its centre when the horizontal
        # semiaxis is longer: height(t)^2 = b^2*cos(t)^2 + a^2*sin(t)^2.
        if len(box.parts) != 1 or not box.round_bottom or len(points) != 1:
            return False
        px,pz = points[0]
        if abs(cx-px)>self.eps or abs(cz-pz)>self.eps:
            return False
        for axis, diameter in ((0,box.w),(2,box.d)):
            if diameter <= box.h+self.eps and not self.opposed_stops(box, boxes, axis):
                return False
        return True

    def check_physics(self, boxes):
        # A bag needs overhead clearance even beneath a separately supported shelf.
        for bag in boxes:
            if bag.contains_bag:
                for other in boxes:
                    if other is bag:
                        continue
                    for part, meta in zip(bag.solids(), bag.metadata):
                        if meta[0] != 'bag' and bag.data.shape != 'bag':
                            continue
                        if any(q[1] >= part[1]+part[4]-self.eps and
                               overlap(part,q,0,self.eps) and overlap(part,q,2,self.eps)
                               for q in other.solids()):
                            return False
        loads = {b.id: [b.weight, b.weight*b.center()[0], b.weight*b.center()[2]] for b in boxes}
        for b in sorted(boxes, key=lambda b: b.y, reverse=True):
            mass, mx, mz = loads[b.id]
            if b.max_load is not None and mass-b.weight > b.max_load+1e-9:
                return False
            base, corners = self.contact(b, boxes)
            if base is False or not self.stable_contact(b, boxes, corners, mx/mass, mz/mass):
                return False
            if base is not None:
                if b.delivery_order > base.delivery_order:
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
        return min(b.x, b.y, b.z) >= -self.eps and all(
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

    def positions(self, box, deadline, policy="floor"):
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
        if policy == 'tops':
            # Try corners and centres of supporting faces before the full grid.
            for base in self.placed_boxes:
                if base.max_load is not None and base.max_load < box.weight:
                    continue
                for bx,by,bz,bw,bh,bd in base.solids():
                    if bw+self.eps < box.w or bd+self.eps < box.d:
                        continue
                    for x in (bx,bx+bw-box.w,bx+(bw-box.w)/2):
                        for z in (bz,bz+bd-box.d,bz+(bd-box.d)/2):
                            if monotonic() >= deadline:
                                return
                            yield x,by+bh,z
        coordinates = product(ys, zs, xs) if policy in ('floor','tops') else ((y,z,x) for z,y,x in product(zs,ys,xs))
        for y, z, x in coordinates:
            if monotonic() >= deadline:
                return
            yield max(0., x), max(0., y), max(0., z)


def load_quality(truck):
    boxes = truck.placed_boxes
    mass = sum(b.weight for b in boxes) or 1
    # Hard constraints are checked separately. These are tie-breakers, not licenses
    # to overload a support or block a delivery in exchange for extra volume.
    return (round(sum(b.vol for b in boxes), 9), len(boxes),
            -round(sum(b.weight*b.center()[1] for b in boxes)/mass, 9),
            -round(abs(sum(b.weight*b.center()[0] for b in boxes)/mass-truck.w/2), 9),
            -round(sum((truck.d-b.z-b.d)/b.delivery_order for b in boxes), 9))


def placements(truck, original, deadline, policy='floor', alternatives=1):
    orientations, box, seen = [], original, set()
    for _ in range(4 if original.allow_rotation else 1):
        signature=(box.parts,tuple((k,n,y if k=='prism' else 0) for k,n,y in box.metadata))
        if signature not in seen:
            seen.add(signature)
            orientations.append(box)
        box = box.rotated()
    choices = []
    for box in orientations:
        found = 0
        for x,y,z in truck.positions(box, deadline, policy):
            if truck.can_place(box,x,y,z):
                candidate = copy(box)
                candidate.x,candidate.y,candidate.z = x,y,z
                choices.append(candidate)
                found += 1
                if found >= alternatives:
                    break
    return sorted(choices,key=lambda b:(b.y,b.z,b.x) if policy=='floor' else (b.z,b.y,b.x))


def insert_remaining(truck, remaining, deadline, policy='floor'):
    while remaining and monotonic() < deadline:
        deferred = []
        for original in remaining:
            choices = placements(truck,original,deadline,policy)
            if choices:
                truck.placed_boxes.append(choices[0])
            else:
                deferred.append(original)
        if len(deferred) == len(remaining):
            break
        remaining = deferred


def repair_compound(best, originals, deadline, max_attempts=16):
    rng, attempts = Random(417), 0
    while attempts < max_attempts and monotonic() < deadline:
        roots = {}
        for box in sorted(best.placed_boxes,key=lambda b:b.y):
            base,_ = best.contact(box,best.placed_boxes)
            roots[box.id] = box.id if base is None else roots[base.id]
        root_ids = sorted(set(roots.values()))
        if not root_ids:
            break
        # Remove entire support trees, never leave their children floating.
        selected = {root_ids[attempts % len(root_ids)]} if attempts < len(root_ids) else set(
            rng.sample(root_ids,max(1,len(root_ids)//3)))
        trial = CompoundTruck(best.w,best.h,best.d)
        trial.placed_boxes = [copy(b) for b in best.placed_boxes if roots[b.id] not in selected]
        attempts += 1
        if not trial.validate_layout():
            continue
        kept = {b.id for b in trial.placed_boxes}
        missing = {b.id for b in originals} - {b.id for b in best.placed_boxes}
        pending = [b for b in originals if b.id not in kept]
        rng.shuffle(pending)
        pending.sort(key=lambda b:(-b.delivery_order, -(b.id in missing), -b.weight, -b.vol))
        insert_remaining(trial,pending,min(deadline,monotonic()+.35),
                         'compact' if attempts%2 else 'floor')
        if load_quality(trial)>load_quality(best) and trial.validate_layout():
            best=trial
    return best,attempts


def beam_compound(prototype, boxes, deadline, width=8):
    beam=[CompoundTruck(prototype.w,prototype.h,prototype.d)]
    best=prototype
    for box in sorted(boxes,key=lambda b:(-b.delivery_order,-b.weight,-b.vol,b.id)):
        expanded=[]
        for truck in beam:
            expanded.append(truck)
            for candidate in placements(truck,box,deadline,'compact',alternatives=3):
                trial=CompoundTruck(truck.w,truck.h,truck.d)
                trial.placed_boxes=truck.placed_boxes+[candidate]
                expanded.append(trial)
                if load_quality(trial)>load_quality(best):
                    best=trial
            if monotonic()>=deadline:
                return best
        seen,beam=set(),[]
        for truck in sorted(expanded,key=load_quality,reverse=True):
            signature=tuple(sorted((b.id,round(b.x,8),round(b.y,8),round(b.z,8),b.parts) for b in truck.placed_boxes))
            if signature not in seen:
                seen.add(signature);beam.append(truck)
            if len(beam)>=width:
                break
    return best


def stacked_rows(prototype, boxes, deadline, separate_platforms=()):
    """Try building same-footprint carton stacks before allocating floor space."""
    stacks = []
    for box in sorted(boxes, key=lambda b: (-b.delivery_order, -b.weight, b.id)):
        if monotonic() >= deadline:
            return None
        placed = copy(box)
        if len(box.parts) == 1 and not box.curved and box.id not in separate_platforms:
            for stack in stacks:
                base = stack[-1]
                if (len(base.parts) != 1 or base.curved or base.id in separate_platforms
                        or base.w != box.w or base.d != box.d
                        or base.delivery_order != box.delivery_order):
                    continue
                placed.y = base.y + base.h
                if placed.y + placed.h <= prototype.h + prototype.eps and prototype.check_physics(stack + [placed]):
                    stack.append(placed)
                    break
            else:
                placed.y = 0
                stacks.append([placed])
        else:
            stacks.append([placed])

    trial = CompoundTruck(prototype.w, prototype.h, prototype.d)
    x = z = row_depth = 0
    for stack in sorted(stacks, key=lambda s: (-s[0].delivery_order, -s[0].d, -s[0].w)):
        if monotonic() >= deadline:
            return None
        base = stack[0]
        if x + base.w > trial.w + trial.eps:
            x, z, row_depth = 0, z + row_depth, 0
        if base.w > trial.w + trial.eps or z + base.d > trial.d + trial.eps:
            continue
        for item in stack:
            item.x, item.z = x, z
        trial.placed_boxes.extend(stack)
        x += base.w
        row_depth = max(row_depth, base.d)
    return trial if trial.validate_layout() else None


def solve_compound(req, time_limit):
    boxes = [RigidBox(b) for b in req.boxes]
    best = CompoundTruck(req.truck_w, req.truck_h, req.truck_d)
    start = monotonic()
    deadline = start + time_limit
    seed = stacked_rows(best, boxes, start + time_limit * .10)
    if seed is not None:
        best = seed
    if boxes and len(best.placed_boxes) < len(boxes):
        first_stop = min(b.delivery_order for b in boxes)
        platforms = [b for b in boxes if b.max_load != 0 or b.delivery_order > first_stop]
        top_deadline = start + time_limit * .25
        # Keep broad usable decks accessible on this attempt instead of building
        # a tall stack that leaves too little headroom for the next delivery.
        deck_ids = {base.id for base in platforms if base.max_load != 0 and any(
            item.max_load == 0 and item.w <= base.w and item.d <= base.d
            and item.w*item.d <= base.w*base.d/2 and item.h+base.h <= best.h
            for item in boxes)}
        trial = stacked_rows(best, platforms, top_deadline, deck_ids)
        if trial is not None:
            loaded = {b.id for b in trial.placed_boxes}
            pending = sorted((b for b in boxes if b.id not in loaded),
                             key=lambda b: (-b.delivery_order, -b.round_bottom, -b.contains_bag, -len(b.parts), -b.h))
            insert_remaining(trial, pending, top_deadline, 'tops')
            if load_quality(trial) > load_quality(best) and trial.validate_layout():
                best = trial
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
        insert_remaining(truck, sorted(boxes,key=key),attempt_deadline, 'floor')
        if load_quality(truck) > load_quality(best):
            best = truck
        attempts += 1
    # Small loads can keep several competing partial layouts alive.
    beam_used = len(boxes)<=12 and monotonic()<start+time_limit*.8
    if beam_used:
        best=beam_compound(best,boxes,start+time_limit*.8)
    best,repairs=repair_compound(best,boxes,start+time_limit*.95)
    loaded = {b.id for b in best.placed_boxes}
    insert_remaining(best,sorted((b for b in boxes if b.id not in loaded),
                                key=lambda b:(-b.delivery_order,-b.vol,b.id)),deadline)
    if not best.validate_layout():
        raise RuntimeError('Disposição composta inválida.')
    best.search_truncated = monotonic() >= deadline
    best.search_details = dict(engine='rigid_parts', attempts=attempts,
        repair_attempts=repairs,beam_search=beam_used,objective='volume_then_count',
        tie_breakers=['lower_center_of_mass','lateral_balance','delivery_distance'])
    return best
