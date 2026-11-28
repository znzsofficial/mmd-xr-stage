import { BufferAttribute, Vector3 } from 'three';
import { seamEvidence, pairChartEdges } from './endfieldOutlineSeams.js';

// Physical pixels in ONE eye, near/far, at full artist strength. No minimum:
// a zero material morph, vertex edge scale or disabled PMX edge stays zero.
export const budgets = new Map(Object.entries({
  face: [.68, .26], skin: [.78, .32], hair: [1.05, .45],
  cloth: [.96, .38], leather: [.85, .36], metal: [.70, .29],
}));
const cosCrease = Math.cos(Math.PI / 4);

// Angle-weighted one-ring filter confined to a single authored slot. Open
// borders stay authored unless they pass the separate chart-continuity proof.
function smoothSlot(g, groups, shared, evidence, out, stats, headWeights) {
  const { position, normal, matricesSdefEnabled: sdef, matricesQdefEnabled: qdef } = g.attributes;
  const n = position.count, edges = new Map(), sums = new Map(), locked = new Set();
  const topology = evidence ? new Int32Array(n) : null; // original, INDEX-connected panel islands
  function root(i) {
    while (topology[i]>0) { const p=topology[i]-1; if(topology[p])topology[i]=topology[p]; i=p; }
    return i;
  }
  const p = [new Vector3(), new Vector3(), new Vector3()], N = p.map(() => new Vector3());
  const fn = new Vector3(), a = new Vector3(), b = new Vector3(), dir = new Vector3();
  const ids = [0,0,0];
  for (const {start, count} of groups) for (let j = start; j < start + count; j += 3) {
    for (let k = 0; k < 3; k++) {
      const i = ids[k] = g.index ? g.index.getX(j+k) : j+k;
      p[k].fromBufferAttribute(position, i);
      N[k].fromBufferAttribute(normal, i).normalize();
      if (!sums.has(i)) sums.set(i, new Vector3());
    }
    fn.crossVectors(a.subVectors(p[1],p[0]), b.subVectors(p[2],p[0]));
    if (fn.lengthSq() === 0) continue;
    fn.normalize();
    if (topology) {
      const r=root(ids[0]);
      for(const j of [ids[1],ids[2]]) {const other=root(j); if(other!==r)topology[other]=r+1;}
    }
    for (let k = 0; k < 3; k++) {
      const next = (k+1)%3, prev = (k+2)%3, i = ids[k], v = ids[next];
      const key = Math.min(i,v)*n + Math.max(i,v), edge = edges.get(key);
      if (!edge) edges.set(key, {i, v, face: fn.clone(), count: 1});
      else if (++edge.count !== 2 || edge.i === i || edge.face.dot(fn) < cosCrease) {
        locked.add(i); locked.add(v); // sharp hinge, flipped or nonmanifold pair
      }
      // Authored cheek/crease normals can intentionally differ from the face.
      if (fn.dot(N[k]) < cosCrease) { locked.add(i); continue; }
      const angle = a.subVectors(p[next],p[k]).angleTo(b.subVectors(p[prev],p[k]));
      const sum = sums.get(i);
      sum.addScaledVector(fn, angle);
      for (const other of [N[next], N[prev]]) {
        if (other.dot(N[k]) >= cosCrease) sum.addScaledVector(other, angle*.5);
      }
    }
  }
  const pairs = pairChartEdges(edges,evidence,locked,shared,out,normal,stats,root);
  const written = new Set();
  for (const [i,j] of pairs) {
    if (written.has(i)) continue;
    const ni = a.fromBufferAttribute(normal,i).normalize(), nj = b.fromBufferAttribute(normal,j).normalize();
    const before = ni.distanceToSquared(nj);
    // Already continuous at this chart border. Don't round an authored lip
    // merely because the UVs differ.
    if (before<=1e-10) continue;
    if (headWeights?.(i)) stats.headWeightedRepairs++;
    // Bind a single angle-weighted direction to both copies. Equal skin and
    // per-morph displacements keep them coincident without changing indices.
    dir.copy(sums.get(i)).add(sums.get(j)).normalize();
    dir.lerp(ni.add(nj).normalize(),.32).normalize();
    dir.toArray(out,i*4); dir.toArray(out,j*4); written.add(i); written.add(j);
    stats.repairedSeamPairs++;
  }
  for (const edge of edges.values()) if (edge.count === 1) { locked.add(edge.i); locked.add(edge.v); }
  for (const [i,sum] of sums) {
    const off = 4*i;
    if (!(out[off+3] > 0)) continue;
    stats.positiveEdgeVertices++;
    // r187's TSL facade uses its own surface skin path. Keep special-weight
    // vertices' original normal rather than inventing a second SDEF/QDEF rig.
    if (shared[i] || locked.has(i) || sdef?.getX(i) || qdef?.getX(i) || !sum.lengthSq()) continue;
    const authored = a.fromBufferAttribute(normal,i).normalize();
    dir.copy(authored).lerp(sum.normalize(), .68).normalize();
    if (dir.distanceToSquared(authored) < 1e-10) continue;
    dir.toArray(out, off); stats.smoothedVertices++;
  }
}

