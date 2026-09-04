import * as THREE from 'three';
import { edgesGeo } from '../utils/edgesGeo';

const BoxItem = ({
    box, 
    isTruckSelected, 
    selectedBoxId, 
    setSelectedBoxId,
    onSelectTruck
}) => {
    const isBoxSelected = selectedBoxId === box.id;

    const centerX = box.x + box.width / 2;
    const centerY = box.y + box.height / 2;
    const centerZ = box.z + box.depth / 2;

    const gap = 0.004;
    const visualWidth = Math.max(box.width - gap, 0.01);
    const visualHeight = Math.max(box.height - gap, 0.01);
    const visualDepth = Math.max(box.depth - gap, 0.01);

    const handleClick = (e) => {
        e.stopPropagation();
        if (!isTruckSelected) {
            onSelectTruck(e);
            return;
        }
        setSelectedBoxId(isBoxSelected ? null : box.id);
    };

    const getSelectedColor = (hexColor) => {
        const color = new THREE.Color(hexColor);

        const hsl = {};
        color.getHSL(hsl);

        hsl.l = hsl.l < 0.5 ? Math.min(1, hsl.l + 0.3) : Math.max(0, hsl.l - 0.3);

        color.setHSL(hsl.h, hsl.s, hsl.l);
        return `#${color.getHexString()}`;
    }

    return (
        <group position={[centerX, centerY, centerZ]}>
            <mesh onClick={handleClick}>
                <boxGeometry args={[visualWidth, visualHeight, visualDepth]} />
                <meshBasicMaterial color={isBoxSelected ? getSelectedColor(box.color) : box.color} />
            </mesh>

            <lineSegments raycast={() => null}>
                <edgesGeometry args={[edgesGeo(visualWidth, visualHeight, visualDepth)]} />
                <lineBasicMaterial color="#111111" />
            </lineSegments>
        </group>
    )
}

export default BoxItem;