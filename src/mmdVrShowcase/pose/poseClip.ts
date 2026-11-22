import type { MmdAnimation, ThreeMmdAnimation, ThreeMmdModel } from '@yohawing/three-mmd-loader';
import { DefaultMmdRuntime, MmdAnimRuntime } from '@yohawing/three-mmd-loader/runtime';
import { Bone, Matrix4, Quaternion, Skeleton, SkinnedMesh, Vector3 } from 'three';

type Source = ThreeMmdAnimation | MmdAnimation | null;
type Track = MmdAnimation['boneTracks'][string];
export type ClipSnapshot = {
  /** Absolute VMD inputs, in skeleton order; no display bones, actor TRS or file handles. */
  bones: number[]; // tx, ty, tz, qx, qy, qz, qw, physics toggle
  morphs: number[];
};

function emptyClip(): MmdAnimation {
  return { kind: 'vmd', bytes: new Uint8Array(), boneTracks: Object.create(null), morphTracks: Object.create(null),
    cameraFrames: [], lightFrames: [], propertyFrames: [], selfShadowFrames: [], metadata: { modelName: '', maxFrame: 0,
      counts: { bones: 0, morphs: 0, cameras: 0, lights: 0, properties: 0, selfShadows: 0 } } };
}

// A one-frame track has no interpolation interval. Only the transform and
// toggle buffers are writable; the frame/curve can be shared within this clip.
function lastKey(frames: Uint32Array, frame: number) {
  let lo = 0, hi = frames.length;
  while (lo < hi) { const mid = (lo + hi) >>> 1; if (frames[mid] <= frame) lo = mid + 1; else hi = mid; }
  return Math.max(0, lo - 1);
}

/** Read the loader's immutable bind, never the currently displayed Bullet/chest pose. */
function bindLocals(mesh: SkinnedMesh) {
  const { bones, boneInverses } = mesh.skeleton;
  const index = new Map(bones.map((b, i) => [b, i]));
  return bones.map((bone, i) => {
    const local = new Matrix4().copy(boneInverses[i]).invert();
    const parent = index.get(bone.parent as Bone);
    local.premultiply(parent == null ? mesh.bindMatrix.clone().invert() : boneInverses[parent]);
    const position = new Vector3(), quaternion = new Quaternion(), scale = new Vector3();
    local.decompose(position, quaternion, scale);
    return { position, quaternion, scale };
  });
}

/** The private rig carries only FK and the loader's PMX morph/grant rules. It has
 * no physics backend, draw proxies, mutable source tracks or link to the scene. */
function scratchMesh(source: SkinnedMesh, rest: ReturnType<typeof bindLocals>, grants: boolean) {
  const mesh = new SkinnedMesh(source.geometry, source.material);
  mesh.morphTargetDictionary = source.morphTargetDictionary;
  mesh.morphTargetInfluences = source.morphTargetInfluences?.map(() => 0);
  mesh.userData.mmdMorphs = source.userData.mmdMorphs;
  const sourceBones = source.skeleton.bones;
  const bones = sourceBones.map((b, i) => {
    const clone = new Bone();
    clone.name = b.name; clone.userData = { ...b.userData };
    if (!grants) delete clone.userData.mmdAppendTransform;
    clone.position.copy(rest[i].position); clone.quaternion.copy(rest[i].quaternion);
    return clone;
  });
  const index = new Map(sourceBones.map((b, i) => [b, i]));
  sourceBones.forEach((b, i) => (bones[index.get(b.parent as Bone) ?? -1] ?? mesh).add(bones[i]));
  mesh.skeleton = new Skeleton(bones, source.skeleton.boneInverses);
  return mesh;
}

const editOptions = { ik: false, physics: false };

