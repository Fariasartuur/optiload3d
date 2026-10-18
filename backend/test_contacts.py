import unittest
import json
from pathlib import Path
from backend.main import TruckBin
from backend.main import Box, BoxInput
from backend.transport import TransportConfig, assess_transport, assess_route, directional_blocking
from backend.test_advanced import item


class ContactTests(unittest.TestCase):
    def test_full_reference_has_no_initial_warnings(self):
        path = Path(__file__).resolve().parents[1] / 'testes/carga_desafio/solucao_referencia.json'
        boxes = []
        for data in json.loads(path.read_text(encoding='utf-8')):
            b = Box(BoxInput(**data))
            b.x, b.y, b.z = data['x'], data['y'], data['z']
            boxes.append(b)
        report = assess_route(TruckBin(2.4, 2.4, 6), boxes)
        self.assertEqual(report['initial_affected_box_ids'], [])
        self.assertEqual(len(report['after_delivery_affected_box_ids']), 45)

    def cases(self, truck, boxes):
        return {c['scenario'] for i in assess_transport(truck, boxes)['issues'] for c in i['cases']}

    def test_wall_only_blocks_one_direction(self):
        truck = TruckBin(3, 3, 3, TransportConfig(combined_maneuvers=False))
        b = item('a')
        self.assertEqual(self.cases(truck, [b]), {'left_turn', 'rearward'})

    def test_box_filling_truck_has_no_unrestrained_direction(self):
        truck = TruckBin(1, 2, 1)
        self.assertFalse(assess_transport(truck, [item('a', h=2)])['requires_restraint'])

    def test_small_gap_does_not_count_as_contact(self):
        truck = TruckBin(3, 3, 3)
        b = item('a'); b.x = b.z = 0.001
        self.assertFalse(any(directional_blocking(truck, [b])['a'].values()))

    def test_chain_to_wall_and_free_chain(self):
        truck = TruckBin(4, 2, 2)
        boxes = [item(str(i)) for i in range(3)]
        for i,b in enumerate(boxes): b.x = i
        blocking = directional_blocking(truck, boxes)
        self.assertTrue(all(blocking[b.id]['x_minus'] for b in boxes))
        self.assertFalse(any(blocking[b.id]['x_plus'] for b in boxes))
        for b in boxes: b.x += 0.1
        self.assertFalse(any(directional_blocking(truck, boxes)[b.id]['x_minus'] for b in boxes))

    def test_short_neighbor_is_not_tipping_brace(self):
        truck = TruckBin(3, 3, 3)
        short = item('short', h=0.2)
        tall = item('tall', h=2); tall.x=1
        self.assertFalse(directional_blocking(truck, [short,tall])['tall']['x_minus'])

    def test_multiple_neighbors_cover_face_without_gap(self):
        truck = TruckBin(3, 3, 3)
        low = item('low'); high=item('high', y=1)
        tall=item('tall', h=2); tall.x=1
        self.assertTrue(directional_blocking(truck,[low,high,tall])['tall']['x_minus'])
        high.y=1.1
        self.assertFalse(directional_blocking(truck,[low,high,tall])['tall']['x_minus'])

    def test_closed_door_is_configurable(self):
        truck=TruckBin(1,2,1,TransportConfig(rear_door_closed=False, combined_maneuvers=False))
        self.assertEqual(self.cases(truck,[item('a')]), {'rearward'})

    def test_lower_wall_contact_does_not_protect_overhanging_top(self):
        truck=TruckBin(3,3,3)
        base=item('base',w=2,weight=20)
        top=item('top',w=1,y=1); top.x=0.5
        blocking=directional_blocking(truck,[base,top])
        self.assertTrue(blocking['base']['x_minus'])
        self.assertFalse(blocking['top']['x_minus'])
        self.assertIn('right_turn',self.cases(truck,[base,top]))

    def test_delivery_removes_lateral_support(self):
        truck=TruckBin(2,2,1)
        first=item('first',order=1)
        later=item('later',order=2); later.x=1
        self.assertFalse(assess_transport(truck,[first,later])['requires_restraint'])
        report=assess_route(truck,[first,later])
        self.assertTrue(report['requires_restraint'])
        self.assertEqual({issue['after_delivery'] for issue in report['issues']},{1})


if __name__ == '__main__': unittest.main()
