import { useMemo } from 'react';
import * as THREE from 'three';

export const edgesGeo = (visualWidth, visualHeight, visualDepth) => useMemo(
    () => new THREE.BoxGeometry(visualWidth, visualHeight, visualDepth),
    [visualWidth, visualHeight, visualDepth]
);
