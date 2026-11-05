import { useEffect, useRef, useState } from 'react';
import ModelViewport3D from './ModelViewport3D';
import { assemblyOverlaps, constrainTransform, createPrimitive, transformPart3D, duplicateBeside, partsOverlap, normalizeAssembly, rotatePart } from '../utils/modeling';
import styles from './ObjectEditor.module.css';
import { presetParts, shapeNames, shapeDefaults } from '../utils/cargo';
import { FiGrid, FiLayers, FiBox, FiMousePointer, FiCopy, FiRotateCw, FiTrash2, FiCornerUpLeft, FiCornerUpRight, FiSearch, FiHelpCircle } from 'react-icons/fi';

const names={box:'Bloco',ellipsoid:'Esfera / oval',cylinder:'Cilindro',prism:'Polígono'};
const icons={box:'▭',ellipsoid:'◯',cylinder:'▱',prism:'⬡'};
const clone=parts=>parts.map(p=>({...p}));
function ModelThumbnail({shape}) {
    const [w,h,d]=shapeDefaults[shape];
    const parts=presetParts(shape,w,h,d), unit=60/Math.max(w,h), left=(80-w*unit)/2;
    return <svg viewBox="0 0 80 76" className={styles.templateIcon} aria-hidden="true">{parts.map((q,i)=>q.kind==='ellipsoid'?<ellipse key={i} cx={left+(q.x+q.width/2)*unit} cy={66-(q.y+q.height/2)*unit} rx={q.width*unit/2} ry={q.height*unit/2} fill="#397da9" stroke="#6ab8e8"/>:<rect key={i} x={left+q.x*unit} y={66-(q.y+q.height)*unit} width={q.width*unit} height={q.height*unit} rx={q.kind==='cylinder'?6:1} fill="#397da9" stroke="#6ab8e8" strokeWidth=".8"/>)}</svg>;
}
export default function ObjectEditor({parts,onChange,color,onColorChange}) {
    const [panel,setPanel]=useState('elements'),[query,setQuery]=useState('');
    const [selected,setSelected]=useState(0),[tool,setTool]=useState('translate');
    const [grid,setGrid]=useState(true),[fitVersion,setFitVersion]=useState(0);
    const [history,setHistory]=useState([]),[future,setFuture]=useState([]),[message,setMessage]=useState('');
    const gesture=useRef(null),liveParts=useRef(parts);
    useEffect(()=>{liveParts.current=parts;},[parts]);
    const p=parts[selected];
    const assembly=normalizeAssembly(parts);
    const commit=(next,before=parts)=>{if(assemblyOverlaps(next)){setMessage('Limite físico: essa alteração atravessaria outra peça.');return false;}setHistory(h=>[...h.slice(-39),clone(before)]);setFuture([]);onChange(next);setMessage('');return true;};
    const insert=(kind,at=null)=>{
        if(parts.length>=24)return;
        if(!names[kind])return;
        let next=createPrimitive(kind);
        if(at){
            next={...next,x:Math.round((at.x-next.width/2)/.05)*.05,y:at.y,z:Math.round((at.z-next.depth/2)/.05)*.05};
            if(parts.some(q=>partsOverlap(next,q))){setMessage('Espaço ocupado. Solte a forma numa área livre ou clique na biblioteca para anexar uma peça.');return;}
        } else if(parts.length){
            const anchor=parts[selected]||parts.at(-1);
            next={...next,x:anchor.x,y:anchor.y,z:anchor.z};
            const candidates=[{...next,x:anchor.x+anchor.width},{...next,y:anchor.y+anchor.height},{...next,z:anchor.z+anchor.depth},{...next,x:anchor.x-next.width},{...next,y:anchor.y-next.height},{...next,z:anchor.z-next.depth}];
            next=candidates.find(c=>!parts.some(q=>partsOverlap(c,q)));
            if(!next){setMessage('Arraste a forma da biblioteca para uma área livre.');return;}
        }
        if(commit([...parts,next])){setSelected(parts.length);setTool('translate');}
    };
    const undo=()=>{if(!history.length)return;setFuture(f=>[clone(parts),...f]);onChange(history.at(-1));setHistory(h=>h.slice(0,-1));setSelected(null);};
    const redo=()=>{if(!future.length)return;setHistory(h=>[...h,clone(parts)]);onChange(future[0]);setFuture(f=>f.slice(1));setSelected(null);};
    const start3D=()=>{gesture.current=clone(liveParts.current);};
    const transform3D=transform=>{
        const from=liveParts.current[selected];if(!from)return null;
        const limited=transformPart3D(from,transform,liveParts.current.filter((_,i)=>i!==selected),tool,grid);
        const next=liveParts.current.map((q,i)=>i===selected?limited.part:q);
        if(assemblyOverlaps(next))return from;
        liveParts.current=next;onChange(next);
        setMessage(limited.blocked?'Limite físico atingido: a peça parou no contato.':'');
        return limited.part;
    };
    const end3D=()=>{const before=gesture.current;gesture.current=null;if(before&&JSON.stringify(before)!==JSON.stringify(liveParts.current))commit(liveParts.current,before);};
    const cancel=()=>{if(gesture.current){liveParts.current=gesture.current;onChange(gesture.current);gesture.current=null;}};
    const duplicate=()=>{if(!p||parts.length>=24)return;const next=duplicateBeside(p,parts);if(!next){setMessage('Não há uma face livre para duplicar essa peça.');return;}if(commit([...parts,next]))setSelected(parts.length);};
    const remove=()=>{if(!p)return;commit(parts.filter((_,i)=>i!==selected));setSelected(null);};
    const change=(key,value)=>{if(!p||!Number.isFinite(value)||(['width','height','depth'].includes(key)&&value<=0))return;const limited=constrainTransform(p,{...p,[key]:value},parts.filter((_,i)=>i!==selected));commit(parts.map((q,i)=>i===selected?limited.part:q));if(limited.blocked)setMessage('Limite físico: o valor foi limitado pela peça vizinha.');};
    return <section className={styles.editor} aria-label="Editor visual de peças" onKeyDown={e=>{
        if(['INPUT','SELECT','TEXTAREA'].includes(e.target.tagName))return;
        if(e.key==='Escape'){cancel();setTool('translate');}
        if(e.key==='Delete'){e.preventDefault();remove();}
        if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='z'){e.preventDefault();if(e.shiftKey)redo();else undo();}
    }}>
        <div className={styles.toolbar} aria-label="Ferramentas de modelagem">
            <button type="button" title="Desfazer (Ctrl+Z)" disabled={!history.length} onClick={undo}><FiCornerUpLeft/> Desfazer</button>
            <button type="button" title="Refazer (Ctrl+Shift+Z)" disabled={!future.length} onClick={redo}><FiCornerUpRight/> Refazer</button>
            <span className={styles.divider}/><button type="button" aria-pressed={tool==='translate'} onClick={()=>setTool('translate')}><FiMousePointer/> Mover</button>
            <button type="button" aria-pressed={tool==='scale'} onClick={()=>setTool('scale')}>↔ Redimensionar</button><span className={styles.toolbarHint}>X · largura / Y · altura / Z · profundidade</span>
            <span className={styles.counter}>{parts.length}/24 peças</span>
        </div>
        <div className={styles.workspace}>
            <nav className={styles.rail} aria-label="Painéis do editor">
                {[['elements',FiGrid,'Elementos'],['templates',FiBox,'Modelos'],['layers',FiLayers,'Peças'],['help',FiHelpCircle,'Ajuda']].map(([key,Icon,label])=><button type="button" key={key} aria-pressed={panel===key} onClick={()=>{setPanel(key);setQuery('');}}><Icon/><span>{label}</span></button>)}
            </nav>
            <aside className={styles.library} aria-label="Biblioteca do editor">
                <h3>{({elements:'Elementos',templates:'Modelos prontos',layers:'Peças do objeto',help:'Vamos modelar?'})[panel]}</h3>
                {(panel==='elements'||panel==='templates')&&<label className={styles.search}><FiSearch/><input aria-label="Buscar na biblioteca" placeholder="Buscar formas ou modelos" value={query} onChange={e=>setQuery(e.target.value)}/></label>}
                {panel==='elements'&&<><p>Clique para adicionar. Ou arraste uma forma para o piso 3D.</p><div className={styles.cards}>
                    {Object.entries(names).filter(([,name])=>name.toLocaleLowerCase().includes(query.toLocaleLowerCase())).map(([kind,name])=><button type="button" key={kind} draggable disabled={parts.length>=24} onDragStart={e=>{e.dataTransfer.setData('application/optiload-shape',kind);e.dataTransfer.effectAllowed='copy';}} onClick={()=>insert(kind)}><svg className={styles.shapeIcon} viewBox="0 0 64 56" aria-hidden="true">{kind==='ellipsoid'?<ellipse cx="32" cy="28" rx="22" ry="22"/>:kind==='cylinder'?<><path d="M12 14 V42 C12 54 52 54 52 42 V14"/><ellipse cx="32" cy="14" rx="20" ry="8"/></>:kind==='prism'?<polygon points="32,4 54,16 54,40 32,52 10,40 10,16"/>:<rect x="9" y="11" width="46" height="34" rx="2"/>}</svg>{name}</button>)}
                </div><p>Adicione uma peça e use Mover ou Redimensionar. Esferas começam com os três diâmetros iguais.</p></>}
                {panel==='templates'&&<><p>Comece com um modelo e ajuste suas peças. Substitui o desenho atual; você pode desfazer.</p><div className={styles.cards}>{Object.entries(shapeNames).filter(([key,name])=>key!=='custom'&&name.toLocaleLowerCase().includes(query.toLocaleLowerCase())).map(([key,name])=><button type="button" key={key} onClick={()=>{const [w,h,d]=shapeDefaults[key];const next=presetParts(key,w,h,d).map(q=>Object.fromEntries(Object.entries(q).map(([k,v])=>[k,typeof v==='number'?Number(v.toFixed(9)):v])));if(commit(next)){setSelected(0);setTool('translate');setFitVersion(v=>v+1);}}}><ModelThumbnail shape={key}/>{name}</button>)}</div></>}
                {panel==='layers'&&<><p>Selecione uma peça para editar. A numeração corresponde ao desenho.</p><div className={styles.layers}>{parts.map((q,i)=><button key={i} type="button" aria-pressed={selected===i} onClick={()=>{setSelected(i);setTool('translate');}}>{icons[q.kind||'box']} Peça {i+1} · {names[q.kind||'box']}</button>)}</div></>}
                {panel==='help'&&<div className={styles.help}><strong>Um objeto, peça por peça</strong><p>1. Escolha uma forma ou um modelo pronto.</p><p>2. Arraste as peças para unir suas bordas.</p><p>3. Use Redimensionar e arraste os controles X, Y ou Z.</p><p>4. Arraste o fundo para girar a câmera. Use a roda para aproximar.</p><p>5. Confira o objeto em 3D e conclua nos dados da carga.</p><small>Delete exclui a seleção. Ctrl+Z desfaz. As peças não atravessam umas às outras e precisam estar conectadas para salvar.</small></div>}
            </aside>
            <div className={styles.drawing}>
                <div className={styles.viewbar}><span className={styles.pageTitle}>Modelagem 3D</span><button type="button" aria-pressed={grid} onClick={()=>setGrid(!grid)}>Encaixe 5 cm</button><button type="button" onClick={()=>setFitVersion(v=>v+1)}>Enquadrar objeto</button></div>
                <div className={styles.artboard}>
                    {p&&<div className={styles.floatingTools} aria-label="Ações da peça selecionada"><span>Peça {selected+1}</span><button type="button" aria-label="Duplicar peça" onClick={duplicate} disabled={parts.length>=24}><FiCopy/></button><button type="button" aria-label="Girar peça 90 graus" onClick={()=>commit(parts.map((q,i)=>i===selected?rotatePart(q):q))}><FiRotateCw/></button><button type="button" aria-label="Excluir peça" onClick={remove}><FiTrash2/></button></div>}
                    <ModelViewport3D parts={parts} selected={selected} color={color} mode={tool} grid={grid} fitVersion={fitVersion} onSelect={setSelected} onStart={start3D} onTransform={transform3D} onEnd={end3D} onDropShape={insert}/>
                </div>
                <div className={styles.status} role="status">{message || (tool==='translate'?'Arraste as setas para mover a peça nos três eixos.':'Arraste os quadrados X, Y ou Z para alterar uma dimensão. O controle central altera as três.')}<span>Arraste o fundo para girar · roda para zoom · botão direito para deslocar a câmera</span></div>
            </div>
            <aside className={styles.inspector}>
                <h3>{p?`Peça ${selected+1}`:'Propriedades'}</h3>
                <label>Cor do objeto<input aria-label="Cor do objeto" type="color" value={color} onChange={e=>onColorChange?.(e.target.value)}/></label>
                {!p&&<p>Selecione uma peça no desenho para ajustar suas medidas.</p>}
                {p&&<>
                    <div className={styles.dimensionFields}>{[['width','Largura · X'],['height','Altura · Y'],['depth','Profundidade · Z']].map(([key,label])=><label key={key}>{label} (m)<input aria-label={label} type="number" min=".05" step=".05" value={p[key]} onChange={e=>change(key,Number(e.target.value))}/></label>)}</div>
                    {p.kind==='ellipsoid'&&<p>Diâmetros iguais formam uma esfera. Altere qualquer um dos três para criar um oval.</p>}
                    {p.kind==='prism'&&<label>Lados da peça<select value={p.sides||6} onChange={e=>change('sides',Number(e.target.value))}>{Array.from({length:10},(_,i)=><option key={i} value={i+3}>{i+3}</option>)}</select></label>}
                    <details><summary>Ajustes precisos (opcional)</summary><div className={styles.precise}>{[['x','Posição X'],['y','Posição Y'],['z','Posição Z']].map(([key,label])=><label key={key}>{label}<input type="number" step=".01" min={['x','y','z'].includes(key)?undefined:.01} value={p[key]} onChange={e=>change(key,Number(e.target.value))}/></label>)}</div></details></>}
            </aside>
        </div>
        <p className={styles.note}>Dimensões do objeto: {assembly.width.toFixed(2)} × {assembly.height.toFixed(2)} × {assembly.depth.toFixed(2)} m. O contorno azul mostra o limite de proteção da peça selecionada. Formas curvas ainda usam contornos retangulares na colisão.</p>
    </section>;
}
