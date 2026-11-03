// Normalized, simplified shapes. All measurements are in metres after scaling.
export const shapeNames = {
    box: 'Caixa / armário', table: 'Mesa', chair: 'Cadeira', sofa: 'Sofá', bed: 'Cama',
    fridge: 'Geladeira', stove: 'Fogão', washer: 'Máquina de lavar', drum: 'Tambor / cilindro',
    sphere: 'Bola / esfera', bag: 'Saco cheio', polygon: 'Prisma poligonal', custom: 'Criar meu objeto'
};
export const shapeDefaults = {
    box: [1,1,1,10], table: [1.6,.8,.9,25], chair: [.5,.95,.5,5], sofa: [2,.85,.85,45],
    bed: [1.4,1,2,40], fridge: [.7,1.8,.7,65], stove: [.6,.9,.6,35], washer: [.6,.9,.65,60],
    drum: [.6,.9,.6,20], sphere: [.45,.45,.45,2], bag: [.6,.8,.6,8], polygon: [.6,.7,.6,10]
};
export function presetParts(shape, width, height, depth) {
    const p = (x,y,z,w,h,d,kind='box',sides=6) => ({x,y,z,width:w,height:h,depth:d,kind,sides});
    if (shape === 'table' || shape === 'chair') {
        const t = Math.min(width,height,depth)*.08;
        const level = shape === 'table' ? height-t : height*.48;
        const parts = [p(0,level,0,width,t,depth)];
        for (const x of [0,width-t]) for (const z of [0,depth-t]) parts.push(p(x,0,z,t,level,t));
        if (shape === 'chair') parts.push(p(0,level+t,0,width,height-level-t,t));
        return parts;
    }
    let parts;
    if (shape === 'sofa') parts = [p(0,0,0,1,.25,1),p(0,.25,0,1,.75,.18),p(0,.25,.18,.15,.4,.82),p(.85,.25,.18,.15,.4,.82),p(.15,.25,.18,.7,.12,.82)];
    else if (shape === 'bed') parts = [p(0,0,0,1,1,.06),p(0,0,.06,1,.35,.94),p(0,.35,.06,1,.25,.94)];
    else if (shape === 'stove') parts = [p(0,0,0,1,.96,1), ...[.12,.62].flatMap(x => [.12,.62].map(z => p(x,.96,z,.26,.04,.26,'cylinder')))];
    else parts = [p(0,0,0,1,1,1,shape === 'sphere' || shape === 'bag' ? 'ellipsoid' : shape === 'drum' ? 'cylinder' : shape === 'polygon' ? 'prism' : 'box')];
    return parts.map(p => ({...p,x:p.x*width,y:p.y*height,z:p.z*depth,width:p.width*width,height:p.height*height,depth:p.depth*depth}));
}
export function partsOf(object) {
    return object.parts || presetParts(object.shape || 'box',object.width,object.height,object.depth);
}
export function normalizeCargo(raw, index = 0) {
    const shape = raw.shape || 'box';
    if (!Object.hasOwn(shapeNames,shape)) throw new Error('Tipo de objeto inválido.');
    const result = { ...raw, id: String(raw.id || `object-${crypto.randomUUID()}-${index}`), shape,
        color: raw.color || '#3498db', weight: Number(raw.weight ?? 10), delivery_order: Number(raw.delivery_order ?? 1),
        max_load: raw.max_load == null || raw.max_load === '' ? (shape === 'box' ? null : 0) : Number(raw.max_load), allow_rotation: raw.allow_rotation ?? true };
    for (const key of ['width','height','depth','x','y','z']) {
        result[key] = Number(raw[key] ?? (['x','y','z'].includes(key) ? 0 : NaN));
        if (!Number.isFinite(result[key]) || (['width','height','depth'].includes(key) ? result[key] <= 0 : result[key] < 0)) throw new Error('Dimensões devem ser positivas e posições não negativas, em metros.');
    }
    if (!Number.isFinite(result.weight) || result.weight <= 0 || !Number.isInteger(result.delivery_order) || result.delivery_order < 1
        || (result.max_load !== null && (!Number.isFinite(result.max_load) || result.max_load < 0))) throw new Error('Confira peso, ordem de entrega e carga máxima.');
    if (shape === 'box') {
        if (raw.parts?.length) throw new Error('Escolha Personalizado para usar peças.');
        result.parts = null; return result;
    }
    if (shape === 'custom' && !raw.parts?.length) throw new Error('Adicione peças ao objeto personalizado.');
    result.parts = partsOf(result).map(p => ({...Object.fromEntries(['x','y','z','width','height','depth'].map(k => [k, Number(p[k] ?? (['x','y','z'].includes(k) ? 0 : NaN))])),
        kind:p.kind || 'box', sides:Number(p.sides ?? 6), yaw:Number(p.yaw ?? 0)}));
    if (!result.parts.length || result.parts.length > 24) throw new Error('Use de 1 a 24 peças por objeto.');
    const eps = Math.min(result.width,result.height,result.depth)*1e-8;
    for (const p of result.parts) {
        if (['x','y','z','width','height','depth'].some(k => !Number.isFinite(p[k])) || Math.min(p.width,p.height,p.depth) <= 0 || Math.min(p.x,p.y,p.z) < 0) throw new Error('Confira dimensões e posições das peças.');
        if (!['box','ellipsoid','cylinder','prism'].includes(p.kind) || !Number.isInteger(p.sides) || p.sides < 3 || p.sides > 12 || !Number.isInteger(p.yaw) || p.yaw < 0 || p.yaw > 3) throw new Error('Forma, lados (3 a 12) ou rotação da peça inválidos.');
    }
    for (const [a,s] of [['x','width'],['y','height'],['z','depth']]) {
        if (Math.abs(Math.min(...result.parts.map(p => p[a]))) > eps || Math.abs(Math.max(...result.parts.map(p => p[a]+p[s]))-result[s]) > eps) throw new Error('As peças devem começar em (0,0,0) e coincidir com as dimensões externas.');
    }
    const neighbors=result.parts.map(() => []);
    result.parts.forEach((p,i) => result.parts.slice(0,i).forEach((q,j) => {
        const o=[['x','width'],['y','height'],['z','depth']].map(([a,s]) => Math.min(p[a]+p[s],q[a]+q[s])-Math.max(p[a],q[a]));
        if (o.every(v => v > eps)) throw new Error('Há peças sobrepostas. Afaste-as ou use o encaixe pelas bordas.');
        if (o.every(v => v >= -eps) && o.filter(v => v > eps).length === 2) { neighbors[i].push(j); neighbors[j].push(i); }
    }));
    const seen=new Set(),pending=[0];
    while(pending.length) { const i=pending.pop(); if(!seen.has(i)) { seen.add(i);pending.push(...neighbors[i]); } }
    if(seen.size !== result.parts.length) throw new Error('Há peças separadas. Arraste até encostar as bordas para unir o objeto.');
    return result;
}
