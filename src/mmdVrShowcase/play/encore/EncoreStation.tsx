import { useFrame } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import type { ShaderMaterial } from 'three';
import { noPick } from '../../scenery/sceneryPaint';
import { badgeTexture, silkTexture } from './encorePrint';
import { BADGE_RADIUS, BADGE_X, BADGE_Y, BADGE_Z, useEncorePrint, type Wing } from './encoreRound';

function DyeWell({ side, stamped }: { side: Wing; stamped: boolean }) {
  const print = useMemo(() => badgeTexture(side, stamped), [side, stamped]);
  useEffect(() => () => print.dispose(), [print]);
  return <mesh name={`encore:target:${side}`} position={[side === 'left' ? -BADGE_X : BADGE_X, BADGE_Y, BADGE_Z]} raycast={noPick}>
    <planeGeometry args={[2 * BADGE_RADIUS, 2 * BADGE_RADIUS]} />
    <meshBasicMaterial map={print} alphaTest={.45} toneMapped={false} />
  </mesh>;
}

// Follow the folds of LiveHouse's cyclorama, just in front of the original.
// The ink front advances through the print; the artwork itself never stretches.
const silkVertex = `
  uniform float uRight;
  varying vec2 vUv;
  varying float vFront, vShade;
  void main() {
    vUv = uv;
    vec3 p = position;
    float wave = p.x * 17.0 + .22 * sin(p.x + uv.y * 2.0);
    p.z += .044 * sin(wave);
    vShade = .82 + .14 * sin(wave) + .105 * cos(wave);
    vFront = abs(uRight - uv.x) + .018 * sin(uv.y * 14.0) + .022 * sin(uv.y * 5.0);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
  }
`;
const silkFragment = `
  uniform float uReach;
  uniform sampler2D uPrint;
  varying vec2 vUv;
  varying float vFront, vShade;
  void main() {
    float wet = uReach - vFront;
    if (wet < 0.0) discard;
    vec3 dye = texture2D(uPrint, vUv).rgb;
    dye = mix(dye, vec3(.80,.58,.31), (1.0 - smoothstep(.001, .005, wet)) * .65);
    gl_FragColor = vec4(dye * vShade, 1.0);
    #include <colorspace_fragment>
  }
`;

function PrintedCurtain({ first, complete }: { first: Wing; complete: boolean }) {
  const ink = useMemo(() => silkTexture(first), [first]);
  useEffect(() => () => ink.dispose(), [ink]);
  const uniforms = useMemo(() => ({ uPrint: { value: ink }, uRight: { value: Number(first === 'right') }, uReach: { value: -.05 } }), [ink, first]);
  const material = useRef<ShaderMaterial>(null);
  useFrame((_, dt) => {
    if (!material.current) return;
    const reach = material.current.uniforms.uReach, stop = complete ? 1.06 : .33;
    if (reach.value < stop) reach.value = Math.min(stop, reach.value + Math.min(.06, dt) * .8);
  });
  return <mesh name={`encore:print:${first}`} position={[0, 2.125, -5.297]} raycast={noPick}>
    <planeGeometry args={[6.42, 4.19, 144, 12]} />
    <shaderMaterial ref={material} uniforms={uniforms} vertexShader={silkVertex} fragmentShader={silkFragment} toneMapped={false} />
  </mesh>;
}

/** Mount for the lifetime of Live House in either viewer, independently of the prop. */
export function EncoreStation() {
  const { first, complete } = useEncorePrint();
  return <group name="play:encore-station" pointerEvents="none">
    <DyeWell side="left" stamped={complete || first === 'left'} />
    <DyeWell side="right" stamped={complete || first === 'right'} />
    {first && <PrintedCurtain key={first} first={first} complete={complete} />}
  </group>;
}
