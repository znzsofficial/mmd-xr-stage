import { DefaultMmdRuntime, ThreeMmdLoader } from '@yohawing/three-mmd-loader';
import { Bone, BufferGeometry, Float32BufferAttribute, Group, MeshBasicMaterial, Skeleton, SkinnedMesh, Uint16BufferAttribute, Vector3 } from 'three';
import { afterEach, beforeEach, expect, it } from 'vitest';
import { clearBackpack, useBackpack } from '../backpack/store';
import { DEFAULT_BODY_PROFILE } from '../bodyState/data';
import { createBodyDisplay } from '../bodyState/runtime';
import { useMmdVrStore } from '../mmdVrStore';
import { wandMorphNames } from '../play/wandResponse';
import { poseFixture } from '../pose/poseFixture.testSupport';
import { createApertureLayer } from './aperture';
import { getApertureMorph, setApertureMorph } from './apertureConfig';
import { disablePelvic, enablePelvic } from './store';

const morph = 'Gesture'; // An arbitrary authored name, also keyed in the shared binary VMD fixture.
function part(indices: number[]) {
  const g = new BufferGeometry();
  g.setAttribute('position', new Float32BufferAttribute([-.1,0,0, .1,0,0, 0,.2,0], 3));
  g.setAttribute('skinIndex', new Uint16BufferAttribute(new Uint16Array(12), 4));
  g.setAttribute('skinWeight', new Float32BufferAttribute([1,0,0,0, 1,0,0,0, 1,0,0,0], 4));
  g.setIndex([0,1,2]); g.morphTargetsRelative = true;
  g.morphAttributes.position = indices.map(i => new Float32BufferAttribute(i === 1 ? [-.2,0,0, .2,0,0, 0,0,0] : new Float32Array(9), 3));
  return new SkinnedMesh(g, new MeshBasicMaterial());
}
function actor(split = true) {
  const root = new Group(), mesh = part(split ? [] : [0,1,2]), bone = new Bone();
  bone.name = 'Pelvis'; mesh.add(bone); root.add(mesh); mesh.bind(new Skeleton([bone]));
  mesh.morphTargetDictionary = { Blink: 0, [morph]: 1, Tint: 2 };
  mesh.morphTargetInfluences = [.1,.3,.25];
  mesh.userData.mmdMorphs = ['Blink',morph,'Tint'].map((name,i) => ({ name, type: i < 2 ? 'vertex' : 'material' }));
  const bodies = split ? [[1,0],[0,1],[0]].map((indices, materialIndex) => {
    const body = part(indices);
    body.userData.mmdMorphSplitBody = { materialIndex, morphTargetIndices: Uint16Array.from(indices) };
    body.morphTargetInfluences = indices.map(i => mesh.morphTargetInfluences![i]);
    body.bind(mesh.skeleton, mesh.bindMatrix); root.add(body); return body;
  }) : [];
  const renderOrderMeshes: SkinnedMesh[] = [];
  if (split) mesh.userData.mmdMorphSplitBodyMeshes = bodies;
  else {
    const proxy = new SkinnedMesh(mesh.geometry.clone(), mesh.material);
    proxy.bind(mesh.skeleton, mesh.bindMatrix); proxy.morphTargetInfluences = mesh.morphTargetInfluences;
    proxy.morphTargetDictionary = mesh.morphTargetDictionary; root.add(proxy); renderOrderMeshes.push(proxy);
  }
  mesh.geometry.setDrawRange(0, 0); root.updateMatrixWorld(true);
  return { root, mesh, renderOrderMeshes, bone, bodies };
}
const gap = (m: SkinnedMesh) => m.getVertexPosition(0, new Vector3()).distanceTo(m.getVertexPosition(1, new Vector3()));
const initialStage = useMmdVrStore.getState();
beforeEach(() => { useMmdVrStore.setState({ overlayOpen: true }); });
afterEach(() => { clearBackpack(); useMmdVrStore.setState(initialStage); });
function place(id: string, surface: ReturnType<typeof actor>, runtimeId = 'instance') {
  const bag = useBackpack.getState();
  useBackpack.setState({ selected: id, entries: [...bag.entries.filter(e => e.id !== id), { id, kind: 'model', file: new File([], 'same.pmx'), path: 'same.pmx' }],
    live: { ...bag.live, [id]: { runtimeId, visible: true, position: [0,0,0], propMorphs: wandMorphNames(surface.mesh) } } });
  expect(enablePelvic(id, true)).toBe(true);
}

