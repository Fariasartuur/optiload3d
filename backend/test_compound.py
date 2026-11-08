import asyncio
import json
import os
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch
from pydantic import ValidationError
from backend.main import BoxInput, OptimizeRequest, solve, optimize_load
from backend.compound import RigidBox, CompoundTruck, collides, blocks_exit
from backend.test_storage import request


def item(id, shape='box', w=1, h=1, d=1, **kwargs):
    return BoxInput(id=id, shape=shape, width=w, height=h, depth=d, color='#3498db', **kwargs)


def placed(data, x=0, y=0, z=0):
    b = RigidBox(data)
    b.x, b.y, b.z = x, y, z
    return b


class CompoundTests(unittest.TestCase):
    def test_beam_revisits_rotation_that_greedy_committed(self):
        from time import monotonic
        from backend.compound import insert_remaining, beam_compound
        boxes=[RigidBox(item('first',w=2,h=1,d=1,weight=20,max_load=0)),
               RigidBox(item('long',w=1,h=1,d=3,weight=10,max_load=0,allow_rotation=False))]
        greedy=CompoundTruck(2,1,3)
        insert_remaining(greedy,boxes,monotonic()+1)
        self.assertEqual(len(greedy.placed_boxes),1)
        better=beam_compound(greedy,boxes,monotonic()+1)
        self.assertEqual(len(better.placed_boxes),2)
        self.assertTrue(better.validate_layout())

    def test_repair_moves_a_blocking_item_to_fit_missing_cargo(self):
        from time import monotonic
        from backend.compound import repair_compound, load_quality
        small=item('small',w=1,h=1,d=1,max_load=0,allow_rotation=False)
        big=item('big',w=2,h=1,d=1,max_load=0,allow_rotation=False)
        truck=CompoundTruck(3,1,1)
        truck.placed_boxes=[placed(small,x=1)]
        self.assertTrue(truck.validate_layout())
        self.assertFalse(any(truck.can_place(RigidBox(big),x,y,z) for x,y,z in truck.positions(RigidBox(big),monotonic()+1)))
        result,attempts=repair_compound(truck,[RigidBox(small),RigidBox(big)],monotonic()+1)
        self.assertEqual(len(result.placed_boxes),2)
        self.assertGreater(load_quality(result),load_quality(truck))
        self.assertTrue(result.validate_layout())
        self.assertGreater(attempts,0)

    def test_capacity_counts_all_descendants_and_respects_delivery(self):
        truck=CompoundTruck(1,3,1)
        base=placed(item('base',weight=30,max_load=13,delivery_order=3))
        middle=placed(item('middle',weight=8,max_load=6,delivery_order=2),y=1)
        top=placed(item('top',weight=6,max_load=0,delivery_order=1),y=2)
        truck.placed_boxes=[base,middle,top]
        self.assertFalse(truck.validate_layout())  # 8 + 6 on a base rated for 13
        base.max_load=14
        self.assertTrue(truck.validate_layout())
        self.assertEqual(truck.unloading_sequence(truck.placed_boxes),['top','middle','base'])
        middle.max_load=5
        self.assertFalse(truck.validate_layout())
        middle.max_load=6
        top.delivery_order=4
        self.assertFalse(truck.validate_layout())

    def test_solver_keeps_heavy_base_and_delivery_sequence(self):
        req=OptimizeRequest(truck_w=1,truck_h=3,truck_d=1,boxes=[
            item('top','custom',weight=6,max_load=0,delivery_order=1,
                 parts=[dict(x=0,y=0,z=0,width=1,height=1,depth=1)]),
            item('base',weight=30,max_load=14,delivery_order=3),
            item('middle',weight=8,max_load=6,delivery_order=2)])
        result=solve(req,time_limit=.5)
        self.assertEqual(len(result.placed_boxes),3)
        self.assertEqual({b.id:b.y for b in result.placed_boxes},{'base':0,'middle':1,'top':2})
        self.assertTrue(result.validate_layout())
        req.boxes[1].max_load=13
        restricted=solve(req,time_limit=.5)
        self.assertEqual(len(restricted.placed_boxes),2)
        self.assertTrue(restricted.validate_layout())

    def test_large_custom_boxes_offer_top_space_to_chair_and_bag(self):
        rows = json.loads((Path(__file__).resolve().parent.parent / 'testes' / 'carreto_com_objeto_azul.json').read_text(encoding='utf-8'))
        for index in range(2):
            rows.append(item(f'cube-{index}', 'custom', max_load=60, weight=10,
                             parts=[dict(width=1, height=1, depth=1)]).model_dump())
        truck = solve(OptimizeRequest(truck_w=2.4, truck_h=2.4, truck_d=6, boxes=rows))
        self.assertEqual(len(truck.placed_boxes), len(rows))
        self.assertTrue(truck.validate_layout())
        for obj in truck.placed_boxes:
            if obj.data.shape in ('chair', 'bag'):
                base, _ = truck.contact(obj, truck.placed_boxes)
                self.assertIn(base.id, {'cube-0', 'cube-1'})

    def test_volume_priority_keeps_dominant_cargo_and_blue_assembly(self):
        rows = json.loads((Path(__file__).resolve().parent.parent / 'testes' / 'carreto_com_objeto_azul.json').read_text(encoding='utf-8'))
        req = OptimizeRequest(truck_w=2.4, truck_h=2.4, truck_d=6,
                              boxes=[BoxInput.model_validate(row) for row in rows])
        result = solve(req, time_limit=8)
        ids = {b.id for b in result.placed_boxes}
        self.assertEqual(ids, {row['id'] for row in rows})
        self.assertTrue(result.validate_layout())

    def test_empty_space_under_table_and_leg_collision(self):
        table = placed(item('table', 'table', w=2, d=2, weight=30))
        crate = placed(item('crate', w=1, h=.5), x=.16, z=.16)
        truck = CompoundTruck(2, 1, 2)
        truck.placed_boxes = [table, crate]
        self.assertTrue(truck.validate_layout())
        self.assertFalse(collides(table, crate, 1e-8))
        crate.x = 0
        crate.z = 0
        self.assertTrue(collides(table, crate, 1e-8))
        self.assertFalse(truck.validate_layout())

    def test_solver_uses_void_and_keeps_parts_after_round_trip(self):
        req = OptimizeRequest(truck_w=2, truck_h=1, truck_d=2, boxes=[
            item('table', 'table', w=2,d=2,weight=30), item('crate',w=1,h=.5)])
        result = optimize_load(req)
        self.assertEqual(result['packed_count'], 2)
        self.assertEqual(result['transport_assessment']['status'], 'not_evaluated')
        self.assertLess(result['volume_utilization'], .5)
        second = solve(OptimizeRequest(truck_w=2,truck_h=1,truck_d=2,
            boxes=[BoxInput.model_validate(b) for b in result['packed_boxes']]),time_limit=.5)
        self.assertTrue(second.validate_layout())
        self.assertEqual(len(second.placed_boxes), 2)

    def test_exit_sweep_detects_leg_in_front_inside_envelope(self):
        table = placed(item('t','table',w=2,d=2))
        crate = placed(item('c',w=.1,h=.3,d=.3),x=.01,z=.5)
        self.assertFalse(collides(crate,table,1e-8))
        self.assertTrue(blocks_exit(crate,table,1e-8))
        crate.delivery_order = 1
        table.delivery_order = 2
        self.assertIsNone(CompoundTruck(2,1,2).unloading_sequence([crate,table]))

    def test_capacity_and_support_on_tabletop(self):
        table = placed(item('t','table',w=2,d=2,weight=30,max_load=5))
        crate = placed(item('c',w=.5,h=.5,d=.5,weight=4),x=.5,y=1,z=.5)
        truck = CompoundTruck(2,2,2)
        truck.placed_boxes=[table,crate]
        self.assertTrue(truck.validate_layout())
        crate.weight=6
        self.assertFalse(truck.validate_layout())
        table.max_load=0
        crate.weight=1
        self.assertFalse(truck.validate_layout())

    def test_seat_is_a_support_surface_not_overall_chair_top(self):
        chair=placed(item('chair','chair',weight=20,max_load=10))
        crate=placed(item('c',w=.4,h=.2,d=.4,weight=2),x=.3,y=.56,z=.3)
        truck=CompoundTruck(1,1,1)
        truck.placed_boxes=[chair,crate]
        self.assertTrue(truck.validate_layout())
        self.assertEqual(truck.unloading_sequence(truck.placed_boxes), ['c','chair'])
        crate.y=.6
        self.assertFalse(truck.validate_layout())

    def test_feet_must_all_be_supported(self):
        base=placed(item('base',w=1.5,h=.2,d=2,weight=50))
        table=placed(item('t','table',w=2,d=2,weight=10),y=.2)
        truck=CompoundTruck(2,2,2)
        truck.placed_boxes=[base,table]
        self.assertFalse(truck.validate_layout())

    def test_asymmetric_center_of_mass_rejects_top_heavy_overhang(self):
        data=item('asymmetric','custom',w=2,h=2,d=1,parts=[
            dict(x=0,y=0,z=0,width=.2,height=1,depth=1),
            dict(x=0,y=1,z=0,width=2,height=1,depth=1)])
        truck=CompoundTruck(2,2,1)
        truck.placed_boxes=[placed(data)]
        self.assertFalse(truck.validate_layout())

    def test_rotation_changes_parts_even_for_square_chair(self):
        b=placed(item('chair','chair'))
        rotated=b.rotated()
        self.assertNotEqual(b.parts,rotated.parts)
        for _ in range(3): rotated=rotated.rotated()
        for p,q in zip(b.parts,rotated.parts):
            for x,y in zip(p,q): self.assertAlmostEqual(x,y)
        BoxInput.model_validate(rotated.output())

    def test_rotation_can_fit_narrow_truck(self):
        req=OptimizeRequest(truck_w=1,truck_h=1,truck_d=2,boxes=[item('t','table',w=2,d=1)])
        result=solve(req,time_limit=.5)
        self.assertEqual(len(result.placed_boxes),1)
        self.assertEqual(result.placed_boxes[0].w,1)
        req.boxes[0].allow_rotation=False
        self.assertEqual(len(solve(req,time_limit=.5).placed_boxes),0)

    def test_bad_geometry_rejected(self):
        bad_parts=[
            [dict(x=0,y=0,z=0,width=1,height=1,depth=1)]*2,
            [dict(x=0,y=0,z=0,width=.2,height=1,depth=1),dict(x=.8,y=0,z=0,width=.2,height=1,depth=1)],
            [dict(x=0,y=0,z=0,width=1,height=float('nan'),depth=1)],
        ]
        for parts in bad_parts:
            with self.assertRaises(ValidationError): item('bad','custom',parts=parts)
        with self.assertRaises(ValidationError): item('bad','custom')
        with self.assertRaises(ValidationError): item('bad','unsupported')

    def test_mixed_sizes_layout_and_unloading(self):
        for size in (2.4,3,4):
            req=OptimizeRequest(truck_w=size,truck_h=size,truck_d=6,boxes=[
                item('table','table',w=1.8,h=.8,d=.9,weight=25),
                item('chair','chair',w=.5,h=.95,d=.5,weight=5,delivery_order=1),
                item('box',w=.4,h=.4,d=.4,weight=3,delivery_order=2)])
            result=solve(req,time_limit=.5)
            self.assertEqual(len(result.placed_boxes),3)
            self.assertTrue(result.validate_layout())

    def test_persistence_preserves_compound_geometry(self):
        with tempfile.TemporaryDirectory() as directory, patch.dict(os.environ,{
            'OPTILOAD_DB_PATH':str(Path(directory)/'cargo.db'),'DATABASE_URL':'','POSTGRES_URL':'','VERCEL':''}):
            box=placed(item('chair','chair')).rotated().output()
            scene={'trucks':[dict(id='t',width=3,height=3,depth=6,boxes=[box])], 'camera':None,'selectedTruckId':None}
            status,saved=asyncio.run(request('POST','/api/layouts',dict(name='Móveis',scene=scene)))
            self.assertEqual(status,201)
            _,loaded=asyncio.run(request('GET','/api/layouts/'+saved['id']))
            self.assertEqual(loaded['scene'],scene)

if __name__=='__main__': unittest.main()
