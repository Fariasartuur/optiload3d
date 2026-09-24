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
    deleteTruck,
    onToggleStyle
}) => {
    const [showAddBoxModal, setShowAddBoxModal] = useState(false);
    const [isOptimizing, setIsOptimizing] = useState(false);
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

    const handleOptimizeLoad = async () => {
        if (!truckInfo || !truckInfo.boxes || truckInfo.boxes.length === 0) return;

        setIsOptimizing(true);
        try {
            const response = await fetch('/api/optimize', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    truck_w: truckInfo.width,
                    truck_h: truckInfo.height,
                    truck_d: truckInfo.depth,
                    boxes: truckInfo.boxes.map(b => ({
                        id: b.id,
                        width: b.width,
                        height: b.height,
                        depth: b.depth,
                        color: b.color
                    }))
                })
            });

            if (!response.ok) throw new Error('Falha na comunicação com o backend.');

            const data = await response.json();

            setTruckInfo(prev => ({
                ...prev,
                boxes: data.packed_boxes
            }));

            setSelectedBoxId(null);

        } catch (error) {
            console.error("Erro na otimização:", error);
            alert("Ocorreu um erro ao calcular a organização das caixas.");
        } finally {
            setIsOptimizing(false);
        }
    };

    return (
        <>
            <aside className={styles.sidebar}>
                {selectedTruckId && truckInfo ? (
                    <>
                        <Panel title={"Caminhão Selecionado: " + truckInfo?.name}>
                            <div className={styles.label}>
                                <span>Cor do Container:</span>
                                <input
                                    type="color"
                                    value={truckInfo?.styleColor || "#2980b9"}
                                    onChange={(e) => setTruckInfo(prev => ({ ...prev, styleColor: e.target.value }))}
                                    className={styles.colorInput}
                                />
                            </div>
                            <div className={styles.label}>
                                <span>Visual Detalhado:</span>
                                <button
                                    className={truckInfo?.isStyled ? styles.toggleActive : styles.toggleButton}
                                    onClick={onToggleStyle}
                                >
                                    {truckInfo?.isStyled ? 'Ativado' : 'Desativado'}
                                </button>
                            </div>
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

                        <Panel title="Otimização de Espaço">
                            <button
                                onClick={handleOptimizeLoad}
                                disabled={isOptimizing || totalBoxes === 0}
                                className={styles.optimizeButton}
                            >
                                {isOptimizing ? 'Processando Algoritmo...' : 'Organizar Carga (Auto-Pack)'}
                            </button>
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