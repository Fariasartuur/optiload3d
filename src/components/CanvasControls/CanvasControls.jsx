import styles from './CanvasControls.module.css';

const Panel = ({ title, children }) => {
    return (
        <div className={styles.controlPanel}>
            <h3 className={styles.title}>{title}</h3>

            <div className={styles.controlGroup}>
                {children}
            </div>
        </div>
    )
}

const CanvasControls = ({ truckDimensions, setTruckDimensions, boxes, cutoffY, setCutoffY }) => {
    const totalBoxes = boxes.length;
    const visibleBoxes = boxes.filter(b => b.y < cutoffY).length;

    const handleDimensionChange = (field, value) => {
        const num = parseFloat(value);
        if (isNaN(num) || num <= 0) return;

        setTruckDimensions(prev => {
            const updated = { ...prev, [field]: num };
            if (field === 'height' && cutoffY > num) {
                setCutoffY(num);
            }
            return updated;
        });
    };

    return (
        <aside className={styles.sidebar}>

            <Panel title="Dimensões do Baú (m)">
                <div className={styles.inputRow}>
                    <label className={styles.inputLabel}>
                        <span>Largura (X):</span>
                        <input
                            type="number"
                            step="0.1"
                            min="0.5"
                            value={truckDimensions.width}
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
                            value={truckDimensions.height}
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
                            value={truckDimensions.depth}
                            onChange={(e) => handleDimensionChange('depth', e.target.value)}
                            className={styles.numberInput}
                        />
                    </label>
                </div>
            </Panel>

            <Panel title="Camadas de Carga">
                <div className={styles.label}>
                    <span>Altura de Corte:</span>
                    <strong>{cutoffY.toFixed(2)}m</strong>
                </div>

                <input
                    type="range"
                    min="0.1"
                    max={truckDimensions.height}
                    step="0.1"
                    value={cutoffY}
                    onChange={(e) => setCutoffY(parseFloat(e.target.value))}
                    className={styles.slider}
                />

                <div className={styles.stats}>
                    Total Caixas: {totalBoxes} <br />
                    Visíveis: {visibleBoxes}
                </div>
            </Panel>

            <Panel title="Instruções">
                <ul className={styles.instructionList}>
                    <li><strong>Girar:</strong> Botão esquerdo do mouse</li>
                    <li><strong>Mover (Pan):</strong> Botão direito do mouse</li>
                    <li><strong>Zoom:</strong> Scroll do mouse</li>
                </ul>
            </Panel>
        </aside>
    );
}

export default CanvasControls;