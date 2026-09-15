import { useState } from 'react'
import { Canvas } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'

import Truck from '../components/Truck'
import CanvasControls from '../components/CanvasControls/CanvasControls'
import AddTruckModal from '../components/Modal/Truck/AddTruckModal'

import { MdAdd } from "react-icons/md";

import styles from './CanvasPage.module.css'

const CanvasPage = () => {
    const [showAddTruckModal, setShowAddTruckModal] = useState(false);

    const [selectedTruckId, setSelectedTruckId] = useState(null);
    const [selectedBoxId, setSelectedBoxId] = useState(null);

    const [trucks, setTrucks] = useState([]);

    const [cutoffY, setCutoffY] = useState(0);

    const activeTruck = trucks.find(truck => truck.id === selectedTruckId) || null;

    const handleUpdateTruck = (updater) => {
        if (!selectedTruckId) return;

        setTrucks(prevTrucks =>
            prevTrucks.map(truck => {
                if (truck.id !== selectedTruckId) return truck;
                return typeof updater === 'function' ? updater(truck) : updater;
            })
        );
    };

    const handleDeleteTruck = (idToDelete) => {
        const targetId = idToDelete || selectedTruckId;
        if (!targetId) return;

        const confirmed = window.confirm('Tem certeza que deseja excluir este caminhão?');
        if (!confirmed) return;

        setTrucks(prevTrucks => prevTrucks.filter(truck => truck.id !== targetId));

        if (selectedTruckId === targetId) {
            setSelectedTruckId(null);
        }
    };

    const calculateTruckPosition = (trucks, newTruck, gap = 2) => {
        if (trucks.length === 0) {
            return { x: 0, y: 0, z: 0 };
        }

        const totalWidth = trucks.reduce((acc, truck) => acc + truck.width + gap, 0);
        const newTotalWidth = totalWidth + newTruck.width;

        let cursor = -newTotalWidth / 2;
        const positions = [];

        [...trucks, newTruck].forEach((truck) => {
            const x = cursor + truck.width / 2;
            positions.push({ id: truck.id, position: { x, y: 0, z: 0 } });
            cursor += truck.width + gap;
        });

        return positions;
    };

    const handleAddTruck = (newTruck) => {
        setTrucks(prevTrucks => {
            const positions = calculateTruckPosition(prevTrucks, newTruck);

            if (prevTrucks.length === 0) {
                return [{ ...newTruck, position: positions }];
            }

            const positionMap = Object.fromEntries(positions.map(p => [p.id, p.position]));

            return [...prevTrucks, newTruck].map(truck => ({
                ...truck,
                position: positionMap[truck.id]
            }));
        });
        setSelectedTruckId(newTruck.id);
    }

    const calculateGridSize = (trucks, gap = 2, minSize = 20, padding = 10) => {
        if (trucks.length === 0) return minSize;

        const totalWidth = trucks.reduce((acc, truck) => acc + truck.width + gap, 0) - gap;
        const maxDepth = Math.max(...trucks.map(truck => truck.depth));

        const neededSize = Math.max(totalWidth, maxDepth) + padding;
        return Math.max(minSize, Math.ceil(neededSize));
    };

    const gridSize = calculateGridSize(trucks);

    return (
        <>
            <div className={styles.container}>
                <div className={styles.logo}>
                    <h1>OptiLoad 3D</h1>
                </div>

                <CanvasControls
                    selectedBoxId={selectedBoxId}
                    setSelectedBoxId={setSelectedBoxId}
                    selectedTruckId={selectedTruckId}
                    truckInfo={activeTruck}
                    setTruckInfo={handleUpdateTruck}
                    deleteTruck={handleDeleteTruck}
                    cutoffY={cutoffY}
                    setCutoffY={setCutoffY}
                />

                <div id="canvas-container" className={styles.canvasContainer}>
                    <Canvas camera={{ position: [15, 15, 15], fov: 50 }} onPointerMissed={() => setSelectedTruckId(null)}>
                        <OrbitControls />

                        <gridHelper args={[gridSize, gridSize, '#ffffff', '#333333']} position={[0, -0.002, 0]} />

                        {trucks.map((truck) => (
                            <Truck
                                key={truck.id}
                                id={truck.id}
                                truckInfo={truck}
                                selectedTruckId={selectedTruckId}
                                selectedBoxId={selectedBoxId}
                                setSelectedTruckId={setSelectedTruckId}
                                setSelectedBoxId={setSelectedBoxId}
                                cutoffY={cutoffY}
                            />
                        ))}

                    </Canvas>
                </div>

                <div className={styles.floatingButton}>
                    <button onClick={() => setShowAddTruckModal(true)}>
                        <MdAdd size={24} />
                    </button>
                </div>
            </div>

            {showAddTruckModal && (
                <AddTruckModal
                    onClose={() => setShowAddTruckModal(false)}
                    onAddTrucks={handleAddTruck}
                />
            )}
        </>
    );
}

export default CanvasPage;