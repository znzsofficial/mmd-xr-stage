import {Vector3} from 'three';

const coat = /(?:^|[^a-z])(?:jackets?|coats?)(?=$|[^a-z])|外套|外衣|大衣|上着|ジャケット|コート/i;
const garment = /(?:^|[^a-z])(?:cloth(?:es|ing)?|fabric|garment)(?=$|[^a-z])|衣服|衣装|衣裝/i;
const accessory = /(?:^|[^a-z])(?:hair|tail|ribbon|sleeve|necklace|scarf|piaodai)|髪|髮|头发|尾|丝带|絲帶|飘带|飄帶|リボン|袖/i;
const hip = /^(?:下半身|腰|lowerbody|hips?|pelvis|waist)$/i;
const head = /^(?:頭|头|head)$/i;
const torso = /^(?:上半身[0-9０-９]*|下半身|腰|upperbody\d*|lowerbody|spine\d*|chest\d*|upperchest|hips?|pelvis|waist)$/i;

function names(item) {
  return [item?.name, item?.englishName, item?.userData?.mmdBoneName].filter(Boolean);
}

const labelText = name => name.normalize('NFKC').replace(/([a-z0-9])([A-Z])/g, '$1 $2');

// Accumulate area-weighted bind influence over original indexed draws. Dense
// seam tessellation must not make a tiny trim override the rest of the surface.
function garmentWeights(mesh, candidates) {
  const {index, attributes:{position, skinIndex, skinWeight}, groups} = mesh.geometry;
  const materials = [].concat(mesh.material), weights = new Map();
  if (!index || !position || !skinIndex || !skinWeight) return weights;
  const a = new Vector3(), b = new Vector3(), c = new Vector3();
  for (const {start, count, materialIndex} of groups) {
    const material = materials[materialIndex], label = labelText(material?.name ?? '');
    const outerwear = coat.test(label) && !accessory.test(label);
    const cloth = outerwear || (garment.test(label) && !accessory.test(label));
    const drawn = cloth && material.visible && material.opacity >= .001;
    for (let k = start; k + 2 < start + count; k += 3) {
      const ids = [index.getX(k), index.getX(k + 1), index.getX(k + 2)];
      let area;
      for (const id of ids) for (let slot = 0; slot < 4; slot++) {
        const bone = skinIndex.getComponent(id, slot), w = skinWeight.getComponent(id, slot);
        if (!(w > 0) || !candidates.has(bone)) continue;
        area ??= b.fromBufferAttribute(position, ids[1]).sub(a.fromBufferAttribute(position, ids[0]))
          .cross(c.fromBufferAttribute(position, ids[2]).sub(a)).length() / 6;
        if (!(area > 0) || !Number.isFinite(area)) continue;
        const weighted = w * area;
        let evidence = weights.get(bone);
        if (!evidence) { evidence = {total:0, cloth:0, coat:0, drawn:false}; weights.set(bone, evidence); }
        evidence.total += weighted;
        if (cloth) evidence.cloth += weighted;
        if (outerwear) evidence.coat += weighted;
        evidence.drawn ||= drawn && w >= .25;
      }
    }
  }
  return weights;
}

