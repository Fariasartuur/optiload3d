"""Verificação quase-estática de inércia; metros, kg, acelerações em g.
Contatos sem folga transmitem compressão até paredes rígidas idealizadas.
"""
from math import hypot
from pydantic import BaseModel, Field


class TransportConfig(BaseModel):
    braking_g: float = Field(default=0.8, ge=0, le=2, allow_inf_nan=False)
    lateral_g: float = Field(default=0.5, ge=0, le=2, allow_inf_nan=False)
    rearward_g: float = Field(default=0.5, ge=0, le=2, allow_inf_nan=False)
    floor_friction: float = Field(default=0.3, ge=0, le=2, allow_inf_nan=False)
    box_friction: float = Field(default=0.3, ge=0, le=2, allow_inf_nan=False)
    combined_maneuvers: bool = True
    rigid_walls: bool = True
    rear_door_closed: bool = True



def directional_blocking(truck, boxes):
    """Crédito conservador apenas para uma face inteira contida até uma parede.

    Contatos em série transmitem compressão, nunca tração. Cobertura integral
    evita tratar uma caixa baixa como escora suficiente contra tombamento.
    """
    directions = {'x_minus': ('x', 'w', -1, truck.w, 'z', 'd'),
                  'x_plus': ('x', 'w', 1, truck.w, 'z', 'd'),
                  'z_minus': ('z', 'd', -1, truck.d, 'x', 'w'),
                  'z_plus': ('z', 'd', 1, truck.d, 'x', 'w')}
    result = {b.id: {} for b in boxes}
    eps = truck.eps
    for name, (axis, size, sign, limit, cross, span) in directions.items():
        # Da parede para dentro: vizinhos usados já foram avaliados.
        ordered = sorted(boxes, key=lambda b: getattr(b, axis), reverse=sign > 0)
        for b in ordered:
            face = getattr(b, axis) + (getattr(b, size) if sign > 0 else 0)
            wall = limit if sign > 0 else 0
            enabled = truck.transport.rigid_walls and (name != 'z_plus' or truck.transport.rear_door_closed)
            if enabled and abs(face - wall) <= eps:
                result[b.id][name] = True
                continue
            lo, hi = getattr(b, cross), getattr(b, cross) + getattr(b, span)
            rectangles = []
            for other in boxes:
                if other is b or not result[other.id].get(name, False):
                    continue
                other_face = getattr(other, axis) + (getattr(other, size) if sign < 0 else 0)
                if abs(face - other_face) > eps:
                    continue
                a, c = max(lo, getattr(other, cross)), min(hi, getattr(other, cross) + getattr(other, span))
                bottom, top = max(b.y, other.y), min(b.y + b.h, other.y + other.h)
                if c - a > eps and top - bottom > eps:
                    rectangles.append((a, c, bottom, top))
            edges = sorted({lo, hi, *(v for r in rectangles for v in r[:2])})
            covered = bool(rectangles)
            for a, c in zip(edges, edges[1:]):
                if c - a <= eps:
                    continue
                intervals = sorted((bottom, top) for left, right, bottom, top in rectangles
                                   if left <= a + eps and right >= c - eps)
                height = b.y
                for bottom, top in intervals:
                    if bottom > height + eps:
                        break
                    height = max(height, top)
                if height < b.y + b.h - eps:
                    covered = False
                    break
            result[b.id][name] = covered
    return result

