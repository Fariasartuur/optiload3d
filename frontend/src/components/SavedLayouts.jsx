import { useEffect, useRef, useState } from 'react';
import { serializeLayout, readLayout } from '../utils/layoutFile';
import styles from './CanvasControls/CanvasControls.module.css';

async function api(path = '', options) {
    let response;
    try { response = await fetch(`/api/layouts${path}`, options); }
    catch { throw new Error('Banco de organizações indisponível. Use a exportação em JSON.'); }
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(typeof data.detail === 'string' ? data.detail : 'Não foi possível concluir a operação.');
    return data;
}

const confirmReplace = hasTrucks => !hasTrucks ||
    window.confirm('Abrir esta organização substituirá a cena atual. Salve antes se quiser mantê-la. Continuar?');

export default function SavedLayouts({ hasTrucks, getScene, onLoad, onExport, isOptimizing }) {
    const fileInput = useRef(null);
    const [name, setName] = useState('');
    const [layouts, setLayouts] = useState([]);
    const [selected, setSelected] = useState('');
    const [busy, setBusy] = useState(false);
    const [message, setMessage] = useState('');
    const [error, setError] = useState('');
    const disabled = busy || isOptimizing;

    useEffect(() => {
        let active = true;
        api().then(data => { if (active) setLayouts(data.layouts); })
            .catch(err => { if (active) setError(err.message); });
        return () => { active = false; };
    }, []);

    const run = async (action) => {
        setBusy(true); setMessage(''); setError('');
        try { await action(); } catch (err) { setError(err.message); }
        finally { setBusy(false); }
    };

    const save = event => {
        event.preventDefault();
        run(async () => {
            const saved = await api('', { method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name: name.trim(), scene: getScene() }) });
            setLayouts(previous => [saved, ...previous]);
            setSelected(saved.id);
            setMessage(`Organização “${saved.name}” salva no banco.`);
        });
    };

    const loadSaved = () => run(async () => {
        const saved = await api(`/${encodeURIComponent(selected)}`);
        // Passa pela mesma validação dos arquivos JSON, que normaliza organizações antigas.
        const layout = readLayout(JSON.stringify({ name: saved.name, scene: saved.scene }));
        if (!confirmReplace(hasTrucks)) return;
        onLoad(layout.scene);
        setName(saved.name);
        setMessage(`Organização “${saved.name}” aberta. Use Organizar Carga para recalcular as verificações.`);
    });

    const refresh = () => run(async () => {
        const data = await api();
        setLayouts(data.layouts);
        setMessage('Lista atualizada.');
    });

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
            if (!confirmReplace(hasTrucks)) return;
            onLoad(layout.scene);
            setName(layout.name || file.name.replace(/\.json$/i, ''));
            setMessage('Organização aberta. Use Organizar Carga para recalcular as verificações.');
        });
    };

    return <section className={styles.controlPanel}>
        <h3 className={styles.title}>Salvar e exportar</h3>
        <div className={styles.controlGroup}>
            <form onSubmit={save}>
                <label className={styles.inputLabel}>
                    Nome da organização
                    <input className={styles.numberInput} value={name} maxLength={120}
                        onChange={event => setName(event.target.value)} placeholder="Ex.: Entregas de segunda" />
                </label>
                <button type="submit" className={styles.optimizeButton}
                    disabled={disabled || !hasTrucks || !name.trim()}>Salvar no banco</button>
            </form>
            <label className={styles.inputLabel}>
                Organizações salvas
                <select className={styles.numberInput} value={selected} onChange={event => setSelected(event.target.value)}>
                    <option value="">Selecione uma organização</option>
                    {layouts.map(layout => <option key={layout.id} value={layout.id}>
                        {layout.name} — {layout.box_count} objetos — {new Date(layout.created_at).toLocaleString('pt-BR')}
                    </option>)}
                </select>
            </label>
            <button type="button" className={styles.toggleButton} disabled={disabled || !selected} onClick={loadSaved}>Abrir do banco</button>
            <button type="button" className={styles.toggleButton} disabled={disabled} onClick={refresh}>Atualizar lista</button>

            <input hidden ref={fileInput} type="file" accept=".json,application/json" onChange={openJson} />
            <button type="button" className={styles.toggleButton} disabled={disabled}
                onClick={() => fileInput.current.click()}>Abrir organização de um JSON</button>
            <button type="button" className={styles.optimizeButton} disabled={disabled || !hasTrucks}
                onClick={exportJson}>Exportar organização em JSON</button>
            <button type="button" className={styles.optimizeButton} disabled={disabled || !hasTrucks}
                onClick={() => run(async () => { await onExport(); setMessage('PNG exportado.'); })}>Exportar vista em PNG</button>
            <p className={styles.stats}>O banco e o JSON guardam todos os caminhões e a câmera. O PNG usa o ângulo e o corte de altura atuais, sem os painéis.</p>
            {message && <p className={styles.stats} role="status">{message}</p>}
            {error && <p className={styles.transportReport} role="alert">{error}</p>}
        </div>
    </section>;
}
