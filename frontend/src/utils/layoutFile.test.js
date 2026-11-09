import assert from 'node:assert/strict';
import test from 'node:test';
import { readLayout, serializeLayout } from './layoutFile.js';
import { normalizeCargo } from './cargo.js';

test('a portable layout restores placed and waiting cargo, trucks and camera', () => {
    const chair = normalizeCargo({ id:'chair', shape:'chair', width:.5, height:.9, depth:.5,
        weight:8, max_load:10, delivery_order:2, x:.5, y:1, z:2 });
    const truck = { id:'a', width:2.4, height:2.4, depth:6, cutoffY:1.5,
        boxes:[chair], unpackedBoxes:[{...chair,id:'waiting'}], position:{x:2,y:0,z:0} };
    const camera = { position:[4,3,2], target:[0,1,0] };
    const scene = {trucks:[truck,{...truck,id:'b'}], camera, selectedTruckId:'b'};
    const loaded = readLayout(serializeLayout('Mudança',scene));
    assert.equal(loaded.name,'Mudança');
    assert.equal(loaded.scene.selectedTruckId,'b');
    assert.deepEqual(loaded.scene.camera,camera);
    for (const [index, t] of loaded.scene.trucks.entries()) {
        for (const key of Object.keys(truck)) assert.deepEqual(t[key],scene.trucks[index][key]);
    }
});

test('rejects duplicate cargo IDs across lists and files containing only cargo', () => {
    const box = {id:'box', width:1,height:1,depth:1};
    assert.throws(()=>readLayout(JSON.stringify([box])), /Estúdio/);
    assert.throws(()=>readLayout(JSON.stringify({trucks:[{...box, boxes:[box], unpackedBoxes:[box]}]})), /mesmo ID/);
});
