import * as THREE from 'three';
import { RoundedBox } from '@react-three/drei';
import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';

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

    const materialRef = useRef();

    useFrame(() => {
        if (!materialRef.current) return;
        const target = isBoxSelected ? 0.6 : 0;
        materialRef.current.emissiveIntensity += (target - materialRef.current.emissiveIntensity) * 0.20;
    });

    return (
        <group position={[centerX, centerY, centerZ]}>
            <RoundedBox
                args={[visualWidth, visualHeight, visualDepth]}
                radius={Math.min(visualWidth, visualHeight, visualDepth) * 0.06}
                smoothness={2}
                onClick={handleClick}
                castShadow
                receiveShadow
            >
                <meshStandardMaterial 
                    ref={materialRef}
                    color={box.color} 
                    emissive={box.color}
                    emissiveIntensity={0}
                    roughness={0.6}
                    metalness={0.1}
                />
            </RoundedBox>
        </group>
    )
}

export default BoxItem;