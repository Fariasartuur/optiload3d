import { useEffect, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Vector3 } from 'three';

const ACTIVITY_EVENTS = ['pointerdown', 'wheel', 'keydown', 'touchstart'];

/**
 * Gira a câmera em volta da carga quando ninguém interage com a cena por `delay` ms.
 * Qualquer clique, arraste, scroll ou tecla interrompe a rotação na hora.
 */
export default function IdleAutoRotate({ controlsRef, enabled = true, delay = 5000, speed = 1.2, focus = null }) {
    const lastActivity = useRef(0); // definido no efeito de `enabled`, que também roda na montagem
    const goal = useRef(new Vector3());

    useEffect(() => {
        const reset = () => { lastActivity.current = performance.now(); };
        // Arrastar a câmera começa com pointerdown, então os eventos da janela cobrem os controles.
        ACTIVITY_EVENTS.forEach(name => window.addEventListener(name, reset, { passive: true }));
        return () => ACTIVITY_EVENTS.forEach(name => window.removeEventListener(name, reset));
    }, []);

    // Ligar o recurso de novo conta como atividade: não começa a girar imediatamente.
    useEffect(() => { lastActivity.current = performance.now(); }, [enabled]);

    useFrame((_, delta) => {
        const controls = controlsRef.current;
        if (!controls) return;
        const idleFor = performance.now() - lastActivity.current - delay;
        if (!enabled || idleFor <= 0) {
            if (controls.autoRotate) controls.autoRotate = false;
            return;
        }
        controls.autoRotate = true;
        // Acelera ao longo de 1,5 s para não dar tranco.
        controls.autoRotateSpeed = speed * Math.min(1, idleFor / 1500);
        if (focus) {
            goal.current.set(focus[0], focus[1], focus[2]);
            controls.target.lerp(goal.current, 1 - Math.exp(-1.5 * delta));
        }
        // O OrbitControls do drei já chama controls.update() a cada quadro.
    });

    return null;
}
