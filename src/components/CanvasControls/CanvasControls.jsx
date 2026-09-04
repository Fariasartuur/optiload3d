import styles from './CanvasControls.module.css';
import { useState } from 'react';

import AddBoxModal from '../Modal/Box/AddBoxModal';

const Panel = ({ title, children }) => (
    <div className={styles.controlPanel}>
        <h3 className={styles.title}>{title}</h3>
        <div className={styles.controlGroup}>{children}</div>
    </div>
);

const CanvasControls = ({ 
    truckInfo,
    selectedTruckId, 
    selectedBoxId,
    setTruckInfo, 
    setSelectedBoxId,
    deleteTruck
}) => {
    const [showAddBoxModal, setShowAddBoxModal] = useState(false);

    const maxH = truckInfo?.height || 1;

    const currentCutoffY = typeof truckInfo?.cutoffY === 'number'
        ? truckInfo.cutoffY
        : maxH;

    const totalBoxes = truckInfo?.boxes?.length || 0;
    const visibleBoxes = truckInfo?.boxes?.filter(b => b.y < currentCutoffY).length || 0;
    const selectedBox = truckInfo?.boxes?.find(b => b.id === selectedBoxId) || null;

    const handleDimensionChange = (field, value) => {
        const num = parseFloat(value);
        if (isNaN(num) || num <= 0) return;

        setTruckInfo(prev => {
            const prevCutoff = typeof prev?.cutoffY === 'number' ? prev.cutoffY : prev?.height;

            return {
                ...prev,
                [field]: num,
                cutoffY: field === 'height' && prevCutoff > num ? num : prevCutoff
            };
        });
    };

    const handleCutoffChange = (value) => {
        const num = parseFloat(value);
        if (isNaN(num)) return;

        setTruckInfo(prev => ({
            ...prev,
            cutoffY: num
        }));
    };

    const handleAddBoxes = (newBoxes) => {
        setTruckInfo(prev => ({
            ...prev,
            boxes: [...(prev?.boxes || []), ...newBoxes]
        }));
    };

    const handleDeleteBox = (boxId) => {
        const confirmed = window.confirm('Tem certeza que deseja excluir esta caixa?');
        if (!confirmed) return;

        setTruckInfo(prev => ({
            ...prev,
            boxes: (prev?.boxes || []).filter(b => b.id !== boxId)
        }));
        setSelectedBoxId(null);
    };

    return (
        <>
            <aside className={styles.sidebar}>
                {selectedTruckId && truckInfo ? (
                    <>
                        <Panel title={"Caminhão Selecionado: " + truckInfo?.name}>
                            <div className={styles.label}>
                                <span>Adicionar Caixa:</span>
                                <button
                                    className={styles.addButton}
                                    onClick={() => setShowAddBoxModal(true)}
                                >
                                    Adicionar
                                </button>
                            </div>
                            <div className={styles.label}>
                                <span>Deletar:</span>
                                <button
                                    className={styles.deleteButton}
                                    onClick={() => deleteTruck()}
                                >
                                    Excluir Caminhão
                                </button>
                            </div>
                        </Panel>

                        <Panel title="Dimensões do Baú (m)">
                            <div className={styles.inputRow}>
                                <label className={styles.inputLabel}>
                                    <span>Largura (X):</span>
                                    <input
                                        type="number"
                                        step="0.1"
                                        min="0.5"
                                        value={truckInfo.width || 0}
                                        onChange={(e) => handleDimensionChange('width', e.target.value)}
                                        className={styles.numberInput}
                                    />
                                </label>

                                <label className={styles.inputLabel}>
                                    <span>Altura (Y):</span>
                                    <input
                                        type="number"
                                        step="0.1"
                                        min="0.5"
                                        value={truckInfo.height || 0}
                                        onChange={(e) => handleDimensionChange('height', e.target.value)}
                                        className={styles.numberInput}
                                    />
                                </label>

                                <label className={styles.inputLabel}>
                                    <span>Comprimento (Z):</span>
                                    <input
                                        type="number"
                                        step="0.1"
                                        min="0.5"
                                        value={truckInfo.depth || 0}
                                        onChange={(e) => handleDimensionChange('depth', e.target.value)}
                                        className={styles.numberInput}
                                    />
                                </label>
                            </div>
                        </Panel>

                        <Panel title="Camadas de Carga">
                            <div className={styles.label}>
                                <span>Altura de Corte:</span>
                                <strong>{currentCutoffY.toFixed(2)}m</strong>
                            </div>

                            <input
                                type="range"
                                min="0.1"
                                max={maxH}
                                step="0.1"
                                value={currentCutoffY}
                                onChange={(e) => handleCutoffChange(e.target.value)}
                                className={styles.slider}
                            />

                            <div className={styles.stats}>
                                Total Caixas: {totalBoxes} <br />
                                Visíveis: {visibleBoxes}
                            </div>
                        </Panel>
                    </>
                ) : (
                    <Panel title="Seleção">
                        <p style={{ color: '#888', fontSize: '0.85rem' }}>
                            Adicione e/ou clique em um caminhão para exibir e editar suas propriedades.
                        </p>
                    </Panel>
                )}

                {selectedBox && (
                    <Panel title={"Caixa Selecionada: " + (selectedBox.name || selectedBox.id)}>
                        <div className={styles.label}>
                            <span>Dimensões:</span>
                            <span>{selectedBox.width}m x {selectedBox.height}m x {selectedBox.depth}m</span>
                        </div>

                        <div className={styles.label}>
                            <span>Excluir Caixa:</span>
                            <button
                                className={styles.deleteButton}
                                onClick={() => handleDeleteBox(selectedBox.id)}
                            >
                                Excluir Caixa
                            </button>
                        </div>
                    </Panel>
                )}
            </aside>

            {showAddBoxModal && (
                <AddBoxModal
                    onClose={() => setShowAddBoxModal(false)}
                    onAddBoxes={handleAddBoxes}
                />
            )}
        </>
    );
};

export default CanvasControls;