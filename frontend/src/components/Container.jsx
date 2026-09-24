import { Mesh } from 'three';
import BoxItem from './BoxItem';
import { useEffect } from 'react';
import { edgesGeo } from '../utils/edgesGeo';
import StyledContainer from './StyledContainer';

const Truck = ({
    id,
    truckInfo,
    selectedTruckId,
    setSelectedTruckId,
    selectedBoxId,
    setSelectedBoxId
}) => {
    const isSelected = selectedTruckId === id;
    const isStyled = !!truckInfo?.isStyled;

    useEffect(() => {
        if (!isSelected) {
            setSelectedBoxId(null);
        }
    }, [isSelected]);

    const handleTruckClick = (e) => {
        e.stopPropagation();
        setSelectedTruckId(id);
    };

    const PADDING = 0.02;

    const realW = truckInfo?.width || 1;
    const realH = truckInfo?.height || 1;
    const realD = truckInfo?.depth || 1;

    const visualW = realW + PADDING;
    const visualH = realH + PADDING;
    const visualD = realD + PADDING;

    const posY = realH / 2;

    const originX = -realW / 2;
    const originY = -realH / 2;
    const originZ = -realD / 2;

    const outlineOffset = 0.002;

    const cutoffY = typeof truckInfo?.cutoffY === 'number'
        ? truckInfo.cutoffY
        : (truckInfo?.height || 1);

    const visibleBoxes = (truckInfo?.boxes || []).filter((box) => box.y < cutoffY);

    return (
        <group position={[truckInfo?.position?.x || 0, posY, truckInfo?.position?.z || 0]}>
            {/* Container - SEMPRE o mesmo, independente de isStyled */}
            <mesh
                onClick={handleTruckClick}
                raycast={isSelected ? () => null : Mesh.prototype.raycast}
            >
                <boxGeometry args={[visualW, visualH, visualD]} />
                <meshStandardMaterial
                    color={isSelected ? "#3498db" : "#2c3e50"}
                    transparent={true}
                    opacity={0.15}
                    depthWrite={false}
                    polygonOffset={true}
                    polygonOffsetFactor={1}
                    polygonOffsetUnits={1}
                />
            </mesh>

            <lineSegments raycast={() => null}>
                <edgesGeometry args={[edgesGeo(visualW + outlineOffset, visualH + outlineOffset, visualD + outlineOffset)]} />
                <lineBasicMaterial color={isSelected ? "#00ffff" : "#ffffff"} linewidth={isSelected ? 2 : 1} />
            </lineSegments>

            {/* Decoração do container - molduras, cantos, ondulações - só aparece se isStyled */}
            <group visible={isStyled}>
                <StyledContainer
                    visualW={visualW}
                    visualH={visualH}
                    visualD={visualD}
                    isSelected={isSelected}
                    color={truckInfo?.styleColor}
                />
            </group>

            <group position={[originX, originY, originZ]}>
                {visibleBoxes.map((box) => (
                    <BoxItem
                        key={box.id}
                        box={box}
                        isTruckSelected={isSelected}
                        selectedBoxId={selectedBoxId}
                        setSelectedBoxId={setSelectedBoxId}
                        onSelectTruck={handleTruckClick}
                    />
                ))}
            </group>
        </group>
    );
};

export default Truck;