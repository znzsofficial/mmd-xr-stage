import { Matrix4, Vector3, type Bone, type Material, type SkinnedMesh } from 'three';
import type { StockingSide } from './stockingState';
import type { StockingDraw } from './stockingDraws';
import { garmentKeys } from './slots';

const sides: readonly StockingSide[] = ['left', 'right'];
const clamp = (v: number) => Math.max(0, Math.min(1, v));
const labels = (bone: Bone) => [bone.userData.mmdBoneName, bone.userData.mmdEnglishBoneName, bone.name]
  .filter((s): s is string => typeof s === 'string')
  .map(s => s.normalize('NFKC').toLowerCase().split(':').pop()!.replace(/[\s._-]/g, ''));

function bareMaterial(mat: Material) {
  const meta = mat.userData.mmdMaterial;
  const name = [mat.name, meta?.name, meta?.englishName].filter(Boolean).join(' ').normalize('NFKC');
  if (/stocking|sock|tights|hose|cloth|suit|dress|skirt|pants|legging|shoe|boot|band|ribbon|armor|armour|texture.?atlas|スカート|靴|タイツ|ソックス|ストッキング|服|裙|裤|褲|袜|襪|鞋|装饰|飾|带|帶|环|環/i.test(name)) return false;
  return /body|skin|bare|素体|素體|身体|身體|肌|皮肤|皮膚|素足|脚部|腿部|足裏|\b(?:legs?|feet|foot|toes?|nails?)\d*\b/i.test(name);
}

function fitLeg(mesh: SkinnedMesh, side: StockingSide) {
  const { bones, boneInverses } = mesh.skeleton, jp = side === 'left' ? '左' : '右';
  const names = bones.map(labels);
  const match = (en: string[], ja: string[]) => {
    const keys = [...en.flatMap(k => [side + k, k + side, k + side[0]]), ...ja.map(k => jp + k)];
    return names.flatMap((list, i) => list.some(n => keys.includes(n.replace(/(?:d\d*|補)$/, ''))) ? [i] : []);
  };
  const hips = match(['thigh','upleg','upperleg','leg'], ['足','大腿']), knees = match(['knee','shin','lowerleg'], ['ひざ','膝']);
  const ankles = match(['ankle','foot'], ['足首','脚踝']), toes = match(['toe','toes','toebase'], ['つま先','足先','足先ex']);
  if (!hips.length || !knees.length || !ankles.length) return null;
  const unbind = mesh.bindMatrix.clone().invert();
  const rest = (i: number) => new Vector3().setFromMatrixPosition(new Matrix4().copy(boneInverses[i]).invert()).applyMatrix4(unbind);
  const hip = rest(hips[0]), knee = rest(knees[0]), ankle = rest(ankles[0]);
  const len = hip.distanceTo(ankle), forward = new Vector3(0, 0, 1);
  if (!(len > 1e-5) || !(hip.y > knee.y && knee.y > ankle.y)) return null;
  const toe = toes.length ? rest(toes[0]) : ankle.clone().addScaledVector(forward, .18 * len).add(new Vector3(0, -.08 * len, 0));
  if (Math.abs(toe.z - ankle.z) < .025 * len) return null;
  forward.z = Math.sign(toe.z - ankle.z);
  const weights = new Set([...hips, ...knees, ...ankles, ...toes]);
  for (const [i, b] of bones.entries()) if (weights.has(b.userData.mmdAppendTransform?.parentIndex)) weights.add(i);
  // A curved UV centreline only parametrizes the authored triangles; it
  // supplies neither their radius nor their displayed vertex positions.
  const top = knee.clone().lerp(hip, .78), heel = ankle.clone().lerp(knee, .20), instep = ankle.clone().lerp(toe, .54);
  const path = [hip, top, knee, heel];
  for (let j = 1; j <= 8; j++) {
    const t = j / 8;
    path.push(heel.clone().lerp(ankle, t).lerp(ankle.clone().lerp(instep, t), t));
  }
  path.push(toe.clone().lerp(ankle, -.18));
  let length = 0;
  const sections = path.slice(1).map((end,i) => {
    const start = path[i], dir = end.clone().sub(start), size = dir.length(), from = length;
    length += size; dir.normalize();
    const lateral = new Vector3(1,0,0).addScaledVector(dir,-dir.x).normalize();
    const facing = dir.clone().cross(lateral).multiplyScalar(forward.z).normalize();
    return { start, dir, size, from, lateral, facing };
  });
  const span = length - hip.distanceTo(top), radial = new Vector3(), nearest = new Vector3();
  function uv(p: Vector3) {
    let best = Infinity, y = 0, x = 0;
    for (const s of sections) {
      const t = Math.max(0, Math.min(s.size, radial.subVectors(p,s.start).dot(s.dir)));
      nearest.copy(s.start).addScaledVector(s.dir,t); radial.subVectors(p,nearest);
      const d = radial.lengthSq(); if (d >= best) continue;
      best = d; y = (length - s.from - t) / span;
      x = .5 + Math.atan2(radial.dot(s.lateral), radial.dot(s.facing)) / (2 * Math.PI);
    }
    return { u:x, v:y };
  }
  return { side, weights, len, uv, hip, knee, ankle, toe };
}

