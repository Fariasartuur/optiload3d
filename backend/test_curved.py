import asyncio
import json
import math
import os
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch
from pydantic import ValidationError
from backend.main import BoxInput, OptimizeRequest, optimize_load
from backend.compound import RigidBox, CompoundTruck, collides
from backend.shapes import preset
from backend.test_storage import request

ROOT=Path(__file__).resolve().parents[1]
def cargo(shape,**kwargs):
    return BoxInput(id=shape,shape=shape,width=1,height=1,depth=1,color='#abc',**kwargs)

class CurvedTests(unittest.TestCase):
    def test_catalog_and_fixture_validate(self):
        refs=json.loads((ROOT/'testes/formatos_referencia.json').read_text())
        for shape,parts in refs.items():
            self.assertEqual([p.model_dump() for p in preset(shape,1.2,.9,.8)],parts)
        rows=json.loads((ROOT/'testes/carga_carreto_variada.json').read_text(encoding='utf-8'))
        for row in rows: BoxInput.model_validate(row)

    def test_volume_curves_and_rotated_polygon_centroid(self):
        self.assertAlmostEqual(RigidBox(cargo('sphere')).vol,math.pi/6)
        self.assertAlmostEqual(RigidBox(cargo('drum')).vol,math.pi/4)
        b=RigidBox(cargo('custom',parts=[dict(kind='prism',sides=3,x=0,y=0,z=0,width=1,height=1,depth=1)]))
        for _ in range(4):
            previous=b.center();c=b.rotated()
            self.assertAlmostEqual(c.center()[0],1-previous[2]);self.assertAlmostEqual(c.center()[2],previous[0])
            self.assertAlmostEqual(c.vol,b.vol)
            b=RigidBox(BoxInput.model_validate(c.output()))

    def test_curved_envelopes_cannot_interpenetrate_or_stack(self):
        a=RigidBox(cargo('sphere',max_load=100))
        b=RigidBox(cargo('box'));b.x=.8
        self.assertTrue(collides(a,b,1e-8));self.assertEqual(a.max_load,0)
        truck=CompoundTruck(2,3,2);a.y=1;truck.placed_boxes=[a]
        self.assertFalse(truck.validate_layout())
        a.y=0;b.x=0;b.y=1;truck.placed_boxes=[a,b]
        self.assertFalse(truck.validate_layout())

    def test_api_explains_unvalidated_curved_support(self):
        result=optimize_load(OptimizeRequest(truck_w=2,truck_h=2,truck_d=2,boxes=[cargo('sphere')]))
        self.assertEqual(result['packed_count'],1)
        self.assertFalse(result['static_stability']['validated'])
        self.assertEqual(result['packing_geometry'],'conservative_part_envelopes')
        self.assertEqual(result['packed_boxes'][0]['parts'][0]['kind'],'ellipsoid')
        self.assertEqual(result['transport_assessment']['status'],'not_evaluated')

    def test_solver_elevates_contained_sphere_with_rated_platform(self):
        base = cargo('box', weight=12, max_load=15, delivery_order=2)
        sphere = cargo('sphere', weight=15, delivery_order=1)
        req = OptimizeRequest(truck_w=1, truck_h=2, truck_d=1, boxes=[base, sphere])
        result = optimize_load(req)
        packed = {b['id']: b for b in result['packed_boxes']}
        self.assertEqual(packed['sphere']['y'], 1)
        self.assertEqual(result['unloading_order'], ['sphere', 'box'])
        base.max_load = 14
        self.assertEqual(optimize_load(req)['packed_count'], 1)

    def test_rounded_support_depends_on_shape_and_available_stops(self):
        truck = CompoundTruck(1, 2, 2)
        base = RigidBox(cargo('box', max_load=20))
        sphere = RigidBox(cargo('sphere'))
        sphere.y = 1
        # The width is confined, but the free end still permits rolling.
        self.assertFalse(truck.check_physics([base, sphere]))
        stop = RigidBox(BoxInput(id='stop', width=1, height=2, depth=1, color='red'))
        stop.z = 1
        self.assertTrue(truck.check_physics([base, sphere, stop]))
        # The end stop has to remain until the sphere is removed.
        self.assertIsNone(truck.unloading_sequence([base, sphere, stop]))
        stop.z += .01
        self.assertFalse(truck.check_physics([base, sphere, stop]))
        oval = RigidBox(BoxInput(id='oval', shape='sphere', width=1, depth=1,
                                 height=.5, color='blue'))
        oval.y = 1
        self.assertTrue(truck.check_physics([base, oval]))
        oval.x = .2
        self.assertFalse(truck.check_physics([base, oval]))

    def test_upright_ellipsoid_needs_containment_even_on_rated_base(self):
        bag = RigidBox(BoxInput(id='oval', shape='sphere', width=.5, height=.8,
                                depth=.5, color='blue'))
        base = RigidBox(BoxInput(id='base', width=.5, height=1, depth=.5,
                                 max_load=20, color='red'))
        bag.y = 1
        snug = CompoundTruck(.5, 2, .5)
        snug.placed_boxes = [base, bag]
        self.assertTrue(snug.validate_layout())
        open_side = CompoundTruck(1, 2, .5)
        open_side.placed_boxes = [base, bag]
        self.assertFalse(open_side.validate_layout())

    def test_flat_cylinder_fits_above_box_when_floor_is_full(self):
        base=cargo('box',weight=12,max_load=60,delivery_order=2)
        drum=cargo('drum',weight=15,delivery_order=1)
        result=optimize_load(OptimizeRequest(truck_w=1,truck_h=2,truck_d=1,boxes=[base,drum]))
        self.assertEqual(result['packed_count'],2)
        packed={b['id']:b for b in result['packed_boxes']}
        self.assertAlmostEqual(packed['drum']['y'],1)
        self.assertEqual(result['unloading_order'],['drum','box'])

    def test_bag_cannot_go_under_a_separately_supported_table(self):
        table = RigidBox(BoxInput(id='table', shape='table', width=2, height=2, depth=2, color='red'))
        bag = RigidBox(cargo('bag', max_load=100))
        bag.x = bag.z = .5
        truck = CompoundTruck(3, 3, 3)
        truck.placed_boxes = [table, bag]
        self.assertFalse(collides(table, bag, truck.eps))
        self.assertEqual(bag.max_load, 0)
        self.assertFalse(truck.validate_layout())
        bag.x = 2
        self.assertTrue(truck.validate_layout())

    def test_invalid_primitive_parameters_rejected(self):
        for extra in [dict(kind='unknown'),dict(kind='prism',sides=2),dict(kind='prism',sides=13),dict(kind='prism',yaw=4)]:
            with self.assertRaises(ValidationError):
                cargo('custom',parts=[dict(width=1,height=1,depth=1,**extra)])

    def test_curves_survive_database_round_trip(self):
        with tempfile.TemporaryDirectory() as folder,patch.dict(os.environ,{'DATABASE_URL':'','POSTGRES_URL':'','VERCEL':'','OPTILOAD_DB_PATH':str(Path(folder)/'test.db')}):
            b=RigidBox(cargo('polygon')).rotated().output()
            scene=dict(trucks=[dict(id='truck',width=3,height=3,depth=6,boxes=[b])],camera=None,selectedTruckId=None)
            status,saved=asyncio.run(request('POST','/api/layouts',dict(name='Prisma',scene=scene)))
            self.assertEqual(status,201)
            _,loaded=asyncio.run(request('GET','/api/layouts/'+saved['id']))
            self.assertEqual(loaded['scene'],scene)

if __name__=='__main__':unittest.main()
