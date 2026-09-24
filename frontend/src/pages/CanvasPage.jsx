import { useState } from 'react'
import { Canvas } from '@react-three/fiber'
import { OrbitControls, Grid } from '@react-three/drei'

import Container from '../components/Container'
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

    const toggleTruckStyle = () => {
        handleUpdateTruck(prev => ({
            ...prev,
            isStyled: !prev.isStyled
        }));
    };

    const handleDeleteTruck = (idToDelete) => {
        const targetId = idToDelete || selectedTruckId;

        if (!targetId) return;

        const confirmed = window.confirm(
            'Tem certeza que deseja excluir este caminhão?'
        );

        if (!confirmed) return;

        setTrucks(prevTrucks => {
            const remainingTrucks = prevTrucks.filter(
                truck => truck.id !== targetId
            );

            if (remainingTrucks.length === 0) {
                return [];
            }

            const gap = 2;

            const totalWidth =
                remainingTrucks.reduce(
                    (acc, truck) => acc + truck.width,
                    0
                ) +
                gap * (remainingTrucks.length - 1);

            let cursor = -totalWidth / 2;

            return remainingTrucks.map(truck => {
                const x = cursor + truck.width / 2;

                cursor += truck.width + gap;

                return {
                    ...truck,
                    position: {
                        x,
                        y: 0,
                        z: 0
                    }
                };
            });
        });

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
        const truckWithDefaults = { styleColor: "#2980b9", ...newTruck };

        setTrucks(prevTrucks => {
            const positions = calculateTruckPosition(prevTrucks, truckWithDefaults);

            if (prevTrucks.length === 0) {
                return [{ ...truckWithDefaults, position: positions }];
            }

            const positionMap = Object.fromEntries(positions.map(p => [p.id, p.position]));

            return [...prevTrucks, truckWithDefaults].map(truck => ({
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
                    onToggleStyle={toggleTruckStyle}
                />

                <div id="canvas-container" className={styles.canvasContainer}>
                    <Canvas camera={{ position: [15, 15, 15], fov: 50 }} onPointerMissed={() => setSelectedTruckId(null)}>
                        <OrbitControls />

                        <ambientLight intensity={0.6} />
                        <directionalLight
                            position={[15, 20, 10]}
                            intensity={1.2}
                            castShadow
                            shadow-mapSize-width={2048}
                            shadow-mapSize-height={2048}
                            shadow-camera-left={-30}
                            shadow-camera-right={30}
                            shadow-camera-top={30}
                            shadow-camera-bottom={-30}
                        />

                        <Grid
                            args={[gridSize, gridSize]}
                            position={[0, -0.002, 0]}
                            cellSize={1}
                            cellThickness={0.5}
                            cellColor="#333333"
                            sectionSize={5}
                            sectionThickness={1}
                            sectionColor="#555555"
                            fadeDistance={gridSize * 1.5}
                            fadeStrength={1}
                            infiniteGrid={false}
                        />

                        {trucks.map((truck) => (
                            <Container
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