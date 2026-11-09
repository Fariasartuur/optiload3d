import { useMemo, useEffect } from 'react';
import { LatheGeometry, Vector2, BoxGeometry, SphereGeometry, CylinderGeometry, BufferGeometry, Float32BufferAttribute, EdgesGeometry, Color, CanvasTexture, SRGBColorSpace } from 'three';
import { polygonPoints } from '../utils/modeling';

let faceTexture=null;
const getFaceTexture=()=>{
    if(faceTexture||typeof document==='undefined') return faceTexture;
    const size=128,canvas=document.createElement('canvas');
    canvas.width=canvas.height=size;
    const ctx=canvas.getContext('2d');
    ctx.fillStyle='#ffffff';ctx.fillRect(0,0,size,size);
    const band=14;
    for(let i=0;i<band;i++){
        const shade=Math.round(150+105*(i/band)**.6);
        ctx.strokeStyle=`rgb(${shade},${shade},${shade})`;
        ctx.strokeRect(i+.5,i+.5,size-2*i-1,size-2*i-1);
    }
    ctx.strokeStyle='#5a5a5a';ctx.lineWidth=3;ctx.strokeRect(1.5,1.5,size-3,size-3);
    faceTexture=new CanvasTexture(canvas);
    faceTexture.colorSpace=SRGBColorSpace;
    faceTexture.anisotropy=4;
    return faceTexture;
};

// Silhouette from the flattened base to the gathered neck and tied plastic end.
function tiedBagGeometry() {
    const profile = [
        [0,-.5],[.28,-.49],[.40,-.43],[.47,-.29],[.49,-.09],
        [.47,.08],[.40,.19],[.28,.28],[.13,.34],[.055,.36],
        [.087,.38],[.065,.405],[.045,.415],[.12,.46],[.105,.49],[0,.48]
    ];
    const mesh = new LatheGeometry(profile.map(([r,y])=>new Vector2(r,y)),48);
    const vertices = mesh.attributes.position;
    for (let i=0;i<vertices.count;i++) {
        const x=vertices.getX(i), y=vertices.getY(i), z=vertices.getZ(i);
        const angle=Math.atan2(x,z);
        const folds=(y>.18?.11:.05)*Math.cos(9*angle+2*y);
        const scale=(1+folds+.035*Math.sin(3*angle-y))/1.13;
        const lean=y>.40?(y-.40)*.6:0;
        vertices.setXYZ(i,x*scale+lean,y,z*scale);
    }
    mesh.computeVertexNormals();
    return mesh;
}

export default function PartMesh({part:p, color='#3498db', selected=false, outlined=false, gap=0, ...events}) {
    const kind=p.kind || 'box';
    const geometry=useMemo(()=>{
        if(kind==='bag') return tiedBagGeometry();
        if(kind==='ellipsoid') return new SphereGeometry(.5,32,20);
        if(kind==='cylinder') return new CylinderGeometry(.5,.5,1,48);
        if(kind==='prism') {
            const pts=polygonPoints(p.sides||6,p.yaw||0).map(([x,z])=>[x-.5,z-.5]);
            const vertices=[];
            const push=(...v)=>vertices.push(...v.flat());
            // Winding is outward for top, bottom and side triangles.
            for(let i=1;i<pts.length-1;i++) {
                push([pts[0][0],.5,pts[0][1]],[pts[i+1][0],.5,pts[i+1][1]],[pts[i][0],.5,pts[i][1]]);
                push([pts[0][0],-.5,pts[0][1]],[pts[i][0],-.5,pts[i][1]],[pts[i+1][0],-.5,pts[i+1][1]]);
            }
            for(let i=0;i<pts.length;i++) {
                const a=pts[i],b=pts[(i+1)%pts.length];
                push([a[0],-.5,a[1]],[b[0],.5,b[1]],[b[0],-.5,b[1]]);
                push([a[0],-.5,a[1]],[a[0],.5,a[1]],[b[0],.5,b[1]]);
            }
            for(let i=0;i<vertices.length;i+=9) for(let k=0;k<3;k++) [vertices[i+3+k],vertices[i+6+k]]=[vertices[i+6+k],vertices[i+3+k]];
            const g=new BufferGeometry();g.setAttribute('position',new Float32BufferAttribute(vertices,3));g.computeVertexNormals();return g;
        }
        return new BoxGeometry(1,1,1);
    },[kind,p.sides,p.yaw]);
    useEffect(()=>()=>geometry.dispose(),[geometry]);
    const edges=useMemo(()=>outlined?new EdgesGeometry(geometry,30):null,[outlined,geometry]);
    useEffect(()=>()=>edges?.dispose(),[edges]);
    const edgeColor=useMemo(()=>'#'+new Color(color).multiplyScalar(.25).getHexString(),[color]);
    const inset=size=>Math.max(size-2*gap,size*.9);
    return <mesh geometry={geometry} position={[p.x+p.width/2,p.y+p.height/2,p.z+p.depth/2]} scale={[inset(p.width),inset(p.height),inset(p.depth)]} castShadow receiveShadow {...events}>
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={selected ? .45 : 0} roughness={kind==='bag'?.35:.65}
            map={outlined&&kind==='box'?getFaceTexture():null}
            polygonOffset={outlined} polygonOffsetFactor={1} polygonOffsetUnits={1} />
        {edges&&<lineSegments geometry={edges} raycast={()=>null}>
            <lineBasicMaterial color={selected?'#ffffff':edgeColor} />
        </lineSegments>}
    </mesh>;
}