import { partsOf } from '../utils/cargo';
import PartMesh from './PartMesh';
const BoxItem = ({ box, isTruckSelected, selectedBoxId, setSelectedBoxId, onSelectTruck }) => {
    const selected=selectedBoxId===box.id;
    const handleClick=event=>{event.stopPropagation();if(!isTruckSelected){onSelectTruck(event);return;}setSelectedBoxId(selected?null:box.id);};
    const parts=partsOf(box);
    
    const gap=parts.length===1?.008:0;
    return <group position={[box.x||0,box.y||0,box.z||0]}>{parts.map((p,i)=><PartMesh key={i} part={p} color={box.color} selected={selected} outlined gap={gap} onClick={handleClick}/>)}</group>;
};
export default BoxItem;