export function bindPoseClip(model: ThreeMmdModel, original: Source, seconds: number, sourceIk: boolean) {
  if (!Number.isFinite(seconds)) throw new RangeError('Invalid pose time');
  const source = original && ('animation' in original ? original.animation : original);
  const live = model.mesh, liveBones = live.skeleton.bones, rest = bindLocals(live);
  const atBind = () => liveBones.forEach((b, i) => {
    b.position.copy(rest[i].position); b.quaternion.copy(rest[i].quaternion); b.scale.copy(rest[i].scale);
  });
  const originalOrRest = original ?? emptyClip();
  const native = model.runtime instanceof MmdAnimRuntime ? model.runtime : null;
  function sampleSource() {
    // WASM creates a fresh parsed-track JS evaluator for composed clips. In
    // particular, never let setAnimation capture the previous pose as its rest.
    atBind();
    if (native && !original) {
      // No-physics actors without a VMD are unbound in the stage. Binding an
      // empty animation here would run WASM rest-pose IK even with ik:false.
      live.morphTargetInfluences?.fill(0);
      for (const m of live.userData.mmdMorphSplitBodyMeshes ?? []) m.morphTargetInfluences?.fill(0);
    } else { model.setAnimation(originalOrRest); model.update(seconds, { physics: false, ik: sourceIk }); }
  }
  let entered = false, restored = false;
  function restore() {
    if (restored) return;
    if (native && model.runtime !== native) model.exchangeRuntime(native);
    if (native && entered) {
      atBind(); if (!original) sampleSource();
      model.update(seconds, { physics: false, ik: sourceIk });
    } else sampleSource();
    restored = true;
  }
  try {
    sampleSource(); entered = true;
    const clip = makeEditClip(live, rest, source, model.runtime.frameState().frame);
    // Native VMD evaluation reparses bytes and does not see typed-array edits.
    // Park its exact binding (including an unbound static actor) and use a
    // parsed evaluator without costly debug captures for the edit. Bullet
    // already uses JS: keep that same evaluator AND its external world.
    atBind();
    if (native) model.exchangeRuntime(new DefaultMmdRuntime({ captureStageSnapshots: false }));
    model.setAnimation(clip.animation); model.update(seconds, editOptions);
    return { ...clip, restore };
  } catch (error) {
    try { restore(); } catch (rollback) { throw new AggregateError([error, rollback], 'Pose binding and restoration failed'); }
    throw error;
  }
}

