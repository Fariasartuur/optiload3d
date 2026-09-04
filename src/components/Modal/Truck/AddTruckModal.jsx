import styles from './AddTruckModal.module.css';
import { useState } from 'react';

const AddTruckModal = ({ onClose, onAddTrucks }) => {
    const [formData, setFormData] = useState({
        name: '',
        width: '',
        height: '',
        depth: ''
    });

    const handleSubmit = (e) => {
        e.preventDefault();
        const newTruck = {
            id: `truck${Date.now()}`,
            name: formData.name,
            width: parseFloat(formData.width),
            height: parseFloat(formData.height),
            depth: parseFloat(formData.depth),
            cutoffY: parseFloat(formData.height),
            boxes: []
        };

        onClose();

        onAddTrucks(newTruck);
        setFormData({
            name: '',
            width: '',
            height: '',
            depth: ''
        });
    }

    return (
        <div className={styles.modalOverlay}>
            <div className={styles.modalContent}>
                <div className={styles.modalHeader}>
                    <h2>Adicionar Caminhão</h2>
                    <button onClick={onClose} className={styles.closeButton}>
                        &times;
                    </button>
                </div>
                <div className={styles.modalBody}>
                    <form className={styles.form} onSubmit={handleSubmit}>
                        <label>
                            Nome:
                            <input
                                type="text"
                                value={formData.name}
                                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                            />
                        </label>
                        <label>
                            Largura (X):
                            <input
                                type="number"
                                step="0.1"
                                value={formData.width}
                                onChange={(e) => setFormData({ ...formData, width: e.target.value })}
                            />
                        </label>
                        <label>
                            Altura (Y):
                            <input
                                type="number"
                                step="0.1"
                                value={formData.height}
                                onChange={(e) => setFormData({ ...formData, height: e.target.value })}
                            />
                        </label>
                        <label>
                            Comprimento (Z):
                            <input
                                type="number"
                                step="0.1"
                                value={formData.depth}
                                onChange={(e) => setFormData({ ...formData, depth: e.target.value })}
                            />
                        </label>
                        <button type="submit" className={styles.submitButton}>
                            Adicionar Caminhão
                        </button>
                    </form>
                </div>
            </div>
        </div>
    )
}

export default AddTruckModal;