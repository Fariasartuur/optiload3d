import styles from './AddBoxModal.module.css';
import { useState } from 'react';
import { normalizeCargo, partsOf } from '../../../utils/cargo';

import ObjectEditor from '../../ObjectEditor';
import { normalizeAssembly } from '../../../utils/modeling';

const DEFAULT_FORM = { shape: 'custom', name: '', width: 1, height: 1, depth: 1, x: 0, y: 0, z: 0,
    color: '#3498db', weight: 10, delivery_order: 1, max_load: 0, allow_rotation: true };

export default function AddBoxModal({ onClose, onAddBoxes }) {
    const [error, setError] = useState(null);
    const [mode, setMode] = useState('manual');
    const [step,setStep] = useState('design');
    const [form, setForm] = useState(DEFAULT_FORM);
    const [customParts, setCustomParts] = useState([{ x: 0, y: 0, z: 0, width: 1, height: 1, depth: 1 }]);
    const change = (key, value) => setForm(prev => ({ ...prev, [key]: value }));
    const assembly = normalizeAssembly(customParts);
    const dimensions = form.shape === 'custom' ? {width:assembly.width,height:assembly.height,depth:assembly.depth}
        : { width: Number(form.width), height: Number(form.height), depth: Number(form.depth) };
    const draft = { ...form, ...dimensions, parts: form.shape === 'custom' ? assembly.parts : null };
    const previewParts = partsOf(draft).filter(p => [p.x,p.y,p.z,p.width,p.height,p.depth].every(Number.isFinite) && Math.min(p.width,p.height,p.depth) > 0);
    const hasCurves = previewParts.some(p => p.kind && p.kind !== 'box');
    let modelError = '';
    if(form.shape === 'custom') { try { normalizeCargo({...draft,id:'preview'}); } catch(err) { modelError=err.message; } }
    const submit = (event) => {
        event.preventDefault();
        try { onAddBoxes([normalizeCargo({...draft,max_load:hasCurves ? 0 : draft.max_load})]); onClose(); }
        catch (err) { setError(err.message); }
    };
    const upload = async (event) => {
        const file = event.target.files[0];
        if (!file) return;
        try {
            const parsed = JSON.parse(await file.text());
            const rows = Array.isArray(parsed) ? parsed : [parsed];
            if (!rows.length) throw new Error('O arquivo não contém objetos.');
            const objects = rows.map(normalizeCargo);
            if (new Set(objects.map(b => b.id)).size !== objects.length) throw new Error('Os IDs dos objetos precisam ser únicos.');
            onAddBoxes(objects); onClose();
        } catch (err) { setError(`Não foi possível importar: ${err.message}`); }
    };
    if(form.shape==='custom'&&mode==='manual') return <div className={styles.studio} role="dialog" aria-modal="true" aria-labelledby="studio-title">
        <header className={styles.studioHeader}>
            <button type="button" onClick={onClose} aria-label="Fechar editor">← Voltar</button>
            <h2 id="studio-title">OptiLoad <span>Estúdio</span></h2>
            <input aria-label="Nome do objeto" placeholder="Objeto sem título" value={form.name} onChange={e=>change('name',e.target.value)}/>
            <button type="button" onClick={()=>setMode('import')}>Importar JSON</button>
            <button type="button" className={styles.finish} onClick={()=>setStep('cargo')}>Concluir objeto →</button>
        </header>
        <ObjectEditor parts={customParts} onChange={parts=>{setCustomParts(parts);setError(null);}} color={form.color} onColorChange={value=>change('color',value)}/>
        <footer className={styles.studioStatus} role="status"><span>{modelError || '✓ Peças conectadas · encaixe físico ativo'}</span><span>Medidas em metros · modelo 3D</span></footer>
        {step==='cargo'&&<div className={styles.drawerOverlay}>
            <form className={styles.cargoDrawer} onSubmit={submit}>
                <div className={styles.drawerTitle}><div><small>ÚLTIMA ETAPA</small><h2>Pronto para carregar?</h2></div><button type="button" onClick={()=>setStep('design')} aria-label="Voltar à modelagem">×</button></div>
                <p>Confira os dados usados na organização do caminhão.</p>
                <label>Nome do objeto<input value={form.name} onChange={e=>change('name',e.target.value)} placeholder="Ex.: mesa de jantar"/></label>
                <div className={styles.inputRow}><label>Peso total (kg)<input required type="number" min=".01" step="any" value={form.weight} onChange={e=>change('weight',e.target.value)}/></label><label>Ordem de entrega<input required type="number" min="1" step="1" value={form.delivery_order} onChange={e=>change('delivery_order',e.target.value)}/></label></div>
                <label>Carga sobre o objeto (kg)<input type="number" min="0" step="any" disabled={hasCurves} value={hasCurves?0:form.max_load} onChange={e=>change('max_load',e.target.value)}/></label>
                <small>Use 0 se não puder colocar carga por cima.</small>
                <label>Giro horizontal<select value={String(form.allow_rotation)} onChange={e=>change('allow_rotation',e.target.value==='true')}><option value="true">Permitido</option><option value="false">Manter orientação</option></select></label>
                {hasCurves&&<p>Formas curvas usam contornos de proteção e não recebem carga por cima. Rolamento e deformação não são avaliados.</p>}
                {(modelError||error)&&<p className={styles.errorText} role="alert">{error||modelError}</p>}
                <button type="submit" className={styles.finish} disabled={!!modelError}>Adicionar à carga</button>
                <button type="button" className={styles.backDesign} onClick={()=>setStep('design')}>Continuar modelando</button>
            </form>
        </div>}
    </div>;
    return <div className={styles.modalOverlay}>
        <div className={styles.modalContent} role="dialog" aria-modal="true" aria-labelledby="cargo-title">
            <div className={styles.modalHeader}><h2 id="cargo-title">Importar objetos</h2><button type="button" className={styles.closeButton} onClick={onClose} aria-label="Fechar">×</button></div>
            <div className={styles.modalBody}>
                <p className={styles.hint}>Importe um arquivo JSON com seus objetos. Seu desenho permanece disponível ao voltar ao estúdio.</p>
                <label>Arquivo JSON<input type="file" accept=".json" onChange={upload}/></label>
                {error&&<p role="alert" className={styles.errorText}>{error}</p>}
                <button type="button" className={styles.customizeButton} onClick={()=>{setMode('manual');setError(null);}}>← Voltar ao estúdio</button>
            </div>
        </div>
    </div>;
}
