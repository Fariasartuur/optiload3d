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

    def test_flat_cylinder_fits_above_box_when_floor_is_full(self):
        base=cargo('box',weight=30,max_load=20,delivery_order=2)
        drum=cargo('drum',weight=10,delivery_order=1)
        result=optimize_load(OptimizeRequest(truck_w=1,truck_h=2,truck_d=1,boxes=[base,drum]))
        self.assertEqual(result['packed_count'],2)
        packed={b['id']:b for b in result['packed_boxes']}
        self.assertAlmostEqual(packed['drum']['y'],1)
        self.assertEqual(result['unloading_order'],['drum','box'])

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
