import { Matrix4, Ray, Triangle, Vector3, type Bone, type SkinnedMesh } from 'three';
import type { StockingSide } from './stockingState';
import type { StockingDraw } from './stockingDraws';
import { stockingSources } from './stockingSources';
import { stockingCoverage, type ChartPoint } from './stockingCoverage';
import { visibleTexel } from '../play/wandOpacity';

const sides: readonly StockingSide[] = ['left', 'right'];
const labels = (bone: Bone) => [bone.userData.mmdBoneName, bone.userData.mmdEnglishBoneName, bone.name]
  .filter((s): s is string => typeof s === 'string')
  .map(s => s.normalize('NFKC').toLowerCase().split(':').pop()!.replace(/[\s._-]/g, ''));

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
  const len = hip.distanceTo(ankle);
  if (!(len > 1e-5) || !(hip.y > knee.y && knee.y > ankle.y)) return null;
  const toe = toes.map(rest).find(p => Math.abs(p.z - ankle.z) > .025 * len && p.distanceTo(ankle) < .5 * len);
  const forward = toe ? Math.sign(toe.z - ankle.z) : 1;
  const weights = new Set([...hips, ...knees, ...ankles, ...toes]);
  for (const [i, b] of bones.entries()) if (weights.has(b.userData.mmdAppendTransform?.parentIndex)) weights.add(i);
  // A curved UV centreline only parametrizes the authored triangles; it
  // supplies neither their radius nor their displayed vertex positions.
  const top = knee.clone().lerp(hip, .78), heel = ankle.clone().lerp(knee, .20);
  const path = [hip, top, knee];
  if (toe) {
    const instep = ankle.clone().lerp(toe, .54);
    path.push(heel);
    for (let j = 1; j <= 8; j++) {
      const t = j / 8;
      path.push(heel.clone().lerp(ankle, t).lerp(ankle.clone().lerp(instep, t), t));
    }
    path.push(toe.clone().lerp(ankle, -.18));
  } else path.push(ankle);
  let length = 0;
  const sections = path.slice(1).map((end,i) => {
    const start = path[i], dir = end.clone().sub(start), size = dir.length(), from = length;
    length += size; dir.normalize();
    const lateral = new Vector3(1,0,0).addScaledVector(dir,-dir.x).normalize();
    const facing = dir.clone().cross(lateral).multiplyScalar(forward).normalize();
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
    return { u:x, v:y, distanceSq:best };
  }
  return { side, weights, len, uv, knee, ankleV:toe ? uv(ankle).v : .04 * len / span,
    instep:toe ? ankle.clone().lerp(toe,.65) : null,
    minimumLegSpan:.30 * len / span };
}

export type StockingPatch = {
  side: StockingSide; draw: StockingDraw; vertices: number[]; indices: number[]; fabricUv: number[]; sourceUv: number[]; length: number;
  rim: {vertex:number; other:number; fraction:number}[];
};

type Corner = ChartPoint & { i: number };
type Leg = NonNullable<ReturnType<typeof fitLeg>>;

function* chartTriangles(draw: StockingDraw, leg: Leg, other: Leg) {
  const g = draw.body.geometry, ix = g.index, { skinIndex: si, skinWeight: sw } = g.attributes;
  if (!si || !sw || si.itemSize !== 4 || sw.itemSize !== 4 || draw.position.count !== si.count || si.count !== sw.count) return;
  const cache = new Map<number,Corner | null>(), p = new Vector3();
  function sample(i: number) {
    if (cache.has(i)) return cache.get(i)!;
    let weight = 0, opposite = 0;
    for (let k = 0; k < 4; k++) {
      const joint = si.getComponent(i,k), w = sw.getComponent(i,k);
      if (leg.weights.has(joint)) weight += w;
      if (other.weights.has(joint)) opposite += w;
    }
    let corner: Corner | null = null;
    if (weight >= .30 && weight > opposite) {
      const {u,v,distanceSq} = leg.uv(p.fromBufferAttribute(draw.position,i));
      if (distanceSq < (.24 * leg.len) ** 2) corner = {i,u,v};
    }
    cache.set(i,corner); return corner;
  }
  const material = draw.material(), tri = new Triangle();
  for (let j = draw.start; j+2 < draw.end; j += 3) {
    const points = [sample(ix?.getX(j)??j),sample(ix?.getX(j+1)??j+1),sample(ix?.getX(j+2)??j+2)];
    if (!points.every(c => c !== null) || points.every(c => c.v >= 1)) continue;
    if (material.transparent || material.alphaTest) {
      tri.a.fromBufferAttribute(draw.position,points[0].i); tri.b.fromBufferAttribute(draw.position,points[1].i);
      tri.c.fromBufferAttribute(draw.position,points[2].i);
      if (!visibleTexel(material,g,j,tri,tri.getMidpoint(p),draw.uv)) continue;
    }
    const us = points.map(c => c.u), seam = Math.max(...us)-Math.min(...us) > .5;
    yield seam ? points.map(c => c.u < .5 ? {...c,u:c.u+1} : c) : points;
  }
}

function hasInstep(leg: Leg, charts: Map<StockingDraw,Corner[][]>, footFrom: number) {
  if (!leg.instep) return false;
  const {v} = leg.uv(leg.instep);
  if (footFrom >= (v+leg.ankleV)/2) return false;
  // A sloping ankle ring can reach the foot's UVs. Require a front-facing
  // original triangle under the middle of the foot, allowing for heel height.
  const ray = new Ray(leg.instep.clone(),new Vector3(0,-1,0)), hit = new Vector3(), tri = new Triangle();
  ray.origin.y += .12 * leg.len;
  for (const [draw,faces] of charts) for (const [a,b,c] of faces) {
    if (Math.min(a.v,b.v,c.v) > leg.ankleV || Math.max(a.v,b.v,c.v) < footFrom) continue;
    tri.a.fromBufferAttribute(draw.position,a.i); tri.b.fromBufferAttribute(draw.position,b.i); tri.c.fromBufferAttribute(draw.position,c.i);
    if (ray.intersectTriangle(tri.a,tri.b,tri.c,true,hit) && ray.origin.y-hit.y < .24 * leg.len) return true;
  }
  return false;
}

