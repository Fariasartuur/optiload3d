import asyncio
import json
import random
import unittest
from pydantic import ValidationError
from backend.main import Box, BoxInput, OptimizeRequest, TruckBin, app, optimize_load, solve


def box(key, w=1, h=1, d=1, weight=10, order=1, **extra):
    return BoxInput(id=key, width=w, height=h, depth=d, color='#abc',
                    weight=weight, delivery_order=order, **extra)


def placed(data, x=0, y=0, z=0):
    b = Box(data)
    b.x, b.y, b.z = x, y, z
    return b


class PackingTests(unittest.TestCase):
    def test_heavy_below_light(self):
        req = OptimizeRequest(truck_w=1, truck_h=2, truck_d=1,
                              boxes=[box('light', weight=2), box('heavy', weight=20)])
        result = optimize_load(req)
        positions = {b['id']: b['y'] for b in result['packed_boxes']}
        self.assertEqual(positions, {'heavy': 0, 'light': 1})
        self.assertEqual(result['unloading_order'], ['light', 'heavy'])

    def test_delivery_lane_both_insertion_orders(self):
        truck = TruckBin(1, 1, 3)
        truck.placed_boxes = [placed(box('early', order=1), z=1)]
        self.assertFalse(truck.can_place(Box(box('late', order=2)), 0, 0, 2))
        self.assertTrue(truck.can_place(Box(box('late', order=2)), 0, 0, 0))
        truck.placed_boxes = [placed(box('late', order=2), z=1)]
        self.assertFalse(truck.can_place(Box(box('early', order=1)), 0, 0, 0))
        self.assertTrue(truck.can_place(Box(box('early', order=1)), 0, 0, 2))

    def test_cannot_remove_base_at_earlier_stop(self):
        truck = TruckBin(1, 2, 1)
        truck.placed_boxes = [placed(box('base', order=1))]
        self.assertFalse(truck.can_place(Box(box('top', order=2)), 0, 1, 0))

    def test_floating_collision_and_bounds(self):
        truck = TruckBin(2, 3, 2)
        b = Box(box('new'))
        self.assertFalse(truck.can_place(b, 0, 1, 0))
        self.assertFalse(truck.can_place(b, -0.1, 0, 0))
        self.assertFalse(truck.can_place(b, 2, 0, 0))
        truck.placed_boxes = [placed(box('base'))]
        self.assertFalse(truck.can_place(b, 0.5, 0, 0))

    def test_stack_torque_checks_ancestors(self):
        truck = TruckBin(8, 4, 1)
        truck.min_support_ratio = 0.60  # Exercita o cálculo de torque isoladamente.
        # Cada caixa isoladamente tem 60% de apoio, mas a resultante da
        # subpilha ultrapassa a borda direita do contato entre A e B.
        a = placed(box('a', w=3, weight=10))
        b = placed(box('b', w=5, weight=10), y=1)
        c = placed(box('c', w=5, weight=10), x=2, y=2)
        self.assertTrue(truck.check_physics([a, b]))
        self.assertFalse(truck.check_physics([a, b, c]))

    def test_cumulative_capacity(self):
        truck = TruckBin(1, 3, 1)
        a = placed(box('a', weight=20, max_load=10))
        b = placed(box('b', weight=8), y=1)
        c = placed(box('c', weight=5), y=2)
        self.assertTrue(truck.check_physics([a, b]))
        self.assertFalse(truck.check_physics([a, b, c]))

    def test_count_precedes_volume(self):
        req = OptimizeRequest(truck_w=2, truck_h=1, truck_d=2,
                              boxes=[box('large', w=2, d=2)] + [box(str(i)) for i in range(4)])
        result = optimize_load(req)
        self.assertEqual(result['packed_count'], 4)
        self.assertEqual([b['id'] for b in result['unpacked_boxes']], ['large'])

    def test_rotation_and_opt_out(self):
        for allowed, count in [(True, 1), (False, 0)]:
            req = OptimizeRequest(truck_w=2, truck_h=1, truck_d=3,
                                  boxes=[box('a', w=3, d=2, allow_rotation=allowed)])
            result = optimize_load(req)
            self.assertEqual(result['packed_count'], count)
            if allowed:
                self.assertEqual(result['packed_boxes'][0]['height'], 1)

    def test_metadata_survives_round_trip(self):
        req = OptimizeRequest(truck_w=1, truck_h=1, truck_d=1,
                              boxes=[box('a', weight=42, order=3)])
        first = optimize_load(req)
        second = optimize_load(OptimizeRequest(truck_w=1, truck_h=1, truck_d=1,
                                              boxes=first['packed_boxes']))
        self.assertEqual(first, second)

    def test_validation(self):
        for field, value in [('width', 0), ('height', -1), ('depth', float('nan')),
                             ('weight', None), ('weight', -2), ('delivery_order', 0)]:
            data = box('a').model_dump()
            data[field] = value
            with self.assertRaises(ValidationError):
                BoxInput(**data)
        with self.assertRaises(ValidationError):
            OptimizeRequest(truck_w=1, truck_h=1, truck_d=1, boxes=[box('a'), box('a')])

    def test_empty_and_timeout(self):
        req = OptimizeRequest(truck_w=1, truck_h=1, truck_d=1, boxes=[])
        self.assertEqual(optimize_load(req)['unloading_order'], [])
        req.boxes = [box('a')]
        truck = solve(req, time_limit=0)
        self.assertTrue(truck.search_truncated)
        self.assertEqual(truck.placed_boxes, [])

    def test_random_layout_and_unloading(self):
        rng = random.Random(14)
        for _ in range(8):
            req = OptimizeRequest(truck_w=4, truck_h=3, truck_d=5,
                boxes=[box(str(i), w=rng.choice([1, 2]), d=rng.choice([1, 2]),
                           weight=rng.choice([2, 5, 10]), order=rng.randint(1, 3))
                       for i in range(12)])
            truck = solve(req)
            for i, b in enumerate(truck.placed_boxes):
                self.assertGreaterEqual(min(b.x, b.y, b.z), 0)
                self.assertLessEqual(b.x + b.w, truck.w)
                self.assertLessEqual(b.y + b.h, truck.h)
                self.assertLessEqual(b.z + b.d, truck.d)
                for c in truck.placed_boxes[i + 1:]:
                    self.assertFalse(all(truck.overlap(b, c, a, s)
                                         for a, s in [('x', 'w'), ('y', 'h'), ('z', 'd')]))
            sequence = truck.unloading_sequence(truck.placed_boxes)
            self.assertIsNotNone(sequence)
            remaining = list(truck.placed_boxes)
            orders = []
            for key in sequence:
                b = next(b for b in remaining if b.id == key)
                orders.append(b.delivery_order)
                for c in remaining:
                    if c is b:
                        continue
                    self.assertFalse(c.z >= b.z + b.d - truck.eps and
                        truck.overlap(b, c, 'x', 'w') and truck.overlap(b, c, 'y', 'h'))
                remaining.remove(b)
                self.assertTrue(truck.check_physics(remaining))
            self.assertEqual(orders, sorted(orders))

    def test_asgi_contract(self):
        async def request(payload):
            output = []
            async def receive():
                return {'type': 'http.request', 'body': json.dumps(payload).encode()}
            async def send(message):
                output.append(message)
            await app({'type': 'http', 'asgi': {'version': '3.0'}, 'http_version': '1.1',
                       'method': 'POST', 'scheme': 'http', 'path': '/api/optimize',
                       'raw_path': b'/api/optimize', 'query_string': b'',
                       'headers': [(b'content-type', b'application/json')],
                       'client': ('test', 123), 'server': ('test', 80)}, receive, send)
            return output[0]['status'], json.loads(output[1]['body'])
        payload = dict(truck_w=1, truck_h=1, truck_d=1, boxes=[box('a').model_dump()])
        status, data = asyncio.run(request(payload))
        self.assertEqual(status, 200)
        self.assertEqual(data['packed_boxes'][0]['weight'], 10)
        payload['truck_w'] = -1
        self.assertEqual(asyncio.run(request(payload))[0], 422)


if __name__ == '__main__':
    unittest.main()
