import { partsOf } from '../utils/cargo';
import PartMesh from './PartMesh';
const BoxItem = ({ box, isTruckSelected, selectedBoxId, setSelectedBoxId, onSelectTruck }) => {
    const selected=selectedBoxId===box.id;
    const handleClick=event=>{event.stopPropagation();if(!isTruckSelected){onSelectTruck(event);return;}setSelectedBoxId(selected?null:box.id);};
    return <group position={[box.x||0,box.y||0,box.z||0]}>{partsOf(box).map((p,i)=><PartMesh key={i} part={p} color={box.color} selected={selected} onClick={handleClick}/>)}</group>;
};
export default BoxItem;