/** Clip the existing posed triangle edges at either end; no cap, fabricated
 * foot, or replacement skin is generated at a missing section. */
function cutPatch(draw: StockingDraw, leg: Leg, faces: Corner[][], from: number, to: number) {
  const patch: StockingPatch = { side:leg.side, draw, length:leg.len, vertices:[], indices:[], fabricUv:[], sourceUv:[], rim:[] };
  const mapped = new Map<number,number>(), clipped = new Map<string,number>();
  function corner(c: Corner) {
    const key = c.i*2+Number(c.u>=1), known = mapped.get(key);
    if (known !== undefined) return known;
    const vertex = patch.vertices.length; mapped.set(key,vertex); patch.vertices.push(c.i);
    patch.fabricUv.push(c.u,c.v); patch.sourceUv.push(draw.uv?.getX(c.i)??0,draw.uv?.getY(c.i)??0);
    return vertex;
  }
  function rim(a: Corner, b: Corner, v: number): number {
    if (b.i < a.i) return rim(b,a,v);
    const key = `${a.i}:${b.i}:${a.u>=1}:${b.u>=1}:${v===to}`, known = clipped.get(key);
    if (known !== undefined) return known;
    const t = (v-a.v)/(b.v-a.v), vertex = patch.vertices.length;
    patch.vertices.push(a.i); patch.rim.push({vertex,other:b.i,fraction:t});
    patch.fabricUv.push(a.u+(b.u-a.u)*t,v);
    const uv=draw.uv, x=uv?.getX(a.i)??0, y=uv?.getY(a.i)??0;
    patch.sourceUv.push(x+((uv?.getX(b.i)??0)-x)*t,y+((uv?.getY(b.i)??0)-y)*t);
    clipped.set(key,vertex); return vertex;
  }
  for (const face of faces) {
    if (face.every(c => c.v > to) || face.every(c => c.v < from)) continue;
    const polygon: number[] = [];
    for (let k = 0; k < 3; k++) {
      const a = face[k], b = face[(k+1)%3];
      if (a.v >= from && a.v <= to) polygon.push(corner(a));
      for (const v of a.v < b.v ? [from,to] : [to,from]) {
        if (Math.min(a.v,b.v) < v && v < Math.max(a.v,b.v)) polygon.push(rim(a,b,v));
      }
    }
    for (let k = 1; k+1 < polygon.length; k++) patch.indices.push(polygon[0],polygon[k],polygon[k+1]);
  }
  return patch;
}

export type StockingFitReason = 'leg-rig' | 'no-surface' | 'leg-coverage' | 'topology-limit';
export type StockingFitResult = { patches: null; reason: StockingFitReason }
  | { patches: StockingPatch[]; reason: null; foot: Record<StockingSide,boolean> };

export function inspectStockingFit(mesh: SkinnedMesh, draws: StockingDraw[]): StockingFitResult {
  const [left,right] = mesh.skeleton?.bones.length ? sides.map(side => fitLeg(mesh,side)) : [];
  if (!left || !right || left.knee.distanceTo(right.knee) < .04 * Math.min(left.len,right.len)) return { patches:null, reason:'leg-rig' };
  const candidates = stockingSources(mesh,draws);
  if (!candidates.length) return { patches:null, reason:'no-surface' };
  const limit = { patches:null, reason:'topology-limit' } as const;
  if (candidates.some(d => !d.position || d.position.count > 450_000) || candidates.reduce((n,d) => n+d.end-d.start,0) > 1_200_000) return limit;
  const patches: StockingPatch[] = [], foot = {left:false,right:false};
  let sourceTriangles = 0, outputTriangles = 0;
  for (const leg of [left,right]) {
    const coverage = stockingCoverage(), charts = new Map<StockingDraw,Corner[][]>();
    for (const draw of candidates) {
      const faces: Corner[][] = [];
      for (const face of chartTriangles(draw,leg,leg === left ? right : left)) {
        if (++sourceTriangles > 48_000) return limit;
        faces.push(face);
        // An edge crossing the centreline has no well-defined angle. Keep it
        // on a proven foot, but don't let it certify a flat card as a limb.
        const us = face.map(c => c.u);
        if (Math.max(...us)-Math.min(...us) < .35) coverage.add(face);
      }
      if (faces.length) charts.set(draw,faces);
    }
    const tube = coverage.longest(leg.ankleV,leg.minimumLegSpan);
    if (!tube) continue;
    foot[leg.side] = hasInstep(leg,charts,tube.footFrom);
    const from = foot[leg.side] ? tube.footFrom : Math.max(leg.ankleV,tube.from);
    for (const [draw,faces] of charts) {
      const patch = cutPatch(draw,leg,faces,from,tube.to);
      if ((outputTriangles += patch.indices.length/3) > 48_000) return limit;
      if (patch.indices.length) patches.push(patch);
    }
  }
  return patches.length ? { patches, reason:null, foot } : { patches:null, reason:'leg-coverage' };
}

export function fitStockings(mesh: SkinnedMesh, draws: StockingDraw[]) {
  return inspectStockingFit(mesh,draws).patches;
}
