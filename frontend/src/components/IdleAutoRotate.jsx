import { useEffect, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Vector3 } from 'three';

const ACTIVITY_EVENTS = ['pointerdown', 'wheel', 'keydown', 'touchstart'];

const MARGIN = 1.15; // folga em volta da carga no enquadramento

/**
 * Gira a câmera em volta da carga quando ninguém interage com a cena por `delay` ms.
 * Enquanto gira, mira no centro de `focus` e ajusta a distância aos poucos até a região
 * (esfera de raio `focus.radius`) caber na tela, mantendo a altura do ângulo de visão.
 * Qualquer clique, arraste, scroll ou tecla interrompe a rotação na hora.
 */
export default function IdleAutoRotate({ controlsRef, enabled = true, delay = 5000, speed = 1.2, focus = null }) {
    const lastActivity = useRef(0); // definido no efeito de `enabled`, que também roda na montagem
    const goal = useRef(new Vector3());
    const offset = useRef(new Vector3());

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
            const ease = 1 - Math.exp(-1.5 * delta);
            goal.current.fromArray(focus.center);
            controls.target.lerp(goal.current, ease);
            const camera = controls.object;
            // Distância em que a esfera da carga cabe no menor ângulo de visão (vertical ou horizontal).
            const vertical = (camera.fov * Math.PI) / 360;
            const horizontal = Math.atan(Math.tan(vertical) * camera.aspect);
            const framing = (focus.radius * MARGIN) / Math.sin(Math.min(vertical, horizontal));
            offset.current.subVectors(camera.position, controls.target);
            const distance = offset.current.length();
            if (distance > 1e-6) {
                offset.current.multiplyScalar((distance + (framing - distance) * ease) / distance);
                camera.position.addVectors(controls.target, offset.current);
            }
        }
        // O OrbitControls do drei já chama controls.update() a cada quadro.
    });

    return null;
}
