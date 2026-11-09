import { useRef, useState } from 'react';
import { serializeLayout, readLayout } from '../utils/layoutFile';
import styles from './CanvasControls/CanvasControls.module.css';

export default function SavedLayouts({ hasTrucks, getScene, onLoad, onExport, isOptimizing }) {
    const fileInput = useRef(null);
    const [name, setName] = useState('');
    const [busy, setBusy] = useState(false);
    const [message, setMessage] = useState('');
    const [error, setError] = useState('');

    const run = async (action) => {
        setBusy(true); setMessage(''); setError('');
        try { await action(); } catch (err) { setError(err.message); }
        finally { setBusy(false); }
    };

    const exportJson = () => run(() => {
        const title = name.trim() || 'Organização OptiLoad';
        const blob = new Blob([serializeLayout(title, getScene())], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = title.replace(/[\\/:*?"<>|]/g, '-') + '.json';
        document.body.appendChild(link);
        link.click();
        link.remove();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
        setMessage('Organização exportada em JSON.');
    });

    const openJson = event => {
        const file = event.target.files[0];
        event.target.value = '';
        if (!file) return;
        run(async () => {
            const layout = readLayout(await file.text());
            if (hasTrucks && !window.confirm('Substituir a cena atual pela organização deste arquivo?')) return;
            onLoad(layout.scene);
            setName(layout.name || file.name.replace(/\.json$/i, ''));
            setMessage('Organização aberta. Use Organizar Carga para recalcular as verificações.');
        });
    };

    return <section className={styles.controlPanel}>
        <h3 className={styles.title}>Salvar e exportar</h3>
        <div className={styles.controlGroup}>
            <input hidden ref={fileInput} type="file" accept=".json,application/json" onChange={openJson} />
            <button type="button" className={styles.toggleButton} disabled={busy || isOptimizing}
                onClick={() => fileInput.current.click()}>Abrir organização de um JSON</button>
            <button type="button" className={styles.optimizeButton} disabled={busy || !hasTrucks}
                onClick={exportJson}>Exportar organização em JSON</button>
            <button type="button" className={styles.optimizeButton} disabled={busy || !hasTrucks}
                onClick={() => run(async () => { await onExport(); setMessage('PNG exportado.'); })}>Exportar vista em PNG</button>
            <p className={styles.stats}>O JSON guarda todos os caminhões e a câmera. O PNG usa o ângulo e o corte de altura atuais, sem os painéis.</p>
            {message && <p className={styles.stats} role="status">{message}</p>}
            {error && <p className={styles.transportReport} role="alert">{error}</p>}
        </div>
    </section>;
}
