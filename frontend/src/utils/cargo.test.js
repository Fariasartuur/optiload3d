import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import { normalizeCargo, partsOf } from './cargo.js';

test('legacy boxes retain logistics and defaults', () => {
    const b = normalizeCargo({id:'box',width:1,height:2,depth:3,weight:7,delivery_order:2,max_load:0,allow_rotation:false});
    assert.equal(b.shape,'box'); assert.equal(b.max_load,0); assert.equal(b.allow_rotation,false);
    assert.equal(partsOf(b).length,1);
});
test('furniture example imports and round trips all parts', () => {
    const cargo=JSON.parse(readFileSync(new URL('../../../testes/carga_moveis.json',import.meta.url),'utf8'));
    for (const raw of cargo) {
        const b=normalizeCargo(raw);
        assert.deepEqual(normalizeCargo(JSON.parse(JSON.stringify(b))),b);
    }
    assert.equal(partsOf(normalizeCargo(cargo[0])).length,5);
    assert.equal(partsOf(normalizeCargo(cargo[1])).length,6);
});
test('malformed and disconnected custom parts cannot be silently imported', () => {
    assert.throws(() => normalizeCargo({width:-1,height:1,depth:1}));
    assert.throws(() => normalizeCargo({width:1,height:1,depth:1,shape:'custom'}));
    const part={x:0,y:0,z:0,width:1,height:1,depth:1};
    assert.throws(() => normalizeCargo({width:1,height:1,depth:1,shape:'custom',parts:[part,part]}));
    assert.throws(() => normalizeCargo({width:3,height:1,depth:1,shape:'custom',parts:[part,{...part,x:2}]}));
});
