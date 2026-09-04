import styles from './AddBoxModal.module.css';
import { useState } from 'react';

const AddBoxModal = ({ onClose, onAddBoxes }) => {
    const [error, setError] = useState(null);

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
                <div className={styles.modalBody}>
                    <label>Importar Arquivo JSON</label>
                    <input 
                        type="file" 
                        accept=".json" 
                        onChange={handleFileUpload} 
                    />
                    {error && <p style={{ color: '#e74c3c', fontSize: '0.85rem', marginTop: '8px' }}>{error}</p>}
                </div>
            </div>
        </div>
    )
}

export default AddBoxModal;