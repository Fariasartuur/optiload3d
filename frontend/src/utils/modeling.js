export function polygonPoints(sides=6, yaw=0) {
    const pts=Array.from({length:sides},(_,i) => [Math.sin(i*2*Math.PI/sides-yaw*Math.PI/2),Math.cos(i*2*Math.PI/sides-yaw*Math.PI/2)]);
    const xs=pts.map(p=>p[0]), zs=pts.map(p=>p[1]);
    const minX=Math.min(...xs), minZ=Math.min(...zs), w=Math.max(...xs)-minX, d=Math.max(...zs)-minZ;
    return pts.map(([x,z])=>[(x-minX)/w,(z-minZ)/d]);
}
export const views = {
    front: { name:'Frente', a:'x', b:'y', sa:'width', sb:'height', hidden:'z', thickness:'depth' },
    top: { name:'De cima', a:'x', b:'z', sa:'width', sb:'depth', hidden:'y', thickness:'height' },
    side: { name:'Lado', a:'z', b:'y', sa:'depth', sb:'height', hidden:'x', thickness:'width' }
};
const clean = n => Number(n.toFixed(9));
export function normalizeAssembly(parts) {
    if (!parts.length) return {parts:[],width:0,height:0,depth:0};
    const mins=Object.fromEntries(['x','y','z'].map(a => [a,Math.min(...parts.map(p=>p[a]))]));
    const shifted=parts.map(p=>({...p,x:clean(p.x-mins.x),y:clean(p.y-mins.y),z:clean(p.z-mins.z)}));
    return {parts:shifted,...Object.fromEntries([['x','width'],['y','height'],['z','depth']].map(([a,s])=>[s,clean(Math.max(...shifted.map(p=>p[a]+p[s])))]))};
}
export function snapMove(part, others, view, grid=true) {
    const result={...part};
    for(const [a,s] of [[view.a,view.sa],[view.b,view.sb]]) {
        let value=grid ? Math.round(part[a]/.05)*.05 : part[a];
        let nearest=.065;
        for(const p of others) for(const edge of [p[a],p[a]+p[s]]) for(const offset of [0,part[s]]) {
            const target=edge-offset, gap=Math.abs(target-part[a]);
            if(gap < nearest) { nearest=gap; value=target; }
        }
        result[a]=clean(value);
    }
    return result;
}
export function rotatePart(p) {
    return {...p,x:clean(p.x+(p.width-p.depth)/2),z:clean(p.z+(p.depth-p.width)/2),width:p.depth,depth:p.width,yaw:((p.yaw||0)+1)%4};
}
export function makeDrawnPart(kind, start, end, view, thickness, grid=true, sides=6) {
    const snap=v=>grid ? Math.round(v/.05)*.05 : v;
    const a=snap(Math.min(start.a,end.a)), b=snap(Math.min(start.b,end.b));
    return {x:0,y:0,z:0,width:thickness,height:thickness,depth:thickness,kind,sides,yaw:0,
        [view.a]:clean(a),[view.b]:clean(b),[view.sa]:clean(Math.max(.05,snap(Math.abs(end.a-start.a)))),
        [view.sb]:clean(Math.max(.05,snap(Math.abs(end.b-start.b))))};
}
const axes=[['x','width'],['y','height'],['z','depth']];
export function partsOverlap(a,b) {
    return axes.every(([axis,size])=>Math.min(a[axis]+a[size],b[axis]+b[size])-Math.max(a[axis],b[axis])>1e-9);
}
export function assemblyOverlaps(parts) {
    return parts.some((p,i)=>parts.slice(0,i).some(q=>partsOverlap(p,q)));
}
// Intersect the open time intervals where the two boxes overlap on every axis.
// This also detects passing entirely through an obstacle between pointer events.
export function constrainTransform(from,to,others) {
    let limit=1;
    for(const obstacle of others) {
        let entry=0,exit=1,possible=true;
        for(const [axis,size] of axes) {
            const inequalities=[
                [from[axis]+from[size]-obstacle[axis],to[axis]+to[size]-from[axis]-from[size]],
                [obstacle[axis]+obstacle[size]-from[axis],from[axis]-to[axis]]
            ];
            for(const [initial,velocity] of inequalities) {
                if(Math.abs(velocity)<1e-12) { if(initial<=0)possible=false; }
                else if(velocity>0) entry=Math.max(entry,-initial/velocity);
                else exit=Math.min(exit,-initial/velocity);
            }
        }
        if(possible&&entry<exit-1e-12&&exit>0&&entry<limit) limit=Math.max(0,entry);
    }
    const result={...to};
    for(const [a,s] of axes) for(const k of [a,s]) result[k]=clean(from[k]+(to[k]-from[k])*limit);
    return {part:result,blocked:limit<1};
}
export function duplicateBeside(part,parts) {
    for(const [a,s] of axes) for(const sign of [1,-1]) {
        const candidate={...part,[a]:clean(part[a]+sign*part[s])};
        if(!parts.some(p=>partsOverlap(candidate,p)))return candidate;
    }
    return null;
}

// All three dimensions are explicit: a sphere starts round, independently of the camera.
export function createPrimitive(kind) {
    return {kind,x:0,y:0,z:0,width:.5,height:.5,depth:.5,sides:6,yaw:0};
}
export function transformPart3D(from, transform, others, mode, grid=true) {
    let target={...from,...transform};
    if(mode==='translate') {
        for(const [axis,size] of axes) {
            if(Math.abs(target[axis]-from[axis])<1e-9)continue;
            const wanted=target[axis];
            let value=grid?Math.round(wanted/.05)*.05:wanted, nearest=.065;
            for(const other of others) for(const edge of [other[axis],other[axis]+other[size]]) for(const offset of [0,target[size]]) {
                const candidate=edge-offset,gap=Math.abs(candidate-wanted);
                if(gap<nearest){nearest=gap;value=candidate;}
            }
            target[axis]=clean(value);
        }
    }
    for(const [,size] of axes)target[size]=Math.max(.05,target[size]);
    return constrainTransform(from,target,others);
}
