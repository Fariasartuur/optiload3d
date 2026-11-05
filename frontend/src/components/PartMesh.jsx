import { useMemo, useEffect } from 'react';
import { BoxGeometry, SphereGeometry, CylinderGeometry, BufferGeometry, Float32BufferAttribute } from 'three';
import { polygonPoints } from '../utils/modeling';

export default function PartMesh({part:p, color='#3498db', selected=false, ...events}) {
    const kind=p.kind || 'box';
    const geometry=useMemo(()=>{
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
    return <mesh geometry={geometry} position={[p.x+p.width/2,p.y+p.height/2,p.z+p.depth/2]} scale={[p.width,p.height,p.depth]} castShadow receiveShadow {...events}>
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={selected ? .45 : 0} roughness={.65} />
    </mesh>;
}