/** Before pipeline.attach: read dense authored geometry. No mutation; a failed
 * or skipped attach can simply drop this result. roles = Map<PMX slot, role>.
 * For sparse PMX, pass the exact model's source ArrayBuffer/Uint8Array in
 * pmxBytes. Without position morph evidence ambiguous chart borders stay put. */
export function prepareOutline(mesh, roles, { pmxBytes, headBones = outlineHeadBones(mesh), edges } = {}) {
  const g = mesh.geometry, { position, normal, mmdEdgeScale, skinWeight, skinIndex } = g.attributes;
  const materials = [mesh.material].flat();
  if (position.isStorageBufferAttribute || mesh.userData.mmdTslSparsePositionMorphs ||
      materials.some(m => m.userData.mmdTslMaterialUniforms)) throw Error('Prepare outlines before TSL attachment');
  const slots = [], selected = new Map();
  for (const [slot, role] of roles) {
    if (!budgets.has(role)) continue;
    const m = materials[slot]?.userData.mmdMaterial;
    const authoredEdge = edges ? edges[slot] : hasAuthoredEdge(m);
    const row = {slot, role, authoredEdge, positiveEdgeVertices: 0, smoothedVertices: 0,
      pairedSeamEdges: 0, repairedSeamPairs: 0, headWeightedRepairs: 0, styledDraws: 0};
    slots.push(row);
    if (authoredEdge) selected.set(slot, {row, groups: []});
  }
  const result = { geometry: g, height: 0, direction: null, stats: { slots } };
  if (!selected.size || !normal || normal.count !== position.count || g.morphAttributes.normal?.length) return result;
  const groups = g.groups, n = position.count, out = new Float32Array(n*4);
  const owner = new Int32Array(n).fill(-1), shared = new Uint8Array(n);
  for (const group of groups) {
    const slot = group.materialIndex ?? 0;
    selected.get(slot)?.groups.push(group);
    for (let j = group.start; j < group.start + group.count; j++) {
      const i = g.index ? g.index.getX(j) : j;
      if (owner[i] !== -1 && owner[i] !== slot) shared[i] = 1;
      owner[i] = slot;
    }
  }
  let lo = Infinity, hi = -Infinity;
  for (let i = 0; i < n; i++) {
    const y = position.getY(i); lo = Math.min(lo,y); hi = Math.max(hi,y);
    out[4*i] = normal.getX(i); out[4*i+1] = normal.getY(i); out[4*i+2] = normal.getZ(i);
    out[4*i+3] = Math.max(0, mmdEdgeScale?.getX(i) ?? 1);
  }
  if (!(hi > lo)) return result;
  const evidence = seamEvidence(mesh,pmxBytes);
  // The hood may share a slot with a coat; count actual repaired points in
  // the head's skin subtree rather than attributing an entire slot to it.
  const headWeights = !headBones.size || !skinWeight || !skinIndex ? null : i => {
    let w=0; for(let j=0;j<4;j++) if(headBones.has(skinIndex.getComponent(i,j)))w+=skinWeight.getComponent(i,j);
    return w>.5;
  };
  for (const {row, groups} of selected.values()) smoothSlot(g, groups, shared, evidence, out, row, headWeights);
  result.height = hi-lo; result.direction = new BufferAttribute(out,4);
  return result;
}

export function hasAuthoredEdge(m) {
  return m?.flags?.edge === true && m.edgeSize > 0 && m.edgeColor?.[3] > 0;
}

export function outlineHeadBones(mesh) {
  const bones=mesh.skeleton?.bones ?? [];
  const head=bones.find(b=>[b.name,b.userData.mmdEnglishBoneName].some(n=>['頭','head'].includes(n?.toLowerCase())));
  const ids=new Set(), indices=new Map(bones.map((b,i)=>[b,i]));
  head?.traverse(b=>ids.add(indices.get(b)));
  return ids;
}
