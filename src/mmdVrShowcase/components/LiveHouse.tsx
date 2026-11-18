import { useEffect, useLayoutEffect, useMemo, useRef } from "react";
import { Color, InstancedMesh, Object3D, PlaneGeometry } from "three";

type Part = { p: [number, number, number]; s: [number, number, number]; color: string; rx?: number; ry?: number; rz?: number };

function architecture(concert: boolean) {
  const blocks: Part[] = [];
  const lamps: Part[] = [];
  const cones: Part[] = [];
  const strips: Part[] = [];
  const box = (p: Part["p"], s: Part["s"], color: string, ry = 0, rz = 0) => blocks.push({ p, s, color, ry, rz });
  // An open proscenium: the deck surface stays at character foot height.
  box([0, -0.134, 0], [11.6, 0.26, 11.6], "#574e49");
  box([0, 2.3, -5.64], [11.6, 4.6, 0.25], "#27262e");
  const boards = ["#574b43", "#51473f", "#584d46", "#534a43", "#554941"];
  for (let i = 0; i < 34; i++) box([0, -0.003, (i - 16.5) * 0.34], [11.6, 0.006, 0.337], boards[i % boards.length]);
  for (const side of [-1, 1]) {
    const color = concert ? (side < 0 ? "#e49a64" : "#72a4c2") : "#cac1b1";
    for (let i = 0; i < 7; i++) {
      box([side * (3.4 + i * 0.30), 2.1, -5.2 + i * 0.07], [0.37, 4.2, 0.21], i % 2 ? "#5a3943" : "#412e37", side * 0.36);
    }
    // Acoustic cabinets and recessed drivers in front of the side drapes.
    for (const y of [0.55, 1.6]) {
      box([side * 4.55, y, -3.88], [0.84, 1.02, 0.68], "#24272b");
      cones.push({ p: [side * 4.55, y - 0.08, -3.53], s: [0.58, 0.034, 0.58], rx: Math.PI / 2, color: "#393e42" });
      box([side * 4.55, y + 0.32, -3.53], [0.43, 0.09, 0.04], "#13171c");
    }
    for (const x of [1.4, 2.9, 4.3]) {
      box([side * x, 3.95, -4.55], [0.28, 0.34, 0.38], "#272a2f");
      lamps.push({ p: [side * x, 3.91, -4.34], s: [0.21, 0.035, 0.21], rx: Math.PI / 2, color });
    }
    strips.push({ p: [side * 3.19, 1.97, -5.22], s: [0.035, 3.80, 0.04], color });
    box([side * 5.1, 2.12, -4.55], [0.13, 4.24, 0.13], "#3c4046");
  }
  for (const y of [4.12, 4.43]) box([0, y, -4.55], [10.4, 0.075, 0.095], "#54565b");
  for (let i = 0; i < 26; i++) box([(i - 12.5) * 0.39, 4.27, -4.55], [0.051, 0.49, 0.055], "#484b50", 0, (i % 2 ? 1 : -1) * 0.87);
  return { blocks, lamps, strips, cones };
}

// Bake the light wash into the drape vertices, not a transparent screen quad.
function Cyclorama({ concert }: { concert: boolean }) {
  const geometry = useMemo(() => {
    const geo = new PlaneGeometry(6.5, 4.25, 144, 16);
    const pos = geo.attributes.position;
    const colors = pos.clone();
    const base = new Color(concert ? "#332e45" : "#5b5461");
    const amber = new Color(concert ? "#c2886b" : "#837775");
    const blue = new Color(concert ? "#688faa" : "#717e89");
    const c = new Color();
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i), y = pos.getY(i), h = y / 4.25 + 0.5;
      const fold = Math.sin(x * 17 + 0.22 * Math.sin(x + h * 2));
      pos.setZ(i, 0.044 * fold);
      const wash = (center: number) => Math.exp(-(((x - center) / (1.05 + h * 0.5)) ** 2) - (((h - 0.80) / 0.72) ** 2));
      c.copy(base).lerp(amber, wash(-2.3)).lerp(blue, wash(2.3)).multiplyScalar(0.75 + 0.25 * (fold + 1) * 0.5);
      colors.setXYZ(i, c.r, c.g, c.b);
    }
    geo.setAttribute("color", colors);
    return geo;
  }, [concert]);
  useEffect(() => () => geometry.dispose(), [geometry]);
  return <mesh name="woven-backdrop" position={[0, 2.125, -5.32]} geometry={geometry} raycast={() => null}><meshBasicMaterial vertexColors /></mesh>;
}

function Batch({ parts, round, lit, name }: { parts: Part[]; round?: boolean; lit?: boolean; name: string }) {
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
  return <instancedMesh ref={ref} args={[undefined, undefined, parts.length]} name={name} receiveShadow={!lit} raycast={() => null}>
    {round ? <cylinderGeometry args={[0.5, 0.5, 1, 16]} /> : <boxGeometry />}
    {lit ? <meshBasicMaterial /> : <meshStandardMaterial roughness={0.88} />}
  </instancedMesh>;
}

export function LiveHouse({ concert }: { concert: boolean }) {
  const parts = useMemo(() => architecture(concert), [concert]);
  return <group name="live-house">
    <Cyclorama concert={concert} />
    <Batch parts={parts.blocks} name="deck-curtains-truss" />
    <Batch parts={parts.cones} name="speaker-drivers" round />
    <Batch parts={parts.lamps} name="stage-practicals" round lit />
    <Batch parts={parts.strips} name="wing-lights" lit />
  </group>;
}