def assess_transport(truck, boxes):
    config = truck.transport
    scenarios = [('braking', 0, -config.braking_g),
                 ('rearward', 0, config.rearward_g),
                 ('left_turn', config.lateral_g, 0),
                 ('right_turn', -config.lateral_g, 0)]
    if config.combined_maneuvers:
        scenarios += [('braking_left', config.lateral_g, -config.braking_g),
                      ('braking_right', -config.lateral_g, -config.braking_g),
                      ('rearward_left', config.lateral_g, config.rearward_g),
                      ('rearward_right', -config.lateral_g, config.rearward_g)]
    blocking = directional_blocking(truck, boxes)
    residual = {b.id: {direction: ([0.0, 0.0] if blocked else
                 [b.weight, b.weight * (b.y + b.h / 2)])
                 for direction, blocked in blocking[b.id].items()} for b in boxes}
    loads = {b.id: [b.weight, b.weight * (b.x + b.w / 2),
                   b.weight * (b.y + b.h / 2), b.weight * (b.z + b.d / 2)]
             for b in boxes}
    members = {b.id: [b.id] for b in boxes}
    issues = []
    for b in sorted(boxes, key=lambda item: item.y, reverse=True):
        base = truck.support(b, boxes)
        if base is False:
            raise ValueError('Diagnóstico de transporte exige uma disposição com apoio válido.')
        mass, mx, my, mz = loads[b.id]
        left, right, back, front = b.x, b.x + b.w, b.z, b.z + b.d
        friction = config.floor_friction
        if base is not None:
            left, right = max(left, base.x), min(right, base.x + base.w)
            back, front = max(back, base.z), min(front, base.z + base.d)
            friction = config.box_friction
        cases = []
        for name, ax, az in scenarios:
            # Ponto de aplicação da reação normal necessário para equilibrar
            # o momento de inércia: x_eff = x_cm + (a_x/g) * h_cm.
            rx, ryx = residual[b.id]['x_plus' if ax >= 0 else 'x_minus']
            rz, ryz = residual[b.id]['z_plus' if az >= 0 else 'z_minus']
            x_eff = mx / mass + ax * (ryx - b.y * rx) / mass
            z_eff = mz / mass + az * (ryz - b.y * rz) / mass
            lateral_excess = max(left - x_eff, x_eff - right, 0)
            longitudinal_excess = max(back - z_eff, z_eff - front, 0)
            tipping = (x_eff <= left + truck.eps or x_eff >= right - truck.eps
                       or z_eff <= back + truck.eps or z_eff >= front - truck.eps)
            force = max(0, hypot(ax * rx, az * rz) - friction * mass) * 9.80665
            if force > 1e-8 or tipping:
                cases.append(dict(scenario=name, sliding=force > 1e-8, tipping=tipping,
                    additional_horizontal_restraint_n=round(force, 3),
                    additional_roll_moment_nm=round(lateral_excess * mass * 9.80665, 3),
                    additional_pitch_moment_nm=round(longitudinal_excess * mass * 9.80665, 3)))
        if cases:
            issues.append(dict(box_id=b.id, support_id=base.id if base is not None else 'floor',
                               affected_box_ids=list(members[b.id]), supported_mass_kg=mass,
                               cases=cases))
        if base is not None:
            for i, value in enumerate(loads[b.id]):
                loads[base.id][i] += value
            members[base.id].extend(members[b.id])
            for direction, values in residual[b.id].items():
                for i, value in enumerate(values):
                    residual[base.id][direction][i] += value
    affected = sorted({key for issue in issues for key in issue['affected_box_ids']})
    return dict(status='restraint_required' if issues else 'no_risk_detected_in_model',
                requires_restraint=bool(issues), affected_box_ids=affected,
                assumptions=config.model_dump(), issues=issues,
                model='quasi_static_rigid_contact', directional_support=blocking,
                note='Atrito presumido e paredes/porta fechada idealizadas como rígidas e resistentes. '
                     'Contatos sem folga e com cobertura integral da face transmitem compressão até a parede. '
                     'Resistência de caixas e paredes não dimensionada; sem crédito para cintas. '
                     'Forças e momentos são demandas por interface, não um dimensionamento de cintas; '
                     'não somar interfaces da mesma pilha. Não avalia tombamento do veículo.')


def assess_route(truck, boxes):
    report = assess_transport(truck, boxes)
    report['initial_affected_box_ids'] = list(report['affected_box_ids'])
    report['initial_tipping_box_ids'] = sorted({key for issue in report['issues']
        if any(case['tipping'] for case in issue['cases']) for key in issue['affected_box_ids']})
    report['initial_sliding_box_ids'] = sorted({key for issue in report['issues']
        if any(case['sliding'] for case in issue['cases']) for key in issue['affected_box_ids']})
    for issue in report['issues']:
        issue['after_delivery'] = None
    orders = sorted({b.delivery_order for b in boxes})
    for order in orders[:-1]:
        remaining = [b for b in boxes if b.delivery_order > order]
        stage = assess_transport(truck, remaining)
        for issue in stage['issues']:
            issue['after_delivery'] = order
        report['issues'].extend(stage['issues'])
    report['affected_box_ids'] = sorted({key for issue in report['issues']
                                        for key in issue['affected_box_ids']})
    report['requires_restraint'] = bool(report['issues'])
    report['status'] = 'restraint_required' if report['issues'] else 'no_risk_detected_in_model'
    report['checked_after_deliveries'] = orders[:-1]
    report['after_delivery_affected_box_ids'] = sorted({key for issue in report['issues']
        if issue['after_delivery'] is not None for key in issue['affected_box_ids']})
    return report
