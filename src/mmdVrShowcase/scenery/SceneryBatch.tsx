import { useLayoutEffect, useRef } from "react";
import { Color, InstancedMesh, Object3D } from "three";

export type Part = { p: [number, number, number]; s: [number, number, number]; color: string; rx?: number; ry?: number; rz?: number };

export function Batch({ parts, round, lit, name, casts = false, foliage = false }: { parts: Part[]; round?: boolean; lit?: boolean; name: string; casts?: boolean; foliage?: boolean }) {
  const ref = useRef<InstancedMesh>(null);
  useLayoutEffect(() => {
    const mesh = ref.current!;
    const pose = new Object3D(), color = new Color();
    parts.forEach(({ p, s, rx = 0, ry = 0, rz = 0, color: tint }, index) => {
      pose.position.set(...p); pose.scale.set(...s); pose.rotation.set(rx, ry, rz); pose.updateMatrix();
      mesh.setMatrixAt(index, pose.matrix); mesh.setColorAt(index, color.set(tint));
    });
    mesh.instanceMatrix.needsUpdate = true;
    mesh.instanceColor!.needsUpdate = true;
    mesh.computeBoundingSphere();
  }, [parts]);
  return <instancedMesh ref={ref} args={[undefined, undefined, parts.length]} name={name} receiveShadow={!lit} castShadow={casts} raycast={() => null}>
    {foliage ? <icosahedronGeometry args={[0.5, 1]} /> : round ? <cylinderGeometry args={[0.5, 0.5, 1, 16]} /> : <boxGeometry />}
    {lit ? <meshBasicMaterial /> : <meshStandardMaterial roughness={0.88} />}
  </instancedMesh>;
}