function makeEditClip(live: SkinnedMesh, rest: ReturnType<typeof bindLocals>, source: MmdAnimation | null, frame: number) {
  const liveBones = live.skeleton.bones;
  const wanted = liveBones.map(b => ({ position: b.position.clone(), quaternion: b.quaternion.clone() }));
  const animation = emptyClip(), zero = new Uint32Array(1), curve = new Float32Array(16);
  const tracks = liveBones.map(b => {
    const name = b.userData.mmdBoneName || b.name;
    const originalTrack = source?.boneTracks[name] ?? source?.boneTracks[b.userData.mmdEnglishBoneName] ?? source?.boneTracks[b.name];
    const toggle = originalTrack?.physicsToggles[lastKey(originalTrack.frames, frame)] ?? -1;
    const track: Track = { packed: 'bone', frames: zero, interpolations: curve, translations: new Float32Array(3),
      rotations: Float32Array.of(0, 0, 0, 1), physicsToggles: Int8Array.of(toggle) };
    animation.boneTracks[name] = track;
    return track;
  });
  // Freeze *direct* expression inputs, not expanded group weights (which would
  // apply a group twice). A template can be recalled against a different VMD.
  const morphs = Object.keys(live.morphTargetDictionary ?? {}).map(name => {
    const src = source?.morphTracks[name];
    let w = 0;
    if (src?.frames.length) {
      const i = lastKey(src.frames, frame), a = src.frames[i], b = src.frames[i + 1];
      w = src.weights[i]; if (frame > a && b > a) w += (src.weights[i + 1] - w) * ((frame - a) / (b - a));
    }
    const weights = Float32Array.of(w); animation.morphTracks[name] = { packed: 'morph', frames: zero, weights }; return weights;
  });
  animation.metadata.counts.bones = tracks.length; animation.metadata.counts.morphs = morphs.length;

  const mesh = scratchMesh(live, rest, true), bones = mesh.skeleton.bones;
  const preview = new DefaultMmdRuntime({ physics: 'none', captureStageSnapshots: false });
  preview.setAnimation(animation, mesh);
  const evaluate = () => { preview.evaluate(0, editOptions); };
  const grantSources = new Set<number>();
  for (const b of bones) if (b.userData.mmdAppendTransform) grantSources.add(b.userData.mmdAppendTransform.parentIndex);
  // A bone morph premultiplies the VMD quaternion; grants postmultiply it.
  // Ask the real evaluator for the left factor (including group/flip morphs).
  // No extra rig is necessary on models without bone morphs.
  const hasBoneMorphs = live.userData.mmdMorphs?.some((m: { type: string }) => m.type === 'bone');
  const morphMesh = hasBoneMorphs ? scratchMesh(live, rest, false) : null;
  const morphRuntime = morphMesh && new DefaultMmdRuntime({ captureStageSnapshots: false });
  if (morphMesh && morphRuntime) morphRuntime.setAnimation({ ...animation, boneTracks: {} }, morphMesh);
  const raw = new Quaternion(), delta = new Quaternion(), inv = new Quaternion();
  function writeInput(i: number, position: Vector3, quaternion: Quaternion) {
    const b = bones[i], t = tracks[i], p = t.translations, r = t.rotations;
    p[0] += position.x - b.position.x; p[1] += position.y - b.position.y; p[2] -= position.z - b.position.z;
    raw.set(-r[0], -r[1], r[2], r[3]);
    delta.copy(quaternion).multiply(inv.copy(b.quaternion).invert());
    const m = morphMesh?.skeleton.bones[i].quaternion;
    if (m) delta.premultiply(inv.copy(m).invert()).multiply(m);
    raw.premultiply(delta).normalize(); r[0] = -raw.x; r[1] = -raw.y; r[2] = raw.z; r[3] = raw.w;
  }
  morphRuntime?.evaluate(0, editOptions);
  evaluate();
  // Solve the input that reproduces the captured native/JS result with IK
  // disabled. Each pass propagates corrections through another PMX grant;
  // ordinary rigs converge in one or two. Never bake Bullet, or double a grant.
  for (let pass = 0; pass < grantSources.size + 3; pass++) {
    let changed = false;
    wanted.forEach((w, i) => {
      const a = w.quaternion, b = bones[i].quaternion, sign = a.dot(b) < 0 ? -1 : 1;
      if (w.position.distanceToSquared(bones[i].position) < 1e-12 &&
        Math.max(Math.abs(a.x - sign*b.x), Math.abs(a.y - sign*b.y), Math.abs(a.z - sign*b.z), Math.abs(a.w - sign*b.w)) < 2e-7) return;
      writeInput(i, w.position, w.quaternion); changed = true;
    });
    if (!changed) break;
    evaluate();
  }

  return {
    mesh, animation,
    set(i: number, p: Vector3, q: Quaternion) {
      writeInput(i, p, q);
      if (grantSources.has(i)) evaluate();
      else { bones[i].position.copy(p); bones[i].quaternion.copy(q); }
    },
    capture(): ClipSnapshot {
      return { bones: tracks.flatMap(t => [...t.translations, ...t.rotations, t.physicsToggles[0]]), morphs: morphs.map(w => w[0]) };
    },
    apply(s: ClipSnapshot) {
      if (!Array.isArray(s.bones) || s.bones.length !== tracks.length * 8 || !Array.isArray(s.morphs) || s.morphs.length !== morphs.length ||
        !s.bones.every(Number.isFinite) || !s.morphs.every(Number.isFinite)) throw new TypeError('Pose does not match skeleton');
      tracks.forEach((t, i) => { const j = i * 8; t.translations.set(s.bones.slice(j, j + 3)); t.rotations.set(s.bones.slice(j + 3, j + 7)); t.physicsToggles[0] = s.bones[j + 7]; });
      morphs.forEach((w, i) => { w[0] = s.morphs[i]; }); morphRuntime?.evaluate(0, editOptions); evaluate();
    },
  };
}
