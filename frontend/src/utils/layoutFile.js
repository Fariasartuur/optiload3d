import { normalizeCargo } from './cargo.js';

export function serializeLayout(name, scene) {
    return JSON.stringify({ format: 'optiload3d', version: 1, name, scene }, null, 2);
}

export function readLayout(text) {
    let file;
    try { file = JSON.parse(text.replace(/^\uFEFF/, '')); }
    catch { throw new Error('O arquivo não contém JSON válido.'); }
    if (Array.isArray(file)) throw new Error('Esta é uma lista de objetos. Importe-a pelo Estúdio.');
    if (file?.format !== undefined && (file.format !== 'optiload3d' || file.version !== 1)) {
        throw new Error('Formato ou versão de organização incompatível.');
    }
    const scene = file?.scene ?? file;
    if (!Array.isArray(scene?.trucks) || !scene.trucks.length) throw new Error('O arquivo precisa conter uma organização com caminhões.');
    const ids = new Set();
    const trucks = scene.trucks.map(truck => {
        if (!truck || typeof truck.id !== 'string' || !truck.id || ids.has(truck.id) ||
            ![truck.width, truck.height, truck.depth].every(v => Number.isFinite(v) && v > 0)) {
            throw new Error('Confira as dimensões e os identificadores dos caminhões.');
        }
        ids.add(truck.id);
        if (truck.position && !['x','y','z'].every(k => Number.isFinite(truck.position[k]))) {
            throw new Error('Posição do caminhão inválida.');
        }
        const cargoIds = new Set();
        function readObjects(items = []) {
            if (!Array.isArray(items)) throw new Error('Lista de objetos inválida.');
            return items.map(item => {
                const object = normalizeCargo(item);
                if (cargoIds.has(object.id)) throw new Error('Há objetos com o mesmo ID no caminhão.');
                cargoIds.add(object.id);
                if (object.name != null && typeof object.name !== 'string') throw new Error('Nome de objeto inválido.');
                return object;
            });
        }
        const boxes = readObjects(truck.boxes);
        const unpackedBoxes = readObjects(truck.unpackedBoxes);
        return { ...truck, boxes, unpackedBoxes, unpackedCount: unpackedBoxes.length,
            transportAssessment: null, staticStability: null };
    });
    if (scene.camera != null && ![scene.camera.position, scene.camera.target].every(
        v => Array.isArray(v) && v.length === 3 && v.every(Number.isFinite))) {
        throw new Error('Câmera da organização inválida.');
    }
    if (scene.selectedTruckId != null && !ids.has(scene.selectedTruckId)) throw new Error('Caminhão selecionado inválido.');
    return { name: typeof file.name === 'string' ? file.name : '', scene: { ...scene, trucks } };
}
