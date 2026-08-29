import * as THREE from 'three';
import BoxItem from './BoxItem';

const Truck = ({ 
    width = 2.4, 
    height = 2.6, 
    depth = 6.0, 
    boxes = [],
    cutoffY = height
}) => {
    const posY = height / 2;

    const originX = -width / 2;
    const originY = -height / 2;
    const originZ = -depth / 2;

    const outlineOffset = 0.002;

    const visibleBoxes = boxes.filter((box) => box.y < cutoffY);

    return (
        <group position={[0, posY, 0]}>
            <mesh>
                <boxGeometry args={[width, height, depth]} />
                <meshBasicMaterial 
                    color="#2c3e50" 
                    transparent={true} 
                    opacity={0.15} 
                    depthWrite={false}
                    polygonOffset={true}
                    polygonOffsetFactor={1}
                    polygonOffsetUnits={1}
                />
            </mesh>

            <lineSegments>
                <edgesGeometry args={[new THREE.BoxGeometry(width + outlineOffset, height + outlineOffset, depth + outlineOffset)]} />
                <lineBasicMaterial color="#ffffff" />
            </lineSegments>

            <group position={[originX, originY, originZ]}>
                {visibleBoxes.map((box) => (
                    <BoxItem
                        key={box.id}
                        width={box.width}
                        height={box.height}
                        depth={box.depth}
                        x={box.x}
                        y={box.y}
                        z={box.z}
                        color={box.color}
                    />
                ))}
            </group>
        </group>
    )
}

export default Truck;