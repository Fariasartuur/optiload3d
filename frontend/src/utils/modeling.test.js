import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import { normalizeCargo,presetParts } from './cargo.js';
import { makeDrawnPart,normalizeAssembly,rotatePart,snapMove,views,polygonPoints } from './modeling.js';

test('pointer drawings map to the three views and respect thickness',()=>{
    for(const view of Object.values(views)){
        const p=makeDrawnPart('box',{a:1,b:2},{a:2,b:3},view,.2);
        assert.equal(p[view.a],1);assert.equal(p[view.b],2);assert.equal(p[view.sa],1);assert.equal(p[view.sb],1);assert.equal(p[view.thickness],.2);
    }
});
test('magnetic movement joins faces even without grid rounding',()=>{
    const base={x:0,y:0,z:0,width:1,height:1,depth:1};
    const near={...base,x:1.04,width:.4};
    const p=snapMove(near,[base],views.front,false);
    assert.equal(p.x,1);
    const cargo=normalizeAssembly([base,p]);
    assert.doesNotThrow(()=>normalizeCargo({...cargo,shape:'custom'}));
});
test('editor normalizes negative origin without changing relative offsets',()=>{
    const p={x:-2,y:3,z:-1,width:1,height:1,depth:1,kind:'cylinder'};
    const a=normalizeAssembly([p,{...p,x:-1,kind:'box'}]);
    assert.equal(a.width,2);assert.equal(a.parts[0].x,0);assert.equal(a.parts[1].x,1);assert.equal(a.parts[0].kind,'cylinder');
});
test('rotation preserves center and returns to original after four turns',()=>{
    const p={kind:'prism',sides:3,yaw:0,x:1,y:0,z:2,width:1,height:1,depth:.5};let q=p;
    for(let i=0;i<4;i++)q=rotatePart(q);
    assert.deepEqual(q,p);
    for(let n=3;n<=12;n++){
        const pts=polygonPoints(n,1);
        assert.equal(Math.min(...pts.map(p=>p[0])),0);assert.equal(Math.max(...pts.map(p=>p[1])),1);
    }
});
test('new fixture preserves primitive kinds and validates every object',()=>{
    const rows=JSON.parse(readFileSync(new URL('../../../testes/carga_carreto_variada.json',import.meta.url),'utf8'));
    assert.equal(rows.length,16);
    for(const row of rows){const b=normalizeCargo(row);assert.deepEqual(normalizeCargo(JSON.parse(JSON.stringify(b))),b);}
});
test('frontend templates agree with backend reference including curved types',()=>{
    const refs=JSON.parse(readFileSync(new URL('../../../testes/formatos_referencia.json',import.meta.url),'utf8'));
    for(const [shape,expected] of Object.entries(refs)){
        const actual=presetParts(shape,1.2,.9,.8);
        assert.equal(actual.length,expected.length);
        actual.forEach((p,i)=>{for(const k of ['x','y','z','width','height','depth'])assert.ok(Math.abs(p[k]-expected[i][k])<1e-9);assert.equal(p.kind,expected[i].kind);});
    }
});
import { assemblyOverlaps, constrainTransform, duplicateBeside } from './modeling.js';
test('physical drag stops at first obstacle even when the pointer crosses it completely',()=>{
    const moving={x:0,y:0,z:0,width:1,height:1,depth:1};
    const wall={...moving,x:2};
    const result=constrainTransform(moving,{...moving,x:5},[wall]);
    assert.equal(result.blocked,true);assert.equal(result.part.x,1);
    assert.equal(assemblyOverlaps([wall,result.part]),false);
    const retreat=constrainTransform(result.part,moving,[wall]);
    assert.equal(retreat.blocked,false);assert.equal(retreat.part.x,0);
});
test('growth stops at contact and movement remains possible in a different depth layer',()=>{
    const moving={x:0,y:0,z:0,width:1,height:1,depth:1};
    const obstacle={...moving,x:2};
    const result=constrainTransform(moving,{...moving,width:4},[obstacle]);
    assert.equal(result.part.width,2);
    assert.equal(assemblyOverlaps([result.part,obstacle]),false);
    assert.equal(constrainTransform({...moving,z:2},{...moving,x:5,z:2},[obstacle]).blocked,false);
});
test('duplicate picks an unoccupied face rather than overlapping a neighbor',()=>{
    const p={x:0,y:0,z:0,width:1,height:1,depth:1};
    const occupied={...p,x:1};const duplicate=duplicateBeside(p,[p,occupied]);
    assert.ok(duplicate);assert.equal(assemblyOverlaps([p,occupied,duplicate]),false);
});

import {createPrimitive,transformPart3D} from './modeling.js';
test('3D sphere can become an oval independently on all three axes',()=>{
    const sphere=createPrimitive('ellipsoid');
    assert.equal(sphere.width,sphere.height);assert.equal(sphere.height,sphere.depth);
    for(const size of ['width','height','depth']) {
        const result=transformPart3D(sphere,{...sphere,[size]:1.2},[],'scale');
        assert.equal(result.part[size],1.2);
        for(const other of ['width','height','depth'].filter(k=>k!==size))assert.equal(result.part[other],.5);
        assert.equal(result.blocked,false);
    }
    const uniform=transformPart3D(sphere,{...sphere,width:1,height:1,depth:1},[],'scale');
    assert.deepEqual([uniform.part.width,uniform.part.height,uniform.part.depth],[1,1,1]);
});
test('3D scaling and movement stop at contact on every axis',()=>{
    for(const [axis,size] of [['x','width'],['y','height'],['z','depth']]) {
        const p=createPrimitive('ellipsoid'),obstacle={...createPrimitive('box'),[axis]:1};
        const scaled=transformPart3D(p,{...p,[size]:2},[obstacle],'scale');
        assert.equal(scaled.part[size],1);assert.equal(scaled.blocked,true);
        const moved=transformPart3D(p,{...p,[axis]:3},[obstacle],'translate');
        assert.equal(moved.part[axis],.5);assert.equal(moved.blocked,true);
    }
});
test('3D snap does not change axes the user did not move',()=>{
    const p={...createPrimitive('box'),x:.123,y:.234,z:.345};
    const result=transformPart3D(p,{...p,x:.61},[],'translate');
    assert.equal(result.part.x,.6);assert.equal(result.part.y,p.y);assert.equal(result.part.z,p.z);
});
