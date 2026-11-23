import type { MmdAnimation, ThreeMmdAnimation, ThreeMmdModel } from '@yohawing/three-mmd-loader';
import { Bone, Quaternion, Vector3 } from 'three';
import { bindPoseClip, type ClipSnapshot } from './poseClip';
import { posePresets, type PosePresetId } from './presetCatalog';
import { fitPresets } from './presetFit';

const wrists = ['leftHand', 'rightHand'] as const;
export type WristKey = typeof wrists[number];
export type PoseKey = 'pelvis' | 'torso' | 'head' | WristKey | 'leftFoot' | 'rightFoot';
const isWrist = (key: PoseKey): key is WristKey => key === 'leftHand' || key === 'rightHand';
export type PoseAxis = 'x' | 'y' | 'z' | Vector3;
type Pin = { position: [number, number, number]; rotation: [number, number, number, number] };
type WristTargets = Partial<Record<WristKey, Pin>>;
export type PoseSnapshot = ClipSnapshot & { feetLocked: boolean; soles?: Partial<Record<'leftFoot'|'rightFoot', Pin>>; poles: Partial<Record<PoseKey, [number, number, number]>>; wrists: WristTargets };
export type PoseSolver = ReturnType<typeof createPoseSolver>;
type Limb = { base: Bone; joint: Bone; tip: Bone; pole: Vector3 };
type Anchor = { p: Vector3; q: Quaternion };
const ordered: readonly PoseKey[] = ['pelvis', 'torso', 'head', 'leftHand', 'rightHand', 'leftFoot', 'rightFoot'];
const feet = ['leftFoot', 'rightFoot'] as const;
const wp = (b: Bone) => b.getWorldPosition(new Vector3()); // solver's isolated mesh space
const wq = (b: Bone) => b.getWorldQuaternion(new Quaternion()).normalize();
const valid = (v: Vector3) => Number.isFinite(v.x) && Number.isFinite(v.y) && Number.isFinite(v.z);
function ancestor(parent: Bone | undefined, child: Bone | undefined) {
  if (!parent || !child) return false;
  for (let p = child.parent; p; p = p.parent) if (p === parent) return true;
  return false;
}
function perpendicular(axis: Vector3, pole: Vector3) {
  const project = () => pole.addScaledVector(axis, -axis.dot(pole));
  project();
  if (pole.lengthSq() < 1e-12) { pole.set(0, 1, 0); project(); }
  if (pole.lengthSq() < 1e-12) { pole.set(1, 0, 0); project(); }
  return pole.normalize();
}

/** All solves take place in unscaled actor space. Only the API boundary uses
 * scene coordinates, so e.g. moving a 0.1-scale rotated actor does not change
 * its limb lengths or store world-space placements in a saved pose. */
export function createPoseSolver(model: ThreeMmdModel, originalAnimation: ThreeMmdAnimation | MmdAnimation | null,
  seconds: number, sourceIk = originalAnimation !== null) {
  const clip = bindPoseClip(model, originalAnimation, seconds, sourceIk);
  try { return attachControls(model, clip); }
  catch (error) {
    try { clip.restore(); } catch (rollback) { throw new AggregateError([error, rollback], 'Pose setup and restoration failed'); }
    throw error;
  }
}

