import * as THREE from 'three';

const BoxItem = ({
    width = 1.0,
    height = 1.0,
    depth = 1.0,
    x = 0,
    y = 0,
    z = 0,
    color = '#e74c3c',
}) => {
    const centerX = x + width / 2;
    const centerY = y + height / 2;
    const centerZ = z + depth / 2;

    const gap = 0.002;
    const visualWidth = Math.max(width - gap, 0.01);
    const visualHeight = Math.max(height - gap, 0.01);
    const visualDepth = Math.max(depth - gap, 0.01);

    return (
        <group position={[centerX, centerY, centerZ]}>
            <mesh>
                <boxGeometry args={[visualWidth, visualHeight, visualDepth]} />
                <meshBasicMaterial color={color} />
            </mesh>

            <lineSegments>
                <edgesGeometry args={[new THREE.BoxGeometry(visualWidth, visualHeight, visualDepth)]} />
                <lineBasicMaterial color="#111111" />
            </lineSegments>
        </group>
    )
}

export default BoxItem;