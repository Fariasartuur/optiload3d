import asyncio
import json
import os
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch
from backend.main import app
from backend.storage import connect


async def request(method, path, payload=None):
    output=[]
    async def receive():
        return {'type':'http.request','body':json.dumps(payload).encode() if payload is not None else b''}
    async def send(message): output.append(message)
    await app({'type':'http','asgi':{'version':'3.0'},'http_version':'1.1','method':method,
               'scheme':'http','path':path,'raw_path':path.encode(),'query_string':b'',
               'headers':[(b'content-type',b'application/json')],
               'client':('test',123),'server':('test',80)},receive,send)
    return output[0]['status'],json.loads(output[1]['body'])


class StorageTests(unittest.TestCase):
    def setUp(self):
        self.directory=tempfile.TemporaryDirectory()
        self.path=Path(self.directory.name)/'data'/'test.sqlite3'
        self.env=patch.dict(os.environ,{'OPTILOAD_DB_PATH':str(self.path), 'DATABASE_URL':'', 'POSTGRES_URL':'', 'VERCEL':''})
        self.env.start()
        self.payload={'name':"Carga d'água",'scene':{'selectedTruckId':'truck-1',
            'camera':{'position':[3,4,5],'target':[0,1,0]},
            'trucks':[{'id':'truck-1','width':3,'height':3,'depth':6,'cutoffY':2,
                'position':{'x':1,'y':0,'z':0},'transportAssessment':{'issues':[]},
                'boxes':[{'id':'a','width':1,'height':1,'depth':1,'x':0,'y':0,'z':2,
                          'color':'#abc','weight':42,'delivery_order':3}]}]}}
    def tearDown(self):
        self.env.stop(); self.directory.cleanup()
    def call(self,*args): return asyncio.run(request(*args))

    def test_save_reload_metadata_and_independent_connection(self):
        status,saved=self.call('POST','/api/layouts',self.payload)
        self.assertEqual(status,201)
        self.assertTrue(self.path.exists())
        db=connect()
        self.assertEqual(db.execute('SELECT count(*) FROM layouts').fetchone()[0],1)
        db.close()
        status,loaded=self.call('GET','/api/layouts/'+saved['id'])
        self.assertEqual(status,200)
        self.assertEqual(loaded['scene'],self.payload['scene'])
        self.assertEqual(loaded['schema_version'],1)
        _,listing=self.call('GET','/api/layouts')
        self.assertEqual(listing['layouts'][0]['box_count'],1)
        self.assertNotIn('scene',listing['layouts'][0])

    def test_save_versions_never_overwrites(self):
        _,first=self.call('POST','/api/layouts',self.payload)
        self.payload['scene']['trucks'][0]['boxes'][0]['z']=4
        _,second=self.call('POST','/api/layouts',self.payload)
        self.assertNotEqual(first['id'],second['id'])
        _,old=self.call('GET','/api/layouts/'+first['id'])
        self.assertEqual(old['scene']['trucks'][0]['boxes'][0]['z'],2)

    def test_missing_and_parameterized_id(self):
        self.assertEqual(self.call('GET',"/api/layouts/' OR '1'='1")[0],404)

    def test_invalid_scene_rejected_without_saving(self):
        self.payload['scene']['trucks'][0]['width']=-1
        self.assertEqual(self.call('POST','/api/layouts',self.payload)[0],422)
        self.assertEqual(self.call('GET','/api/layouts')[1]['layouts'],[])

    def test_blank_name_and_missing_selection(self):
        self.payload['name']='   '
        self.assertEqual(self.call('POST','/api/layouts',self.payload)[0],422)
        self.payload['name']='Teste'
        self.payload['scene']['selectedTruckId']='missing'
        self.assertEqual(self.call('POST','/api/layouts',self.payload)[0],422)


if __name__=='__main__': unittest.main()
