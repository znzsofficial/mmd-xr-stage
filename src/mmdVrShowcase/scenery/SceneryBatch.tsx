import { useLayoutEffect, useRef } from "react";
import { Color, InstancedMesh, Object3D, type BufferGeometry, type MeshStandardMaterial, type Texture } from "three";

export type Part = { p: [number, number, number]; s: [number, number, number]; color: string; rx?: number; ry?: number; rz?: number };

export function Batch({ parts, round, lit, name, casts = false, foliage = false, geometry, shade, map, onInstancesReady }: { parts: Part[]; round?: boolean; lit?: boolean; name: string; casts?: boolean; foliage?: boolean; geometry?: BufferGeometry; shade?: MeshStandardMaterial['onBeforeCompile']; map?: Texture; onInstancesReady?:(mesh:InstancedMesh)=>()=>void }) {
  const ref = useRef<InstancedMesh>(null);
  useLayoutEffect(() => {
    const mesh = ref.current!;
    const pose = new Object3D(), color = new Color();
    parts.forEach(({ p, s, rx = 0, ry = 0, rz = 0, color: tint }, index) => {
      pose.position.set(...p); pose.scale.set(...s); pose.rotation.set(rx, ry, rz); pose.updateMatrix();
      mesh.setMatrixAt(index, pose.matrix); mesh.setColorAt(index, color.set(tint));
    });
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    mesh.computeBoundingSphere();
    return onInstancesReady?.(mesh);
  }, [parts,geometry,onInstancesReady]);
  return <instancedMesh ref={ref} args={[geometry, undefined, parts.length]} name={name} receiveShadow={!lit} castShadow={casts} raycast={() => null}>
    {geometry ? null : foliage ? <icosahedronGeometry args={[0.5, 1]} /> : round ? <cylinderGeometry args={[0.5, 0.5, 1, 16]} /> : <boxGeometry />}
    {lit ? <meshBasicMaterial /> : <meshStandardMaterial key={`${shade?.name??''}:${!!map}`} roughness={0.88} vertexColors={!!geometry?.hasAttribute('color')} {...(shade && {onBeforeCompile: shade})} map={map ?? null} />}
  </instancedMesh>;
}
