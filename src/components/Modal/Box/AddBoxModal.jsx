import styles from './AddBoxModal.module.css';
import { useState } from 'react';

const DEFAULT_FORM = {
    width: 0.5,
    height: 0.5,
    depth: 0.5,
    x: 0,
    y: 0,
    z: 0,
    color: '#3498db'
};

const AddBoxModal = ({ onClose, onAddBoxes }) => {
    const [error, setError] = useState(null);
    const [mode, setMode] = useState('manual'); // 'manual' | 'import'
    const [form, setForm] = useState(DEFAULT_FORM);

    const handleFormChange = (field, value) => {
        setForm((prev) => ({ ...prev, [field]: value }));
    };

    const handleManualSubmit = (event) => {
        event.preventDefault();
        setError(null);

        const width = Number(form.width);
        const height = Number(form.height);
        const depth = Number(form.depth);
        const x = Number(form.x);
        const y = Number(form.y);
        const z = Number(form.z);

        if ([width, height, depth].some((v) => isNaN(v) || v <= 0)) {
            setError('Largura, altura e profundidade devem ser números maiores que zero.');
            return;
        }
        if ([x, y, z].some((v) => isNaN(v))) {
            setError('Posição (x, y, z) inválida.');
            return;
        }

        const newBox = {
            id: `manual-${Date.now()}`,
            width,
            height,
            depth,
            x,
            y,
            z,
            color: form.color || '#3498db'
        };

        onAddBoxes([newBox]);
        onClose();
    };

    const handleFileUpload = (event) => {
        const file = event.target.files[0];
        if (!file) return;

        const reader = new FileReader();

        reader.onload = (e) => {
            try {
                const parsedData = JSON.parse(e.target.result);

                const boxesArray = Array.isArray(parsedData) ? parsedData : [parsedData];

                const formattedBoxes = boxesArray.map((box, index) => ({
                    id: box.id || `imported-${Date.now()}-${index}`,
                    width: Number(box.width) || 0.5,
                    height: Number(box.height) || 0.5,
                    depth: Number(box.depth) || 0.5,
                    x: Number(box.x) || 0,
                    y: Number(box.y) || 0,
                    z: Number(box.z) || 0,
                    color: box.color || '#3498db'
                }));

                onAddBoxes(formattedBoxes);
                onClose();
            } catch (err) {
                setError('Erro ao ler o arquivo JSON. Certifique-se de que a estrutura está correta.');
            }
        };

        reader.readAsText(file);
    };


    return (
        <div className={styles.modalOverlay}>
            <div className={styles.modalContent}>
                <div className={styles.modalHeader}>
                    <h2>Adicionar Caixa</h2>
                    <button onClick={onClose} className={styles.closeButton}>
                        &times;
                    </button>
                </div>
                <div className={styles.tabs}>
                    <button
                        type="button"
                        className={mode === 'manual' ? styles.tabActive : styles.tab}
                        onClick={() => { setMode('manual'); setError(null); }}
                    >
                        Manual
                    </button>
                    <button
                        type="button"
                        className={mode === 'import' ? styles.tabActive : styles.tab}
                        onClick={() => { setMode('import'); setError(null); }}
                    >
                        Importar JSON
                    </button>
                </div>

                {mode === 'manual' ? (
                    <form className={styles.modalBody} onSubmit={handleManualSubmit}>
                        <div className={styles.inputRow}>
                            <label>
                                Largura (X)
                                <input type="number" step="0.1" min="0.1"
                                    value={form.width}
                                    onChange={(e) => handleFormChange('width', e.target.value)} />
                            </label>
                            <label>
                                Altura (Y)
                                <input type="number" step="0.1" min="0.1"
                                    value={form.height}
                                    onChange={(e) => handleFormChange('height', e.target.value)} />
                            </label>
                            <label>
                                Profundidade (Z)
                                <input type="number" step="0.1" min="0.1"
                                    value={form.depth}
                                    onChange={(e) => handleFormChange('depth', e.target.value)} />
                            </label>
                        </div>

                        <div className={styles.inputRow}>
                            <label>
                                Posição X
                                <input type="number" step="0.1"
                                    value={form.x}
                                    onChange={(e) => handleFormChange('x', e.target.value)} />
                            </label>
                            <label>
                                Posição Y
                                <input type="number" step="0.1"
                                    value={form.y}
                                    onChange={(e) => handleFormChange('y', e.target.value)} />
                            </label>
                            <label>
                                Posição Z
                                <input type="number" step="0.1"
                                    value={form.z}
                                    onChange={(e) => handleFormChange('z', e.target.value)} />
                            </label>
                        </div>

                        <label>
                            Cor
                            <input type="color"
                                value={form.color}
                                onChange={(e) => handleFormChange('color', e.target.value)} />
                        </label>

                        {error && <p className={styles.errorText}>{error}</p>}

                        <button type="submit" className={styles.submitButton}>
                            Adicionar Caixa
                        </button>
                    </form>
                ) : (
                    <div className={styles.modalBody}>
                        <label>Importar Arquivo JSON</label>
                        <input
                            type="file"
                            accept=".json"
                            onChange={handleFileUpload}
                        />
                        {error && <p className={styles.errorText}>{error}</p>}
                    </div>
                )}
            </div>
        </div>
    )
}

export default AddBoxModal;