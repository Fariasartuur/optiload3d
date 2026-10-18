import { useEffect, useState } from 'react';
import styles from './CanvasControls/CanvasControls.module.css';

async function api(path, options) {
    const response = await fetch(`/api/layouts${path}`, options);
    const data = await response.json();
    if (!response.ok) throw new Error(typeof data.detail === 'string' ? data.detail : 'Não foi possível concluir a operação.');
    return data;
}

export default function SavedLayouts({ hasTrucks, getScene, onLoad, onExport }) {
    const [name, setName] = useState('');
    const [layouts, setLayouts] = useState([]);
    const [selected, setSelected] = useState('');
    const [busy, setBusy] = useState(false);
    const [message, setMessage] = useState('');
    const [error, setError] = useState('');

    useEffect(() => {
        let active = true;
        api('').then(data => { if (active) setLayouts(data.layouts); })
            .catch(err => { if (active) setError(err.message); });
        return () => { active = false; };
    }, []);

    const run = async (action) => {
        setBusy(true); setMessage(''); setError('');
        try { await action(); } catch (err) { setError(err.message); }
        finally { setBusy(false); }
    };

    const save = (event) => {
        event.preventDefault();
        run(async () => {
            const saved = await api('', { method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name: name.trim(), scene: getScene() }) });
            setLayouts(previous => [saved, ...previous]);
            setSelected(saved.id);
            setMessage(`Organização “${saved.name}” salva no banco.`);
        });
    };

    const load = () => run(async () => {
        if (hasTrucks && !window.confirm('Abrir esta organização substituirá a cena atual. Salve antes se quiser mantê-la. Continuar?')) return;
        const saved = await api(`/${encodeURIComponent(selected)}`);
        onLoad(saved.scene);
        setName(saved.name);
        setMessage(`Organização “${saved.name}” aberta.`);
    });

    return <section className={styles.controlPanel}>
        <h3 className={styles.title}>Salvar e exportar</h3>
        <div className={styles.controlGroup}>
            <form onSubmit={save}>
                <label className={styles.inputLabel}>
                    Nome da organização
                    <input className={styles.numberInput} value={name} maxLength={120} required
                        onChange={event => setName(event.target.value)} placeholder="Ex.: Entregas de segunda" />
                </label>
                <button type="submit" className={styles.optimizeButton}
                    disabled={busy || !hasTrucks || !name.trim()}>Salvar organização</button>
            </form>
            <label className={styles.inputLabel}>
                Organizações salvas
                <select className={styles.numberInput} value={selected} onChange={event => setSelected(event.target.value)}>
                    <option value="">Selecione uma organização</option>
                    {layouts.map(layout => <option key={layout.id} value={layout.id}>
                        {layout.name} — {layout.box_count} caixas — {new Date(layout.created_at).toLocaleString('pt-BR')}
                    </option>)}
                </select>
            </label>
            <button type="button" className={styles.toggleButton} disabled={busy || !selected} onClick={load}>Abrir organização</button>
            <button type="button" className={styles.toggleButton} disabled={busy} onClick={() => run(async () => {
                const data = await api(''); setLayouts(data.layouts); setMessage('Lista atualizada.');
            })}>Atualizar lista</button>
            <button type="button" className={styles.optimizeButton} disabled={busy || !hasTrucks}
                onClick={() => run(async () => { await onExport(); setMessage('PNG exportado.'); })}>Exportar vista em PNG</button>
            <p className={styles.stats}>Salva todos os caminhões e a câmera. O PNG usa o ângulo e o corte de altura atuais, sem os painéis.</p>
            {message && <p className={styles.stats} role="status">{message}</p>}
            {error && <p className={styles.transportReport} role="alert">{error}</p>}
        </div>
    </section>;
}
