import * as THREE from 'three';

const shadeColor = (hex, percent) => {
    const num = parseInt(hex.replace('#', ''), 16);
    const r = Math.min(255, Math.max(0, (num >> 16) + Math.round(255 * (percent / 100))));
    const g = Math.min(255, Math.max(0, ((num >> 8) & 0x00ff) + Math.round(255 * (percent / 100))));
    const b = Math.min(255, Math.max(0, (num & 0x0000ff) + Math.round(255 * (percent / 100))));
    return `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1)}`;
};

const StyledContainer = ({ visualW, visualH, visualD, isSelected, color }) => {
    const baseColor = color || "#2980b9"; // azul container como padrão

    const containerColor = isSelected ? "#3498db" : baseColor;
    const trimColor = isSelected ? "#2874a6" : shadeColor(baseColor, -25);
    const corrugationColor = isSelected ? "#5dade2" : shadeColor(baseColor, 15);

    const cornerSize = Math.min(visualW, visualH, visualD) * 0.06;
    const barThickness = 0.025;

    // Número de "ondulações" (barras verticais) por face lateral
    const ribCount = Math.max(4, Math.round(visualD / 0.6));
    const ribSpacingZ = visualD / (ribCount + 1);

    const halfW = visualW / 2;
    const halfH = visualH / 2;
    const halfD = visualD / 2;

    return (
        <group>
            {/* Cantos reforçados (corner castings) - 8 vértices */}
            {[-1, 1].map((sx) =>
                [-1, 1].map((sy) =>
                    [-1, 1].map((sz) => (
                        <mesh
                            key={`${sx}-${sy}-${sz}`}
                            position={[sx * (halfW - cornerSize / 2), sy * (halfH - cornerSize / 2), sz * (halfD - cornerSize / 2)]}
                            castShadow
                        >
                            <boxGeometry args={[cornerSize, cornerSize, cornerSize]} />
                            <meshStandardMaterial color={trimColor} roughness={0.5} metalness={0.4} />
                        </mesh>
                    ))
                )
            )}

            {/* Vigas horizontais superior e inferior (moldura ao redor do perímetro) */}
            {[-1, 1].map((sy) => (
                <group key={`frame-${sy}`}>
                    {/* Frente e trás (largura) */}
                    {[-1, 1].map((sz) => (
                        <mesh key={`fb-${sz}`} position={[0, sy * halfH, sz * halfD]} castShadow>
                            <boxGeometry args={[visualW, barThickness * 2, barThickness * 2]} />
                            <meshStandardMaterial color={trimColor} roughness={0.5} metalness={0.4} />
                        </mesh>
                    ))}
                    {/* Laterais (profundidade) */}
                    {[-1, 1].map((sx) => (
                        <mesh key={`lr-${sx}`} position={[sx * halfW, sy * halfH, 0]} castShadow>
                            <boxGeometry args={[barThickness * 2, barThickness * 2, visualD]} />
                            <meshStandardMaterial color={trimColor} roughness={0.5} metalness={0.4} />
                        </mesh>
                    ))}
                </group>
            ))}

            {/* Paredes transparentes do container */}
            <mesh position={[0, 0, 0]}>
                <boxGeometry args={[visualW, visualH, visualD]} />
                <meshStandardMaterial
                    color={containerColor}
                    transparent
                    opacity={0.2}
                    roughness={0.5}
                    metalness={0.1}
                    depthWrite={false}
                    side={THREE.DoubleSide}
                />
            </mesh>

            {/* Vigas verticais nos 4 cantos (conectando as molduras superior/inferior) */}
            {[-1, 1].map((sx) =>
                [-1, 1].map((sz) => (
                    <mesh key={`v-${sx}-${sz}`} position={[sx * halfW, 0, sz * halfD]} castShadow>
                        <boxGeometry args={[barThickness * 2, visualH, barThickness * 2]} />
                        <meshStandardMaterial color={trimColor} roughness={0.5} metalness={0.4} />
                    </mesh>
                ))
            )}

            {/* Ondulações verticais (corrugado) nas duas laterais */}
            {[-1, 1].map((sx) =>
                Array.from({ length: ribCount }).map((_, i) => {
                    const z = -halfD + ribSpacingZ * (i + 1);
                    return (
                        <mesh
                            key={`rib-${sx}-${i}`}
                            position={[sx * (halfW - 0.005), 0, z]}
                            castShadow
                        >
                            <boxGeometry args={[barThickness, visualH * 0.94, barThickness * 1.5]} />
                            <meshStandardMaterial color={corrugationColor} roughness={0.6} metalness={0.2} />
                        </mesh>
                    );
                })
            )}

            {/* Portas traseiras - moldura sugerindo duas folhas de porta */}
            <mesh position={[0, 0, halfD + 0.01]}>
                <boxGeometry args={[barThickness * 1.5, visualH * 0.9, barThickness]} />
                <meshStandardMaterial color={trimColor} roughness={0.5} metalness={0.4} />
            </mesh>
            {/* Trincos das portas */}
            {[-1, 1].map((sx) => (
                <mesh key={`latch-${sx}`} position={[sx * halfW * 0.35, 0, halfD + 0.015]} castShadow>
                    <boxGeometry args={[0.04, visualH * 0.5, 0.04]} />
                    <meshStandardMaterial color="#2c2c2c" roughness={0.5} metalness={0.6} />
                </mesh>
            ))}

            {/* Ranhuras/textura sutil no teto */}
            <mesh position={[0, halfH - 0.005, 0]}>
                <boxGeometry args={[visualW, 0.02, visualD]} />
                <meshStandardMaterial color={containerColor} roughness={0.5} metalness={0.15} transparent opacity={0.3} />
            </mesh>
        </group>
    );
};

export default StyledContainer;