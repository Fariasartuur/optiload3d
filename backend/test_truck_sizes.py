import json
import unittest
from pathlib import Path
from backend.main import Box, BoxInput, OptimizeRequest, TruckBin, solve


class TruckSizeTests(unittest.TestCase):
    def test_partial_base_rejected_even_with_center_inside_contact(self):
        t=TruckBin(3,3,3)
        base=Box(BoxInput(id='base',width=1,height=1,depth=1,color='red',weight=20))
        top=Box(BoxInput(id='top',width=1.5,height=1,depth=1,color='blue',weight=10))
        t.placed_boxes=[base]
        self.assertFalse(t.can_place(top,0,1,0))

    def test_final_validator_checks_geometry(self):
        t=TruckBin(2,2,2)
        a=Box(BoxInput(id='a',width=1,height=1,depth=1,color='red'))
        b=Box(BoxInput(id='b',width=1,height=1,depth=1,color='blue'))
        t.placed_boxes=[a,b]
        self.assertFalse(t.validate_layout())
        b.x=1
        self.assertTrue(t.validate_layout())
        b.x=2
        self.assertFalse(t.validate_layout())

    def test_user_truck_dimensions(self):
        raw=json.loads((Path(__file__).resolve().parents[1]/'testes/carga_desafio/carga_desafio.json').read_text())
        for width,height in [(3,3),(4,4)]:
            with self.subTest(width=width,height=height):
                t=solve(OptimizeRequest(truck_w=width,truck_h=height,truck_d=6,boxes=raw))
                self.assertGreaterEqual(len(t.placed_boxes),60)
                self.assertTrue(t.validate_layout())
                # Esta carga admite pilhas baixas nos dois baús maiores.
                for b in t.placed_boxes:
                    if b.y>t.eps:
                        self.assertLessEqual(b.y+b.h,2.4+t.eps)
                        base=t.support(b,t.placed_boxes)
                        self.assertGreaterEqual(b.x,base.x-t.eps)
                        self.assertGreaterEqual(b.z,base.z-t.eps)
                        self.assertLessEqual(b.x+b.w,base.x+base.w+t.eps)
                        self.assertLessEqual(b.z+b.d,base.z+base.d+t.eps)


if __name__=='__main__': unittest.main()
