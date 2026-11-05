import { useLayoutEffect, useRef } from 'react';
import { Canvas, useThree } from '@react-three/fiber';
import { OrbitControls, TransformControls, GizmoHelper, GizmoViewport } from '@react-three/drei';
import { Plane, Raycaster, Vector2, Vector3 } from 'three';
import PartMesh from './PartMesh';
import styles from './ObjectEditor.module.css';

function Scene({parts,selected,color,mode,grid,fitVersion,onSelect,onStart,onTransform,onEnd}) {
    const proxy=useRef(), gizmo=useRef(), orbit=useRef();
    const size=useThree(state=>state.size),get=useThree(state=>state.get);
    const p=parts[selected];
    const latest=useRef(parts);
    useLayoutEffect(()=>{latest.current=parts;},[parts]);
    useLayoutEffect(()=>{
        const rows=latest.current,camera=get().camera;
        const min=['x','y','z'].map(a=>Math.min(0,...rows.map(q=>q[a])));
        const max=[['x','width'],['y','height'],['z','depth']].map(([a,s])=>Math.max(1,...rows.map(q=>q[a]+q[s])));
        const center=new Vector3(...min.map((n,i)=>(n+max[i])/2));
        const radius=Math.max(1,new Vector3(...max.map((n,i)=>n-min[i])).length()/2);
        const angle=Math.atan(Math.tan(camera.fov*Math.PI/360)*Math.min(1,size.width/size.height));
        const distance=radius/Math.sin(angle)*1.3;
        camera.position.copy(center).add(new Vector3(1,.8,1).normalize().multiplyScalar(distance));
        camera.near=.01;camera.far=Math.max(1000,distance*10);camera.updateProjectionMatrix();
        orbit.current?.target.copy(center);orbit.current?.update();
    },[fitVersion,get,size.width,size.height]);
    useLayoutEffect(()=>{
        if(proxy.current&&p){proxy.current.position.set(p.x,p.y,p.z);proxy.current.scale.set(p.width,p.height,p.depth);proxy.current.updateMatrixWorld();}
    },[p,selected]);
    return <>
        <color attach="background" args={['#18181e']}/>
        <ambientLight intensity={1.3}/><directionalLight position={[5,8,4]} intensity={2}/>
        <gridHelper args={[40,80,'#52616f','#30343e']} position={[0,-.015,0]}/>
        {parts.map((q,i)=><PartMesh key={i} part={q} color={color} selected={selected===i} onClick={e=>{e.stopPropagation();if(!gizmo.current?.dragging)onSelect(i);}}/>)}
        {p&&<mesh position={[p.x+p.width/2,p.y+p.height/2,p.z+p.depth/2]} scale={[p.width+0.003,p.height+0.003,p.depth+0.003]} raycast={()=>null}><boxGeometry/><meshBasicMaterial color="#6ab8e8" wireframe transparent opacity={.5} depthTest={false}/></mesh>}
        <group ref={proxy}/>
        <OrbitControls ref={orbit} makeDefault minDistance={.2} maxDistance={300}/>
        {p&&<TransformControls ref={gizmo} object={proxy} mode={mode} space="world" size={.85} translationSnap={grid?.05:null} onMouseDown={onStart} onMouseUp={onEnd} onObjectChange={()=>{
            const obj=proxy.current;
            const accepted=onTransform({x:obj.position.x,y:obj.position.y,z:obj.position.z,width:Math.max(.05,obj.scale.x),height:Math.max(.05,obj.scale.y),depth:Math.max(.05,obj.scale.z)});
            if(accepted){obj.position.set(accepted.x,accepted.y,accepted.z);obj.scale.set(accepted.width,accepted.height,accepted.depth);obj.updateMatrixWorld();}
        }}/>} 
        <GizmoHelper alignment="bottom-right" margin={[65,65]}><GizmoViewport axisColors={['#ef6262','#51b77a','#548dec']} labelColor="white"/></GizmoHelper>
    </>;
}
export default function ModelViewport3D(props) {
    const scene=useRef();
    return <div className={styles.viewport3d} role="application" aria-label="Área de modelagem 3D" tabIndex={0} onDragOver={e=>e.preventDefault()} onDrop={e=>{
        e.preventDefault();const kind=e.dataTransfer.getData('application/optiload-shape');if(!kind||!scene.current)return;
        const {camera,gl}=scene.current,r=gl.domElement.getBoundingClientRect();
        const ray=new Raycaster();ray.setFromCamera(new Vector2((e.clientX-r.left)/r.width*2-1,-(e.clientY-r.top)/r.height*2+1),camera);
        const at=ray.ray.intersectPlane(new Plane(new Vector3(0,1,0),0),new Vector3());
        if(at)props.onDropShape(kind,{x:at.x,y:0,z:at.z});
    }}><Canvas camera={{position:[4,3,4],fov:45}} onCreated={state=>{scene.current=state;}}><Scene {...props}/></Canvas></div>;
}