it('layers actual rig amounts above a nonzero interpolated VMD and day shape on two reordered material bodies', async () => {
  const model = actor(), { mesh, bodies, bone } = model;
  place('a', model); expect(setApertureMorph('a', morph)).toBe(true);
  const layer = createApertureLayer(), day = createBodyDisplay(mesh, null);
  day.configure({ ...DEFAULT_BODY_PROFILE, morph, fullness: .35 });
  const vmd = await new ThreeMmdLoader().loadAnimation(poseFixture().vmd);
  const rt = new DefaultMmdRuntime({ physics: 'none' }); rt.setAnimation(vmd.animation, mesh);
  const weights = mesh.morphTargetInfluences!;
  for (const t of [.5, 1.5]) {
    rt.evaluate(t, { physics: false }); model.root.updateMatrixWorld(true);
    const raw = weights[1]; expect(raw).toBeCloseTo(.12 + (.83-.12)*t/2);
    day.apply(); const base = weights[1]; expect(base).toBeCloseTo(raw + .35*(1-raw));
    const daily = bodies.map(gap), matrix = bone.matrixWorld.clone();
    for (const amount of [.2, 1, .65, .65, 0]) { // with VMD paused, no accumulating a previous pass
      layer.apply('a', model, amount);
      for (const i of [0,1]) expect(gap(bodies[i])).toBeCloseTo(daily[i] + .4*(1-base)*amount, 6);
      expect(gap(bodies[2])).toBe(daily[2]);
      expect(bone.matrixWorld).toEqual(matrix);
    }
    layer.restore(); expect(bodies.map(gap)).toEqual(daily); expect(weights[1]).toBe(base);
    day.restore(); expect(weights[1]).toBe(raw);
  }
});

it('unwinds each compact slot to its own value, supports shared proxy weights and keeps choices on asset IDs across runtime ID reuse', () => {
  const a = actor(), b = actor(false), layer = createApertureLayer();
  place('a', a); expect(getApertureMorph('a')).toBeNull(); expect(setApertureMorph('a', 'Tint')).toBe(false);
  expect(setApertureMorph('a', morph)).toBe(true);
  a.bodies[0].morphTargetInfluences![0] = .21; a.bodies[1].morphTargetInfluences![1] = .41;
  const raw = a.bodies.map(p => [...p.morphTargetInfluences!]);
  layer.apply('a', a, .8); expect(a.bodies[0].morphTargetInfluences![0]).toBeCloseTo(.86);
  place('b', b); layer.apply('b', b, 1); // new asset with the same runtime ID + shape name has NO mapping
  expect(a.bodies.map(p => p.morphTargetInfluences)).toEqual(raw); expect(b.mesh.morphTargetInfluences![1]).toBe(.3);
  expect(setApertureMorph('b', morph)).toBe(true);
  const proxy = b.renderOrderMeshes[0], baseline = gap(proxy);
  layer.apply('b', b, .5); expect(gap(proxy)).toBeCloseTo(baseline+.4*.35);
  b.root.visible = false; layer.apply('b', b, 1); expect(gap(proxy)).toBe(baseline);
  b.root.visible = true; layer.apply('b', b, .5);
  expect(disablePelvic('b')).toBe(true); layer.apply('b', b, 1); expect(gap(proxy)).toBe(baseline);
  const remounted = actor(false); place('a', remounted, 'other-runtime-id');
  layer.apply('a', remounted, 1); expect(remounted.mesh.morphTargetInfluences![1]).toBe(1);
  expect(setApertureMorph('a', null)).toBe(true); layer.apply('a', remounted, 1); expect(remounted.mesh.morphTargetInfluences![1]).toBe(.3);
});

it('leaves a closed mesh unchanged even when the same saved name now denotes a bone, material or missing position channel', () => {
  const adapted = actor(false), layer = createApertureLayer(); place('a', adapted); setApertureMorph('a', morph);
  for (const type of ['missing', 'bone', 'material', 'group', 'no-vertex-channel']) {
    const closed = actor(false), { mesh } = closed;
    if (type === 'missing') delete mesh.morphTargetDictionary![morph];
    else if (type === 'no-vertex-channel') mesh.geometry.morphAttributes.position = [];
    else mesh.userData.mmdMorphs[1].type = type;
    const before = gap(mesh), vertices = mesh.geometry.attributes.position.array.slice(), indices = mesh.geometry.index!.array.slice();
    layer.apply('a', adapted, .5); layer.apply('a', closed, 1);
    expect(adapted.mesh.morphTargetInfluences![1]).toBe(.3); expect(mesh.morphTargetInfluences).toEqual([.1,.3,.25]);
    expect(gap(mesh)).toBe(before); expect(mesh.geometry.attributes.position.array).toEqual(vertices); expect(mesh.geometry.index!.array).toEqual(indices);
  }
});
