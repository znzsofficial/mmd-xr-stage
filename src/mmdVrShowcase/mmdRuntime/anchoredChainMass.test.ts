import {expect, it, vi} from 'vitest';
import {Matrix4} from 'three';
import {createCustomBulletMmdPhysicsBackend, type MmdPhysicsJoint, type MmdPhysicsRigidBody, type MmdPhysicsStepContext} from '@yohawing/three-mmd-loader/physics';
import {createAnchoredChainMassInput} from './anchoredChainMass';
import {getBulletModule} from './bulletModule';
import {createBulletPhysicsBackend} from './mmdPhysics';

vi.mock('./bulletModule', () => ({getBulletModule: vi.fn()}));

const link = (a: number, b: number): MmdPhysicsJoint => ({index: 0, rigidBodyIndexA: a, rigidBodyIndexB: b});
const body = (index: number, mass: number): MmdPhysicsRigidBody => ({
  index, mass, boneIndex: index, motionType: index ? 'dynamic' : 'static',
  shape: {type: 'sphere', size: [.1, 0, 0]}, localTranslation: [0, 10 - index, 0], collisionMask: 0,
});
const clock = {seconds: 0, deltaSeconds: 1/60, frame: 0, frameRate: 30};
const makeChain = () => ({...clock, rigidBodies: [body(0, 1), body(1, 2 ** 24), body(2, 100), body(3, 1)],
  joints: [link(2, 1), link(1, 0), link(2, 3)]}); // Reversed endpoints and non-topological joint order.

it('conditions the entire anchored strand once, preserving unrelated siblings, joint indices and contact masks', () => {
  const apply = createAnchoredChainMassInput(), c = makeChain();
  c.rigidBodies.push(body(4, 64), body(5, 32));
  c.joints.push(link(0, 4), link(4, 5));
  const {rigidBodies: conditioned, joints} = apply(c);
  expect(conditioned?.map(b => b.mass)).toEqual([1, 2 ** 22, 25, .25, 64, 32]);
  for (const i of [0, 4, 5]) expect(conditioned![i]).toBe(c.rigidBodies[i]);
  for (const i of [1, 2, 3]) expect(conditioned![i]).toEqual({...c.rigidBodies[i], mass: c.rigidBodies[i].mass! / 4});
  expect(joints).toBe(c.joints);
  expect(apply({...c, seeking: true}).rigidBodies).toBe(conditioned);
  const replaced = {...c, rigidBodies: c.rigidBodies.map((b, i) => i === 1 ? body(i, 1000) : b)};
  expect(apply(replaced)).toBe(replaced);
  expect(apply(c).rigidBodies).toEqual(conditioned);
  const unanchored = {...c, joints: c.joints.filter(j => j.rigidBodyIndexB !== 0)};
  expect(apply(unanchored)).toBe(unanchored);
  expect(apply(clock)).toBe(clock);
});

it('leaves ordinary, spring-loaded, loosely linked, branched and multiply anchored systems untouched', () => {
  const c = makeChain();
  const withLast = (last: MmdPhysicsJoint) => [...c.joints.slice(0, -1), last];
  const spring = {...link(2, 3), spring: {angular: [0, 1, 0] as const}};
  const loose = {...link(2, 3), linearLimit: {lower: [0, 0, 0] as const, upper: [.1, 0, 0] as const}};
  for (const input of [
    {...c, rigidBodies: [body(0, 1), body(1, 2 ** 23 - 1), body(2, 100), body(3, 1)]},
    {...c, rigidBodies: [...c.rigidBodies.slice(0, -1), body(3, 200)]},
    {...c, rigidBodies: [...c.rigidBodies.slice(0, -1), {...body(3, 1), motionType: 'dynamicWithBone' as const}]},
    {...c, joints: withLast(spring)}, {...c, joints: withLast(loose)},
    {...c, joints: [...c.joints, link(3, 0)]}, {...c, joints: [...c.joints, link(2, 4)], rigidBodies: [...c.rigidBodies, body(4, 1)]},
    {...c, joints: [link(0, 1)]}, {...c, joints: [link(1, 2), link(2, 3)]},
  ]) expect(createAnchoredChainMassInput()(input)).toBe(input);
});

it('keeps the simulated first body at the anchor where the unconditioned Bullet row drops it', async () => {
  const {createNodeBulletModule} = await import(new URL('../../../scripts/node-bullet-stage.mjs', import.meta.url).href);
  const module = await createNodeBulletModule();
  async function rootY(path: 'raw' | 'stage' | 'actorBinding') {
    const native = createCustomBulletMmdPhysicsBackend(module);
    vi.mocked(getBulletModule).mockResolvedValue({module, createCustomBulletMmdPhysicsBackend: () => native});
    const backend = path === 'raw' ? native : await createBulletPhysicsBackend({
      actorStep: path === 'actorBinding' ? (context, step) => step(context) : undefined,
    });
    try {
      const c = makeChain(), bones = c.rigidBodies.map(b => ({index: b.index, restTranslation: b.localTranslation!}));
      const buffers = native.acquireStepBuffers({boneCount: 4, translationValueCount: 12, rotationValueCount: 16, worldMatrixValueCount: 64})!;
      for (const bone of bones) {
        buffers.inputWorldMatricesColumnMajor.set(new Matrix4().makeTranslation(...bone.restTranslation).elements, bone.index * 16);
        buffers.inputTranslations.set(bone.restTranslation, bone.index * 3);
        buffers.inputRotations[bone.index * 4 + 3] = 1;
      }
      buffers.bonePhysicsToggles.fill(1);
      const context: MmdPhysicsStepContext = {...c, skeleton: {bones}, ...buffers,
        joints: c.joints.map(j => ({...j, translation: [0, 10 - Math.max(j.rigidBodyIndexA, j.rigidBodyIndexB), 0]})),
        output: {translations: buffers.outputTranslations, rotations: buffers.outputRotations, updatedBoneIndices: buffers.updatedBoneIndices}};
      for (let i = 0; i <= 120; i++) {
        backend.step({...context, seconds: i/60, frame: i/2});
      }
      const center = new Float32Array(3);
      expect(native.readRigidBodyCenters([1], center)).toBe(true);
      return center[1];
    } finally { backend.dispose?.(); }
  }
  expect(await rootY('raw')).toBeLessThan(8);
  expect(await rootY('stage')).toBeCloseTo(9, 2);
  expect(await rootY('actorBinding')).toBeCloseTo(9, 2);
});