export type StockingPatch = {
  side: StockingSide; draw: StockingDraw; vertices: number[]; indices: number[]; fabricUv: number[]; sourceUv: number[]; length: number;
  rim: {vertex:number; other:number; fraction:number}[];
};

type Corner = {i:number; u:number; v:number};

export function fitStockings(mesh: SkinnedMesh, draws: StockingDraw[]): StockingPatch[] | null {
  if (!mesh.skeleton?.bones.length) return null;
  const legs = sides.map(side => fitLeg(mesh, side));
  if (!legs[0] || !legs[1]) return null;
  const candidates=draws.filter(draw=>bareMaterial(draw.author)&&!garmentKeys(mesh)?.has(draw.key));
  // This opt-in layer evaluates exact PMX vertices on the CPU for both eyes.
  // Decline unbounded topology instead of installing a slow approximate rig.
  if (candidates.some(d=>!d.position || d.position.count>450_000) || candidates.reduce((n,d)=>n+d.end-d.start,0)>1_200_000) return null;
  const patches: StockingPatch[] = [], p = new Vector3(); let triangleCount=0;
  for (const leg of legs) {
    if (!leg) return null;
    const cover = [new Set<number>(), new Set<number>(), new Set<number>(), new Set<number>()];
    for (const draw of candidates) {
      const g = draw.body.geometry, ix = g.index, { skinIndex: si, skinWeight: sw } = g.attributes;
      if (!si || !sw || si.itemSize !== 4 || sw.itemSize !== 4 || !draw.position || draw.position.count !== si.count || draw.body.skeleton !== mesh.skeleton) continue;
      const patch: StockingPatch = { side: leg.side, draw, length:leg.len, vertices:[], indices:[], fabricUv:[], sourceUv:[], rim:[] };
      const chart = new Map<number,Corner | null>(), mapped = new Map<number,number>(), clipped = new Map<string,number>();
      function sample(i:number) {
        if (chart.has(i)) return chart.get(i)!;
        let weight = 0;
        for (let k=0;k<4;k++) if (leg!.weights.has(si.getComponent(i,k))) weight += sw.getComponent(i,k);
        const corner = weight >= .30 ? {i,...leg!.uv(p.fromBufferAttribute(draw.position,i))} : null;
        chart.set(i,corner); return corner;
      }
      function corner(c:Corner) {
        const key=c.i*2+Number(c.u>=1);
        let vertex=mapped.get(key);
        if (vertex===undefined) {
          vertex=patch.vertices.length; mapped.set(key,vertex); patch.vertices.push(c.i);
          patch.fabricUv.push(c.u,c.v); patch.sourceUv.push(draw.uv?.getX(c.i)??0,draw.uv?.getY(c.i)??0);
          const bin=c.v>.76&&c.v<=1?0:c.v>.38&&c.v<.6?1:c.v>.18&&c.v<.35?2:c.v>.025&&c.v<.13?3:-1;
          if (bin>=0) cover[bin].add(Math.floor(clamp(c.u%1)*8)%8);
        }
        return vertex;
      }
      // Cut the edge in the actual triangles. Relying on a transparent last
      // texel leaks the welt above the intended cut at lower mip levels.
      function rim(a:Corner,b:Corner) {
        if (b.i<a.i) return rim(b,a);
        const key=`${a.i}:${b.i}:${a.u>=1}:${b.u>=1}`, known=clipped.get(key);
        if (known!==undefined) return known;
        const t=(1-a.v)/(b.v-a.v), vertex=patch.vertices.length;
        patch.vertices.push(a.i); patch.rim.push({vertex,other:b.i,fraction:t});
        patch.fabricUv.push(a.u+(b.u-a.u)*t,1);
        const uv=draw.uv, x=uv?.getX(a.i)??0, y=uv?.getY(a.i)??0;
        patch.sourceUv.push(x+((uv?.getX(b.i)??0)-x)*t,y+((uv?.getY(b.i)??0)-y)*t);
        clipped.set(key,vertex); return vertex;
      }
      for (let j=draw.start;j+2<draw.end;j+=3) {
        const points=[sample(ix?.getX(j)??j),sample(ix?.getX(j+1)??j+1),sample(ix?.getX(j+2)??j+2)];
        if (!points.every(c=>c!==null) || points.every(c=>c.v>=1)) continue;
        const us=points.map(c=>c.u), seam=Math.max(...us)-Math.min(...us)>.5;
        const corners=seam?points.map(c=>c.u<.5?{...c,u:c.u+1}:c):points;
        const polygon:number[]=[];
        for (let k=0;k<3;k++) {
          const a=corners[k], b=corners[(k+1)%3];
          if (a.v<=1) polygon.push(corner(a));
          if ((a.v<1 && b.v>1) || (b.v<1 && a.v>1)) polygon.push(rim(a,b));
        }
        for(let k=1;k+1<polygon.length;k++) patch.indices.push(polygon[0],polygon[k],polygon[k+1]);
        if ((triangleCount+=polygon.length-2)>48_000) return null;
      }
      if (patch.indices.length) patches.push(patch);
    }
    // An ankle ring, a sliver of upper-thigh skin above a baked stocking, or
    // legs deleted under boots cannot supply the missing fabric or its holes.
    if (cover.some(b=>b.size<5)) return null;
  }
  return patches;
}