// Opt in only for a jacket/coat panel with several suspended strands joined
// across the fabric. A garment label alone also describes ribbons and hardware.
export function fitCoatBodies(mesh, bodies, joints, bindPosition) {
  const {bones} = mesh.skeleton;
  const selected = new Set(), dynamic = body => body?.mode.startsWith('dynamic');
  const materials = [].concat(mesh.material);
  const labels = bodies.map(body => labelText([...names(body), ...names(bones[body.boneIndex])].join(' ')));
  if (!labels.some(label => coat.test(label)) && !materials.some(m => coat.test(labelText(m?.name ?? '')))) return selected;

  const hipIndex = bones.findIndex(bone => names(bone).some(label => hip.test(label.replace(/[\s_-]+/g, ''))));
  const headIndex = bones.findIndex(bone => names(bone).some(label => head.test(label)));
  if (hipIndex < 0 || headIndex < 0) return selected;
  const pelvis = bindPosition(hipIndex), span = bindPosition(headIndex).y - pelvis.y;
  if (!(span > 0) || !Number.isFinite(span)) return selected;

  const adjacent = bodies.map(() => new Set()), dynamicByBone = new Map(), boneIndices = new Map(bones.map((bone, i) => [bone, i]));
  const positions = new Map();
  for (const [i, body] of bodies.entries()) if (dynamic(body) && bones[body.boneIndex]) {
    const bone = bones[body.boneIndex];
    if (!dynamicByBone.has(bone)) dynamicByBone.set(bone, []);
    dynamicByBone.get(bone).push(i);
    positions.set(i, bindPosition(body.boneIndex));
  }
  for (const {rigidBodyIndexA:a, rigidBodyIndexB:b} of joints) if (adjacent[a] && adjacent[b] && a !== b) {
    adjacent[a].add(b);
    adjacent[b].add(a);
  }

  const panels = [], visited = new Set();
  for (const i of positions.keys()) {
    if (visited.has(i)) continue;
    const panel = new Set([i]), roots = [], tips = [];
    for (const b of panel) {
      visited.add(b);
      for (const n of adjacent[b]) if (dynamic(bodies[n])) panel.add(n);
    }
    if (panel.size < 4 || panel.size > 4096) continue;
    const structural = [...panel].every(b => {
      const bone = bones[bodies[b].boneIndex], p = positions.get(b);
      if (!p || accessory.test(labels[b]) || dynamicByBone.get(bone).length !== 1) return false;
      if (Math.abs(p.x - pelvis.x) > .7 * span || Math.abs(p.z - pelvis.z) > .7 * span) return false;
      if (p.y > pelvis.y + .82 * span || p.y < pelvis.y - 1.5 * span) return false;

      const children = bone.children.flatMap(child => dynamicByBone.get(child) ?? []);
      if (children.length > 1 || children.some(c => !panel.has(c))) return false;
      if (!children.length) tips.push(b);
      const parents = dynamicByBone.get(bone.parent);
      const fixed = [...adjacent[b]].filter(n => !dynamic(bodies[n]));
      if (parents) return parents.length === 1 && adjacent[b].has(parents[0]) && !fixed.length
        && positions.get(parents[0]).distanceToSquared(p) > 1e-8 * span * span;
      if (!names(bone.parent).some(label => torso.test(label.replace(/[\s_-]+/g, '')))) return false;
      if (p.y < pelvis.y - .1 * span) return false;
      if (!fixed.length || fixed.some(n => bodies[n].mode !== 'static' || bodies[n].boneIndex !== boneIndices.get(bone.parent))) return false;
      roots.push(b);
      return true;
    });
    if (!structural || roots.length < 2 || tips.length !== roots.length) continue;

    // Two independent drops from the torso to hip level, with a real lateral
    // panel between them (across X or around the torso in Z).
    const hems = [], strands = [];
    for (const b of tips) {
      let root = b, strand = [b];
      for (let parent; (parent = dynamicByBone.get(bones[bodies[root].boneIndex].parent));) {
        root = parent[0];
        strand.push(root);
      }
      const p = positions.get(b), top = positions.get(root);
      if (top.y - p.y >= .18 * span && p.y <= pelvis.y + .1 * span) {
        hems.push(p);
        strands.push(strand);
      }
    }
    if (hems.length !== tips.length || !hems.some(a => hems.some(b => Math.hypot(a.x - b.x, a.z - b.z) >= .15 * span))) continue;
    panels.push(strands);
  }

  if (!panels.length) return selected;
  const weights = garmentWeights(mesh, new Set(panels.flat(2).map(b => bodies[b].boneIndex)));
  for (const strands of panels) {
    const supported = strands.every(strand => {
      const evidence = strand.map(b => weights.get(bodies[b].boneIndex));
      return evidence.every(e => e?.drawn && e.cloth >= .9 * e.total)
        && (strand.some(b => coat.test(labels[b])) || evidence.every(e => e.coat >= .9 * e.total));
    });
    if (supported) for (const b of strands.flat()) selected.add(b);
  }
  return selected;
}