function attachControls(model: ThreeMmdModel, clip: ReturnType<typeof bindPoseClip>) {
  const bones = clip.mesh.skeleton.bones, index = new Map(bones.map((b, i) => [b, i]));
  const aliases = new Map<string, Bone>();
  const normalize = (s: string) => s.normalize('NFKC').toLowerCase().replace(/^mixamorig[:_]?/, '').replace(/[\s_.-]/g, '');
  for (const b of bones) for (const name of [b.userData.mmdBoneName, b.userData.mmdEnglishBoneName, b.name]) {
    if (typeof name === 'string' && name && !aliases.has(normalize(name))) aliases.set(normalize(name), b);
  }
  function find(...names: string[]) { for (const n of names) { const b = aliases.get(normalize(n)); if (b) return b; } }
  const control: Partial<Record<PoseKey, Bone | undefined>> = {
    pelvis: find('hips', 'pelvis', 'センター', 'center', 'グルーブ', 'groove', '腰', 'waist', '下半身', 'lowerbody'), head: find('頭', 'head'),
    torso: find('上半身', 'upperbody', 'spine', '胸', 'chest', '上半身2', 'upperchest'),
  };
  if (control.torso === control.pelvis) delete control.torso;
  const neck = find('首', 'neck');
  const limb: Partial<Record<PoseKey, Limb>> = {};
  for (const side of ['left', 'right'] as const) {
    const jp = side === 'left' ? '左' : '右', s = side[0];
    const sided = (ja: string[], en: string[]) => find(...ja.map(n => jp + n), ...en.flatMap(n => [side + n, n + s, s + n]));
    for (const kind of ['Hand', 'Foot'] as const) {
      const hand = kind === 'Hand';
      const tip = hand ? sided(['手首'], ['wrist', 'hand']) : sided(['足首'], ['ankle', 'foot']);
      const joint = hand ? sided(['ひじ', '肘'], ['elbow', 'forearm', 'lowerarm']) : sided(['ひざ', '膝'], ['knee', 'shin', 'calf', 'lowerleg', 'leg']);
      const base = hand ? sided(['腕'], ['upperarm', 'arm']) : sided(['足'], ['upperleg', 'upleg', 'thigh', 'leg']);
      const key = `${side}${kind}` as const;
      control[key] = tip;
      if (!base || !joint || !tip || !ancestor(base, joint) || !ancestor(joint, tip)) continue;
      const a = wp(base), b = wp(joint), c = wp(tip);
      if (a.distanceToSquared(b) < 1e-12 || b.distanceToSquared(c) < 1e-12) continue;
      const axis = c.sub(a).normalize(), pole = b.sub(a); pole.addScaledVector(axis, -pole.dot(axis));
      if (pole.lengthSq() < 1e-10) pole.set(0, 0, hand ? -1 : 1); // Three mirrors PMX Z
      limb[key] = { base, joint, tip, pole: perpendicular(axis, pole) };
    }
  }
  const keys: readonly PoseKey[] = ordered.filter(k => control[k]);
  const headMovable = !!neck && !!control.head && ancestor(neck, control.head) && wp(neck).distanceToSquared(wp(control.head)) > 1e-12;
  let active = true, feetLocked = false;
  const soles = new Map<typeof feet[number], Anchor>();
  const wristTargets = new Map<WristKey, Anchor>();
  const preset = fitPresets(model.mesh,clip,limb,control.head,control.torso,neck);
  const failedPresets = new Set<PosePresetId>();
  function canPreset(id:PosePresetId){return active && !!preset && posePresets.some(p=>p.id===id) && !failedPresets.has(id);}
  function applyPreset(id:PosePresetId){
    if(!preset||!canPreset(id))return false;
    const before=capture();
    try {
      if(preset(id)){lockFeet(false);wristTargets.clear();return true;}
    } catch { /* An unusable grant/skin must not leave half a posture. */ }
    apply(before);failedPresets.add(id);return false;
  }

  function point(key: PoseKey, out: Vector3) {
    const b = control[key]; if (!active || !b) return false;
    b.getWorldPosition(out); model.mesh.localToWorld(out); return true;
  }
  function canMove(key: PoseKey) {
    if (!active || !control[key]) return false;
    if (key === 'pelvis') return true;
    if (key === 'head') return headMovable;
    return !!limb[key] && !(feetLocked && key.endsWith('Foot'));
  }
  function orient(b: Bone, target: Quaternion) {
    const local = b.parent!.getWorldQuaternion(new Quaternion()).invert().multiply(target).normalize();
    clip.set(index.get(b)!, b.position, local);
  }
  function swing(b: Bone, child: Bone, target: Vector3) {
    const pivot = wp(b), from = wp(child).sub(pivot), to = target.clone().sub(pivot);
    if (from.lengthSq() < 1e-16 || to.lengthSq() < 1e-16) return;
    orient(b, new Quaternion().setFromUnitVectors(from.normalize(), to.normalize()).multiply(wq(b)));
  }
  function solve(chain: Limb, target: Vector3, swivel = 0) {
    const { base, joint, tip, pole } = chain, a = wp(base), b = wp(joint), c = wp(tip);
    const l1 = a.distanceTo(b), l2 = b.distanceTo(c), oldAxis = c.clone().sub(a).normalize();
    const ray = target.clone().sub(a), desired = ray.length();
    if (desired < 1e-10) ray.copy(oldAxis.lengthSq() ? oldAxis : new Vector3(0, -1, 0)); else ray.divideScalar(desired);
    const d = Math.max(1e-8, Math.abs(l1 - l2), Math.min(l1 + l2, desired));
    const reachable = a.clone().addScaledVector(ray, d);
    // Includes an already straight arm holding a target beyond its reach.
    if (!swivel && c.distanceToSquared(reachable) <= ((l1 + l2) * 1e-7) ** 2) return;
    // Transport the current bend plane to the new axis; projecting the old
    // elbow onto the *new* axis would flip the joint during a straight drag.
    const actualPole = b.sub(a); actualPole.addScaledVector(oldAxis, -oldAxis.dot(actualPole));
    if (actualPole.lengthSq() > (l1 * 1e-5) ** 2) pole.copy(actualPole).normalize();
    if (oldAxis.lengthSq()) pole.applyQuaternion(new Quaternion().setFromUnitVectors(oldAxis, ray));
    perpendicular(ray, pole).applyAxisAngle(ray, swivel);
    const along = (l1 * l1 + d * d - l2 * l2) / (2 * d), height = Math.sqrt(Math.max(0, l1 * l1 - along * along));
    swing(base, joint, a.clone().addScaledVector(ray, along).addScaledVector(pole, height));
    swing(joint, tip, reachable);
  }
  function lockFeet(locked: boolean) {
    if (!active) return;
    soles.clear();
    if (locked) for (const k of feet) { const l = limb[k]; if (l) soles.set(k, { p: wp(l.tip), q: wq(l.tip) }); }
    feetLocked = soles.size > 0;
  }
  function pinWrist(key: WristKey, pinned: boolean) {
    const l = limb[key]; if (!active || !isWrist(key) || !l || pinned === wristTargets.has(key)) return false;
    if (pinned) wristTargets.set(key, { p: wp(l.tip), q: wq(l.tip) }); else wristTargets.delete(key);
    return true;
  }
  function wristTarget(key: PoseKey, out: Vector3) {
    const anchor = isWrist(key) && wristTargets.get(key); if (!active || !anchor) return false;
    model.mesh.localToWorld(out.copy(anchor.p)); return true;
  }
  function plantFeet() { for (const [k, a] of soles) { const l = limb[k]!; solve(l, a.p); orient(l.tip, a.q); } }
  function plantWrists() {
    // Feet can stop a hip edit. Wrists instead retain the *requested* contact
    // through overreach so leaning back into range returns the hand to the table.
    for (const [k, a] of wristTargets) {
      const l = limb[k]!; solve(l, a.p);
      if (wq(l.tip).angleTo(a.q) > 1e-7) orient(l.tip, a.q);
    }
  }
  function limitPelvisStep(b: Bone, delta: Vector3) {
    // Intersect the requested hip displacement with each planted leg's reach
    // sphere. Raising a fully extended leg stops the hip, never slides a foot.
    const d2 = delta.lengthSq(); if (!d2) return;
    let t = 1;
    for (const [k, anchor] of soles) {
      const l = limb[k]!; if (!ancestor(b, l.base) && l.base !== b) continue;
      const hip = wp(l.base), knee = wp(l.joint), ankle = wp(l.tip), from = hip.clone().sub(anchor.p);
      const dot = from.dot(delta), l1 = hip.distanceTo(knee), l2 = knee.distanceTo(ankle);
      const roots = (r: number) => dot * dot - d2 * (from.lengthSq() - r * r);
      t = Math.min(t, (-dot + Math.sqrt(Math.max(0, roots(l1 + l2)))) / d2);
      const inner = roots(Math.abs(l1 - l2));
      if (inner > 0 && dot < 0) { const entry = (-dot - Math.sqrt(inner)) / d2; if (entry >= 0) t = Math.min(t, entry); }
    }
    delta.multiplyScalar(Math.max(0, t));
  }
  function move(key: PoseKey, worldTarget: Vector3) {
    if (!canMove(key) || !valid(worldTarget)) return false;
    const b = control[key]!, target = model.mesh.worldToLocal(worldTarget.clone());
    if (key === 'pelvis') {
      const here = wp(b), delta = target.sub(here); limitPelvisStep(b, delta);
      clip.set(index.get(b)!, b.parent!.worldToLocal(here.add(delta)), b.quaternion); plantFeet();
    } else if (key === 'head') swing(neck!, b, target);
    else {
      solve(limb[key]!, target);
      // Directly carrying a pinned wrist chooses a new landing. Keep its
      // orientation and commit only a point the hand actually reached.
      if (isWrist(key)) wristTargets.get(key)?.p.copy(wp(b));
    }
    plantWrists();
    return true;
  }
  function rotate(key: PoseKey, axis: PoseAxis, radians: number) {
    const b = control[key]; if (!active || !b || !Number.isFinite(radians)) return false;
    const localAxis = typeof axis === 'string' ? new Vector3(Number(axis === 'x'), Number(axis === 'y'), Number(axis === 'z')) : axis.clone();
    if (!valid(localAxis) || localAxis.lengthSq() < 1e-14) return false;
    localAxis.normalize().applyQuaternion(model.mesh.getWorldQuaternion(new Quaternion()).invert());
    const before = wq(b);
    const turnsLegs = key === 'pelvis' || key === 'torso' && feet.some(k => soles.has(k) && ancestor(b, limb[k]?.base));
    if (turnsLegs && soles.size) {
      const pivot = wp(b), candidate = new Vector3(), rotation = new Quaternion();
      const legs = Array.from(soles, ([k, anchor]) => {
        const { base, joint, tip } = limb[k]!, hip = wp(base), knee = wp(joint);
        const a = hip.distanceTo(knee), c = knee.distanceTo(wp(tip)), pad = (a+c)*1e-9;
        return { base, anchor, rotates: ancestor(b, base), radius: hip.sub(pivot), min: Math.max(0,Math.abs(a-c)-pad), max: a+c+pad };
      });
      // A yaw/lean moves each hip on a different arc. Check the requested
      // endpoint before planting; solving an already-unreachable leg would
      // merely clamp its ankle to maximum reach and silently slide the foot.
      function reachable(angle: number) {
        rotation.setFromAxisAngle(localAxis, angle);
        return legs.every(l => {
          candidate.copy(l.radius); if (l.rotates) candidate.applyQuaternion(rotation);
          const d = candidate.add(pivot).distanceTo(l.anchor.p); return d >= l.min && d <= l.max;
        });
      }
      if (!reachable(radians)) {
        let lo = 0, hi = 1;
        for (let i = 0; i < 24; i++) { const mid = (lo+hi)/2; if (reachable(radians*mid)) lo = mid; else hi = mid; }
        radians *= lo; if (Math.abs(radians) < 1e-4) return false;
      }
      orient(b, rotation.setFromAxisAngle(localAxis, radians).multiply(before));
      // Nonstandard append-driven hip offsets need not follow a rigid arc.
      // Verify those as evaluated too, reverting the pelvis before any IK.
      if (legs.some(l => { const d = wp(l.base).distanceTo(l.anchor.p); return d > l.max + 1e-7 || d < l.min - 1e-7; })) {
        orient(b, before); return false;
      }
    } else orient(b, new Quaternion().setFromAxisAngle(localAxis, radians).multiply(before));
    if (turnsLegs) plantFeet();
    else if (key === 'leftFoot' || key === 'rightFoot') soles.get(key)?.q.copy(wq(b));
    else if (isWrist(key)) wristTargets.get(key)?.q.copy(wq(b)); // an intentional wrist turn
    plantWrists();
    return true;
  }
  function bend(key: PoseKey, radians: number) {
    const l = limb[key]; if (!active || !l || !Number.isFinite(radians)) return false;
    const target = wp(l.tip), q = wq(l.tip); solve(l, target, radians); orient(l.tip, q); plantWrists(); return true;
  }
  function capture(): PoseSnapshot {
    const poles: PoseSnapshot['poles'] = {};
    for (const key of keys) if (limb[key]) poles[key] = limb[key].pole.toArray();
    const pins: WristTargets = {};
    for (const [k, { p, q }] of wristTargets) pins[k] = { position: [p.x,p.y,p.z], rotation: [q.x,q.y,q.z,q.w] };
    const planted: PoseSnapshot['soles'] = {};
    for (const [k, {p,q}] of soles) planted[k] = { position:p.toArray(), rotation:q.toArray() };
    return { ...clip.capture(), feetLocked, poles, wrists: pins, soles: planted };
  }
  function apply(s: PoseSnapshot) {
    if (!active) return;
    clip.apply(s);
    for (const k of keys) { const p = s.poles[k]; if (limb[k] && p?.every(Number.isFinite)) limb[k].pole.fromArray(p); }
    lockFeet(s.feetLocked);
    if(s.feetLocked)for(const k of feet){const pin=s.soles?.[k];if(pin&&soles.has(k))soles.set(k,{p:new Vector3(...pin.position),q:new Quaternion(...pin.rotation)});}
    wristTargets.clear();
    // All coordinates are in the isolated actor rig. In particular do not
    // recapture the displayed wrist here: a saved pin may be out of reach.
    for (const k of wrists) {
      const pin = s.wrists[k];
      if (limb[k] && pin) wristTargets.set(k, { p: new Vector3(...pin.position), q: new Quaternion(...pin.rotation) });
    }
  }
  function restore() { if (active) { clip.restore(); active = false; } }
  return { keys, point, canMove, points() {
    const result: Partial<Record<PoseKey, Vector3>> = {};
    for (const key of keys) { const p = new Vector3(); if (point(key, p)) result[key] = p; } return result;
  }, animation: clip.animation, get feetLocked() { return feetLocked; }, canBend: (key: PoseKey) => active && !!limb[key],
  get pinnedWrists() { return [...wristTargets.keys()]; }, pinWrist, wristTarget,
   canPreset, applyPreset, move, rotate, bend, lockFeet, capture, apply, restore, dispose: restore };
}
