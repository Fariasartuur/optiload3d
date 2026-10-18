"""Busca em feixe de colunas e destruição/reconstrução de pilhas.
Nenhum ID, cor ou arquivo de referência participa das decisões geométricas.
"""
from copy import copy
from random import Random
from time import monotonic


def make_columns(boxes, truck, deadline, height_limit=None):
    limit = truck.h if height_limit is None else min(truck.h, height_limit)
    groups = {}
    for b in boxes:
        dims = tuple(sorted((b.w, b.d))) if b.allow_rotation else (b.w, b.d)
        key = (b.delivery_order, b.allow_rotation, *dims)
        groups.setdefault(key, []).append(b)
    columns = []
    for (order, rotate, w, d), group in sorted(groups.items(), reverse=True):
        remaining = sorted(group, key=lambda b: (-b.weight, -b.h, b.id))
        while remaining:
            if monotonic() >= deadline:
                return None
            # Subconjuntos de alturas: revisita escolhas de composição da pilha.
            choices = {0.0: ()}
            for index, b in enumerate(remaining):
                for height, selected in list(choices.items()):
                    total = round(height + b.h, 9)
                    if total <= limit + truck.eps or (not selected and total <= truck.h + truck.eps):
                        proposal = selected + (index,)
                        if total not in choices or len(proposal) > len(choices[total]):
                            choices[total] = proposal
                if len(choices) > 256:
                    choices = dict(sorted(choices.items(), reverse=True)[:255] + [(0.0, ())])
            options = sorted(choices.items(), key=lambda item: (item[0], len(item[1])), reverse=True)
            selected, stack = (), []
            for height, indices in options:
                if not indices:
                    continue
                y, proposal = 0.0, []
                for index in indices:
                    b = copy(remaining[index])
                    b.w, b.d, b.x, b.y, b.z = w, d, 0, y, 0
                    y += b.h
                    proposal.append(b)
                if truck.check_physics(proposal):
                    selected, stack = indices, proposal
                    break
            if not selected:
                remaining.pop(0)
                continue
            columns.append(dict(boxes=stack, w=w, d=d, h=sum(b.h for b in stack),
                                order=order, rotate=rotate))
            remaining = [b for i, b in enumerate(remaining) if i not in selected]
    return columns


def column_beam(boxes, prototype, deadline, beam_width=32, height_limit=None):
    columns = make_columns(boxes, prototype, deadline, height_limit)
    if columns is None:
        return []
    best_layouts = []
    sorters = [lambda c: (-c['order'], -max(c['w'], c['d']), -min(c['w'], c['d'])),
               lambda c: (-c['order'], -c['w'] * c['d']),
               lambda c: (-c['order'], -len(c['boxes']), -c['h'])]
    eps = prototype.eps
    for sorter in sorters:
        # Estado: colunas orientadas em (x,z), quantidade, volume.
        beam = [([], 0, 0.0)]
        for column in sorted(columns, key=sorter):
            expanded = []
            for layout, count, volume in beam:
                if monotonic() >= deadline:
                    return best_layouts + [state[0] for state in beam]
                expanded.append((layout, count, volume))  # Pode deixar uma coluna de fora.
                orientations = [(column['w'], column['d'], False)]
                if column['rotate'] and column['w'] != column['d']:
                    orientations.append((column['d'], column['w'], True))
                for w, d, rotated in orientations:
                    candidates = {(0.0, 0.0), (prototype.w - w, 0.0)}
                    for old in layout:
                        candidates.update(((old['x'] + old['w'], old['z']),
                                           (old['x'], old['z'] + old['d']),
                                           (0.0, old['z'] + old['d']),
                                           (old['x'] + old['w'] - w, old['z'] + old['d']),
                                           (old['x'] + old['w'], old['z'] + old['d'] - d)))
                    for x, z in sorted(candidates, key=lambda p: (p[1], p[0])):
                        if x < -eps or z < -eps or x + w > prototype.w + eps or z + d > prototype.d + eps:
                            continue
                        valid = True
                        for old in layout:
                            if min(x + w, old['x'] + old['w']) - max(x, old['x']) > eps:
                                if min(z + d, old['z'] + old['d']) - max(z, old['z']) > eps:
                                    valid = False
                                    break
                                front, rear = (column, old) if z > old['z'] else (old, column)
                                if front['order'] > rear['order']:
                                    valid = False
                                    break
                        if valid:
                            new = dict(column, x=x, z=z, w=w, d=d, rotated=rotated)
                            expanded.append((layout + [new], count + len(column['boxes']),
                                             volume + w * d * column['h']))
            def rank(state):
                layout, count, volume = state
                extent = max((c['z'] + c['d'] for c in layout), default=0)
                return (-count, -round(volume, 8), round(extent, 8),
                        sum(c['z'] * c['w'] * c['d'] for c in layout))
            seen, beam = set(), []
            for state in sorted(expanded, key=rank):
                signature = tuple(sorted((round(c['x'], 8), round(c['z'], 8),
                                          round(c['w'], 8), round(c['d'], 8),
                                          tuple(b.id for b in c['boxes'])) for c in state[0]))
                if signature not in seen:
                    seen.add(signature)
                    beam.append(state)
                if len(beam) >= beam_width:
                    break
        best_layouts.extend(state[0] for state in beam[:3])
    return best_layouts


def unpack_columns(layout, prototype):
    truck = type(prototype)(prototype.w, prototype.h, prototype.d, prototype.transport)
    for column in layout:
        for original in column['boxes']:
            b = copy(original)
            if column['rotated']:
                b.w, b.d = b.d, b.w
            b.x, b.z = column['x'], column['z']
            truck.placed_boxes.append(b)
    return truck


def repair(best, originals, deadline, quality, max_attempts=12):
    rng = Random(417)
    attempts = 0
    while attempts < max_attempts and monotonic() < deadline:
        attempts += 1
        roots = {}
        for b in sorted(best.placed_boxes, key=lambda b: b.y):
            base = best.support(b, best.placed_boxes)
            roots[b.id] = b.id if base is None else roots[base.id]
        root_ids = sorted(set(roots.values()))
        if not root_ids:
            break
        removed = set(rng.sample(root_ids, max(1, len(root_ids) // 3)))
        trial = type(best)(best.w, best.h, best.d, best.transport)
        trial.placed_boxes = [copy(b) for b in best.placed_boxes if roots[b.id] not in removed]
        kept = {b.id for b in trial.placed_boxes}
        pending = [copy(b) for b in originals if b.id not in kept]
        rng.shuffle(pending)
        if attempts % 2:
            pending.sort(key=lambda b: (-b.delivery_order, -b.weight))
        attempt_deadline = min(deadline, monotonic() + 0.4)
        trial.pack(pending, attempt_deadline, floor_first=attempts % 3 == 0)
        if quality(trial) > quality(best):
            best = trial
    return best, attempts
