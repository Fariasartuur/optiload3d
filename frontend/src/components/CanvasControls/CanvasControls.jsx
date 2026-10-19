import styles from './CanvasControls.module.css';
import { useState } from 'react';

import AddBoxModal from '../Modal/Box/AddBoxModal';
import SavedLayouts from '../SavedLayouts';

const Panel = ({ title, children }) => (
    <div className={styles.controlPanel}>
        <h3 className={styles.title}>{title}</h3>
        <div className={styles.controlGroup}>{children}</div>
    </div>
);

const maneuverLabels = {
    braking: 'frenagem (rumo ao fundo)', rearward: 'aceleração (rumo à porta)',
    left_turn: 'curva (rumo a +X)', right_turn: 'curva (rumo a −X)',
    braking_left: 'frenagem e curva (+X)', braking_right: 'frenagem e curva (−X)',
    rearward_left: 'aceleração e curva (+X)', rearward_right: 'aceleração e curva (−X)'
};

const CanvasControls = ({
    truckInfo,
    selectedTruckId,
    selectedBoxId,
    setTruckInfo,
    setSelectedBoxId,
    deleteTruck,
    onToggleStyle,
    hasTrucks, getScene, onLoadScene, onExportPng
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
                transportAssessment: null,
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
            transportAssessment: null,
            boxes: [...(prev?.boxes || []), ...newBoxes]
        }));
    };

    const handleDeleteBox = (boxId) => {
        const confirmed = window.confirm('Tem certeza que deseja excluir esta caixa?');
        if (!confirmed) return;

        setTruckInfo(prev => ({
            ...prev,
            transportAssessment: null,
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
                        color: b.color,
                        weight: b.weight || 10,               // NOVO: Envia o peso para o Python
                        delivery_order: b.delivery_order || 1,
                        max_load: b.max_load ?? null,
                        allow_rotation: b.allow_rotation ?? true
                    }))
                })
            });

            if (!response.ok) throw new Error('Falha na comunicação com o backend.');

            const data = await response.json();

            setTruckInfo(prev => ({
                ...prev,
                boxes: data.packed_boxes,
                transportAssessment: data.transport_assessment,
                staticStability: data.static_stability,
                unpackedCount: data.unpacked_boxes?.length || 0
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
                <SavedLayouts hasTrucks={hasTrucks} getScene={getScene} onLoad={onLoadScene} onExport={onExportPng} />
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


                        {truckInfo.transportAssessment && (
                            <Panel title="Verificação da carga">
                                <div className={styles.loadSummary}>
                                    {truckInfo.staticStability?.validated && (
                                        <p>
                                            Apoio estático verificado pelo modelo: bases integralmente
                                            apoiadas.
                                        </p>
                                    )}

                                    {truckInfo.unpackedCount > 0 && (
                                        <p>
                                            {truckInfo.unpackedCount} caixa(s) ficaram fora da carga.
                                        </p>
                                    )}

                                    <details
                                        className={styles.experimentalReport}
                                        key={selectedTruckId}
                                    >
                                        <summary>Freadas e curvas · experimental</summary>

                                        <p>
                                            Esta simulação usa valores presumidos de atrito e
                                            aceleração. As ocorrências calculadas não confirmam
                                            instabilidade real nem determinam a necessidade de
                                            amarração.
                                        </p>

                                        <p>
                                            Tombamento estimado:{' '}
                                            {truckInfo.transportAssessment.initial_tipping_box_ids?.length ?? '—'}
                                            {' '}caixa(s).
                                            Deslizamento estimado:{' '}
                                            {truckInfo.transportAssessment.initial_sliding_box_ids?.length ?? '—'}
                                            {' '}caixa(s). Uma caixa pode aparecer nos dois grupos.
                                        </p>

                                        <p>
                                            Frenagem:{' '}
                                            {truckInfo.transportAssessment.assumptions.braking_g}g;
                                            {' '}curvas:{' '}
                                            {truckInfo.transportAssessment.assumptions.lateral_g}g;
                                            {' '}aceleração:{' '}
                                            {truckInfo.transportAssessment.assumptions.rearward_g}g.
                                            {' '}Atrito presumido piso/caixas:{' '}
                                            {truckInfo.transportAssessment.assumptions.floor_friction}
                                            /
                                            {truckInfo.transportAssessment.assumptions.box_friction}.
                                            {truckInfo.transportAssessment.assumptions.combined_maneuvers &&
                                                ' Inclui manobras combinadas.'}
                                        </p>

                                        <p>
                                            Após entregas:{' '}
                                            {truckInfo.transportAssessment.after_delivery_affected_box_ids?.length || 0}
                                            {' '}caixa(s) com ocorrências calculadas. A retirada de
                                            vizinhos pode alterar o apoio.
                                        </p>

                                        <p>
                                            {truckInfo.transportAssessment.assumptions.rigid_walls
                                                ? 'Considera paredes rígidas e contatos contínuos entre caixas, somente no sentido apoiado.'
                                                : 'Apoio das paredes desativado.'}
                                            {' '}
                                            {truckInfo.transportAssessment.assumptions.rear_door_closed
                                                ? 'Porta fechada.'
                                                : 'Sem apoio da porta.'}
                                            {' '}Resistência das paredes e embalagens não verificada;
                                            cintas não presumidas.
                                        </p>

                                        {truckInfo.transportAssessment.issues.length > 0 && (
                                            <details>
                                                <summary>Ver ocorrências da simulação</summary>

                                                <ul>
                                                    {truckInfo.transportAssessment.issues.map((issue) => (
                                                        <li
                                                            key={`${issue.box_id}-${issue.after_delivery ?? 'initial'}`}
                                                        >
                                                            <button
                                                                type="button"
                                                                className={styles.toggleButton}
                                                                onClick={() => setSelectedBoxId(issue.box_id)}
                                                            >
                                                                Selecionar {issue.box_id}
                                                            </button>

                                                            <p>
                                                                Apoio:{' '}
                                                                {issue.support_id === 'floor'
                                                                    ? 'piso'
                                                                    : issue.support_id}
                                                                .
                                                                {issue.after_delivery != null
                                                                    ? ` Após a entrega ${issue.after_delivery}.`
                                                                    : ' Na saída.'}
                                                                {issue.cases.some((c) => c.sliding) &&
                                                                    ' Possível deslizamento no modelo.'}
                                                                {issue.cases.some((c) => c.tipping) &&
                                                                    ' Possível tombamento no modelo.'}
                                                                {' '}
                                                                {issue.affected_box_ids.length} caixa(s)
                                                                nesta pilha.
                                                            </p>

                                                            <p>
                                                                Cenários:{' '}
                                                                {issue.cases
                                                                    .map(
                                                                        (c) =>
                                                                            maneuverLabels[c.scenario] ||
                                                                            c.scenario
                                                                    )
                                                                    .join('; ')}
                                                                .
                                                            </p>
                                                        </li>
                                                    ))}
                                                </ul>
                                            </details>
                                        )}
                                    </details>
                                </div>
                            </Panel>
                        )}


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
