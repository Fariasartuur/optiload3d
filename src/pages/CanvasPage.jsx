import { useState } from 'react'
import { Canvas } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'

import Truck from '../components/Truck'
import CanvasControls from '../components/CanvasControls/CanvasControls'

import styles from './CanvasPage.module.css'

const MOCK_CAIXAS = [
    { id: '1', width: 1.0, height: 0.8, depth: 1.2, x: 0.0, y: 0.0, z: 0.0, color: '#3498db' },
    { id: '2', width: 0.8, height: 0.8, depth: 1.0, x: 1.0, y: 0.0, z: 0.0, color: '#e67e22' },
    { id: '4', width: 1.2, height: 1.2, depth: 1.5, x: 0.0, y: 0.0, z: 2.0, color: '#e74c3c' },
    { id: '3', width: 0.8, height: 0.6, depth: 1.0, x: 1.0, y: 0.8, z: 0.0, color: '#2ecc71' },
    { id: '5', width: 0.8, height: 0.5, depth: 1.0, x: 1.0, y: 1.4, z: 0.0, color: '#9b59b6' },
];

const CanvasPage = () => {
    const [truckDimensions, setTruckDimensions] = useState({
        width: 2.4,
        height: 2.6,
        depth: 6.0,
    });

    const [cutoffY, setCutoffY] = useState(truckDimensions.height);


    return (
        <div className={styles.container}>
            <div className={styles.logo}>
                <h1>OptiLoad 3D</h1>
            </div>

            <CanvasControls
                truckDimensions={truckDimensions}
                setTruckDimensions={setTruckDimensions}
                boxes={MOCK_CAIXAS}
                cutoffY={cutoffY}
                setCutoffY={setCutoffY}
            />

            <div id="canvas-container" className={styles.canvasContainer}>
                <Canvas camera={{ position: [5, 5, 5], fov: 50 }}>
                    <OrbitControls />

                    <gridHelper args={[14, 14, '#ffffff', '#333333']} position={[0, -0.001, 0]} />

                    <Truck 
                        width={truckDimensions.width}
                        height={truckDimensions.height}
                        depth={truckDimensions.depth}
                        boxes={MOCK_CAIXAS} 
                        cutoffY={cutoffY}
                    />

                </Canvas>
            </div>
        </div>
    );
}

export default CanvasPage;