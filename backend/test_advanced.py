import json
import unittest
from pathlib import Path
from time import monotonic
from backend.main import Box, BoxInput, TruckBin, OptimizeRequest, solve
from backend.transport import TransportConfig, assess_transport, assess_route
from backend.search import column_beam, unpack_columns, repair


def item(key, w=1, h=1, d=1, weight=10, y=0, order=1):
    b = Box(BoxInput(id=key, width=w, height=h, depth=d, weight=weight,
                     delivery_order=order, color='#abc'))
    b.y = y
    return b


class TransportTests(unittest.TestCase):
    def test_braking_tips_statically_stable_box(self):
        t = TruckBin(3, 3, 3, TransportConfig(rigid_walls=False, floor_friction=2, box_friction=2))
        b = item('tall', w=2, h=2)
        self.assertTrue(t.check_physics([b]))
        case = next(c for c in assess_transport(t, [b])['issues'][0]['cases']
                    if c['scenario'] == 'braking')
        self.assertTrue(case['tipping'])
        self.assertFalse(case['sliding'])
        self.assertAlmostEqual(case['additional_pitch_moment_nm'], 29.42, places=2)

    def test_curve_tipping_both_directions(self):
        t = TruckBin(3, 3, 3, TransportConfig(rigid_walls=False, floor_friction=2))
        b = item('narrow', w=0.4, h=1, d=2)
        cases = assess_transport(t, [b])['issues'][0]['cases']
        self.assertTrue(all(next(c for c in cases if c['scenario'] == s)['tipping']
                            for s in ['left_turn', 'right_turn']))

    def test_combined_friction_vector(self):
        config = TransportConfig(rigid_walls=False, braking_g=0.4, lateral_g=0.4, rearward_g=0,
                                 floor_friction=0.5)
        t = TruckBin(3, 3, 3, config)
        b = item('flat', w=2, h=0.1, d=2)
        cases = assess_transport(t, [b])['issues'][0]['cases']
        self.assertEqual({c['scenario'] for c in cases}, {'braking_left', 'braking_right'})
        self.assertAlmostEqual(cases[0]['additional_horizontal_restraint_n'], 6.442, places=3)
        config.combined_maneuvers = False
        self.assertFalse(assess_transport(t, [b])['requires_restraint'])

    def test_stack_inertia_reaches_floor(self):
        config = TransportConfig(rigid_walls=False, braking_g=0, rearward_g=0, lateral_g=0.4,
                                 floor_friction=1, box_friction=1)
        t = TruckBin(2, 4, 4, config)
        stack = [item(str(i), d=3, y=i) for i in range(3)]
        self.assertFalse(assess_transport(t, [stack[0]])['requires_restraint'])
        report = assess_transport(t, stack)
        root = next(issue for issue in report['issues'] if issue['support_id'] == 'floor')
        self.assertEqual(root['supported_mass_kg'], 30)
        self.assertEqual(set(root['affected_box_ids']), {'0', '1', '2'})
        self.assertTrue(any(c['tipping'] for c in root['cases']))

    def test_distinct_floor_and_box_friction(self):
        t = TruckBin(3, 3, 3, TransportConfig(rigid_walls=False, floor_friction=2, box_friction=0.1))
        stack = [item('base', w=3, h=0.1, d=3), item('top', w=3, h=0.1, d=3, y=0.1)]
        issues = assess_transport(t, stack)['issues']
        self.assertEqual([i['box_id'] for i in issues], ['top'])

    def test_route_and_zero_acceleration(self):
        t = TruckBin(3, 3, 3)
        stack = [item('base', order=2), item('top', order=1, y=1)]
        report = assess_route(t, stack)
        self.assertEqual(report['checked_after_deliveries'], [1])
        self.assertTrue(any(i['after_delivery'] == 1 for i in report['issues']))
        t.transport = TransportConfig(rigid_walls=False, braking_g=0, rearward_g=0, lateral_g=0)
        self.assertFalse(assess_route(t, stack)['requires_restraint'])


class SearchTests(unittest.TestCase):
    def test_beam_improves_challenge_without_reference_or_semantic_ids(self):
        path = Path(__file__).resolve().parents[1] / 'testes/carga_desafio/carga_desafio.json'
        raw = json.loads(path.read_text(encoding='utf-8'))
        for i, b in enumerate(raw):
            b['id'], b['color'] = f'anonymous-{i}', '#000000'
        boxes = [Box(BoxInput(**b)) for b in raw]
        prototype = TruckBin(2.4, 2.4, 6)
        layouts = column_beam(boxes, prototype, monotonic() + 8)
        best = max((unpack_columns(layout, prototype) for layout in layouts),
                   key=lambda t: len(t.placed_boxes))
        self.assertGreaterEqual(len(best.placed_boxes), 54)
        self.assertTrue(best.check_physics(best.placed_boxes))
        self.assertIsNotNone(best.unloading_sequence(best.placed_boxes))
        for i, a in enumerate(best.placed_boxes):
            self.assertGreaterEqual(min(a.x,a.y,a.z), -best.eps)
            self.assertLessEqual(a.x+a.w, best.w+best.eps)
            self.assertLessEqual(a.y+a.h, best.h+best.eps)
            self.assertLessEqual(a.z+a.d, best.d+best.eps)
            for b in best.placed_boxes[i+1:]:
                self.assertFalse(all(best.overlap(a,b,axis,size) for axis,size in
                                     [('x','w'),('y','h'),('z','d')]))

    def test_repair_can_replace_a_large_box_with_more_small_boxes(self):
        t = TruckBin(2, 1, 2)
        large = item('large', w=2, d=2)
        small = [item(str(i)) for i in range(4)]
        t.placed_boxes = [large]
        quality = lambda b: (len(b.placed_boxes), sum(x.vol for x in b.placed_boxes))
        result, attempts = repair(t, [large]+small, monotonic()+2, quality)
        self.assertGreater(attempts, 0)
        self.assertEqual(len(result.placed_boxes), 4)

    def test_assessment_preserves_boxes_and_config(self):
        config = TransportConfig(rigid_walls=False, braking_g=1.2)
        req = OptimizeRequest(truck_w=1, truck_h=2, truck_d=1,
                              boxes=[BoxInput(id='a',width=1,height=2,depth=1,color='red')],
                              transport=config)
        result = solve(req, time_limit=0.5)
        self.assertEqual(len(result.placed_boxes), 1)
        self.assertEqual(result.transport.braking_g, 1.2)
        self.assertTrue(assess_transport(result, result.placed_boxes)['requires_restraint'])


if __name__ == '__main__':
    unittest.main()
