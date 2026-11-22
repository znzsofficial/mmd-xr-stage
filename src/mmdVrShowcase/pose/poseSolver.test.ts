import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { expect, it, vi } from 'vitest';
import { DefaultMmdRuntime, MmdAnimRuntime, ThreeMmdLoader, disposeMmdModel, type ThreeMmdModel } from '@yohawing/three-mmd-loader';
import { createCustomBulletMmdPhysicsBackend, type CustomBulletMmdModule } from '@yohawing/three-mmd-loader/physics';
import { Group, Quaternion, Vector3 } from 'three';
import { poseWristToy } from '../play/wristSocket';
import { createPoseSolver } from './poseSolver';
import { poseFixture } from './poseFixture.testSupport';

const at = (m: ThreeMmdModel, name: string) => m.mesh.skeleton.getBoneByName(name)!;
const xyz = (m: ThreeMmdModel, name: string) => at(m, name).getWorldPosition(new Vector3());
const close = (a: Vector3, b: Vector3, tol = 3e-5) => expect(a.distanceTo(b)).toBeLessThan(tol);
const all = (m: ThreeMmdModel) => m.mesh.skeleton.bones.map(b => ({ p: b.getWorldPosition(new Vector3()), q: b.getWorldQuaternion(new Quaternion()) }));
function compare(m: ThreeMmdModel, pose: ReturnType<typeof all>) {
  all(m).forEach((a, i) => { close(a.p, pose[i].p); expect(a.q.angleTo(pose[i].q)).toBeLessThan(7e-4); });
}
const edit = { physics: false, ik: false };
async function actor(native: boolean, partial = false) {
  const fixture = poseFixture(partial), loader = new ThreeMmdLoader(native ? {} : { runtimeFactory: () => new DefaultMmdRuntime() });
  const model = await loader.loadModel(fixture.pmx, { outline: false, materialRenderOrder: false });
  const orig = await loader.loadAnimation(fixture.vmd);
  expect(model.runtime).toBeInstanceOf(native ? MmdAnimRuntime : DefaultMmdRuntime);
  model.root.rotation.y = -.82; model.root.position.set(.5,.8,1); model.root.scale.setScalar(.68); model.root.updateMatrixWorld(true);
  model.setAnimation(orig); return { model, orig };
}

it.each([true, false])('freezes a fractional native IK/morph/grant pose, sits with planted feet, and restores two VMD frames (WASM=%s)', async native => {
  const { model, orig } = await actor(native), seconds = .713, runtime = model.runtime;
  const readonlyInput = structuredClone(orig.animation.boneTracks);
  model.update(1.86, { physics: false }); const dancingLater = all(model);
  model.setAnimation(orig); model.update(seconds, { physics: false }); const dancing = all(model);
  const expression = model.mesh.morphTargetInfluences!.slice();
  // A previous display deformation must not enter the pose or its bind.
  at(model, 'Cloth').position.y -= 7; at(model, 'RightHand').quaternion.setFromAxisAngle(new Vector3(1,0,0), .99);
  const pose = createPoseSolver(model, orig, seconds), bind = vi.spyOn(model, 'setAnimation');
  expect(pose.keys).toEqual(['pelvis', 'torso', 'head', 'leftHand', 'rightHand', 'leftFoot', 'rightFoot']);
  compare(model, dancing);
  expect(expression[1]).toBeGreaterThan(.1);
  expect(model.mesh.morphTargetDictionary!.Expression).toBe(model.mesh.morphTargetDictionary!.Gesture);
  expect(model.mesh.morphTargetInfluences![1]).toBeCloseTo(expression[1], 5);
  const standing = pose.capture(), start = pose.points();
  const soles = ['LeftFoot','RightFoot'].map(n => at(model, n).getWorldQuaternion(new Quaternion()));
  pose.lockFeet(true);
  const hip = start.pelvis!.clone().add(new Vector3(0,-.22,.09));
  expect(pose.move('pelvis', hip)).toBe(true); model.update(4.5, edit); close(xyz(model, 'Pelvis'), hip);
  for (const [i,key] of (['leftFoot','rightFoot'] as const).entries()) {
    const name = i ? 'RightFoot' : 'LeftFoot'; close(pose.points()[key]!, start[key]!); close(xyz(model, name), start[key]!);
    expect(at(model, name).getWorldQuaternion(new Quaternion()).angleTo(soles[i])).toBeLessThan(6e-4);
  }
  const hand = xyz(model,'RightArm').add(new Vector3(.13,-.29,.16)), keep = hand.clone();
  pose.move('rightHand', hand); model.update(0, edit); close(xyz(model,'RightHand'), hand); close(hand, keep);
  const elbow = xyz(model,'RightElbow'), finger = xyz(model,'RightIndex1');
  pose.bend('rightHand', .85); model.update(0, edit); close(xyz(model, 'RightHand'), hand); close(xyz(model,'RightIndex1'), finger);
  expect(xyz(model,'RightElbow').distanceTo(elbow)).toBeGreaterThan(.03);
  pose.rotate('rightHand', 'y', .85); pose.rotate('head', 'z', -.4); model.update(0, edit);
  close(xyz(model, 'RightHand'), hand); expect(xyz(model,'RightIndex1').distanceTo(finger)).toBeGreaterThan(.02);
  const seated = JSON.parse(JSON.stringify(pose.capture())), posed = all(model);
  // A near-singular, unreachable target must not elongate either arm segment.
  const a = xyz(model,'RightArm'), b = xyz(model,'RightElbow'), c = xyz(model,'RightHand');
  pose.move('rightHand', a.clone().addScalar(40)); model.update(0, edit);
  expect(xyz(model,'RightArm').distanceTo(xyz(model,'RightHand'))).toBeCloseTo(a.distanceTo(b)+b.distanceTo(c), 5);
  pose.apply(standing); model.update(0, edit); compare(model, dancing);
  expect(bind).not.toHaveBeenCalled(); pose.restore(); pose.dispose(); compare(model, dancing); expect(bind).toHaveBeenCalledTimes(native ? 0 : 1);
  expect(model.runtime).toBe(runtime); model.update(1.86, { physics: false }); compare(model, dancingLater);
  const later = createPoseSolver(model, orig, 1.86); later.apply(seated); model.update(1.86, edit); compare(model, posed);
  later.dispose(); compare(model, dancingLater); expect(orig.animation.boneTracks).toEqual(readonlyInput);
  disposeMmdModel(model);
});

it('a static PMX with an incomplete arm has a rotation-only wrist; recall follows the actor transform', async () => {
  const model = await new ThreeMmdLoader().loadModel(poseFixture(true).pmx);
  model.update(0, edit); const rest = all(model);
  const pose = createPoseSolver(model, null, 0);
  compare(model, rest);
  expect(pose.canMove('rightHand')).toBe(false); expect(pose.bend('rightHand', 1)).toBe(false);
  expect(pose.pinWrist('rightHand',true)).toBe(false); expect(pose.pinWrist('leftHand',true)).toBe(true);
  expect(pose.pinnedWrists).toEqual(['leftHand']);
  const hand = pose.points().rightHand!;
  expect(pose.move('rightHand', hand.clone().addScalar(3))).toBe(false);
  expect(pose.rotate('rightHand', 'z', 1)).toBe(true); model.update(0, edit); close(xyz(model,'RightHand'), hand);
  const saved = pose.capture(); model.root.position.x += 2; pose.apply(saved); model.update(0, edit);
  const point = new Vector3(); expect(pose.point('rightHand',point)).toBe(true); close(point, hand.clone().add(new Vector3(2,0,0)));
  model.root.position.x -= 2; pose.dispose(); compare(model, rest); model.update(1, edit); compare(model, rest); disposeMmdModel(model);
});

it('pelvis turns respect planted straight legs, then turn normally after sitting; the head and knees still swivel', async () => {
  const model = await new ThreeMmdLoader().loadModel(poseFixture().pmx), pose = createPoseSolver(model, null, 0);
  for (const side of ['left','right'] as const) {
    const foot = pose.points()[`${side}Foot`]!; pose.move(`${side}Foot`,foot.add(new Vector3(0,-1,0)));
  }
  model.update(0,edit); const start = pose.points(), pelvisQ = at(model,'Pelvis').quaternion.clone();
  const soleQ = at(model,'RightFoot').getWorldQuaternion(new Quaternion()); pose.lockFeet(true);
  for (let i=0;i<12;i++) pose.rotate('pelvis','z',.45);
  model.update(0,edit); close(xyz(model,'RightFoot'), start.rightFoot!,1e-6); close(xyz(model,'LeftFoot'), start.leftFoot!,1e-6);
  expect(at(model,'Pelvis').quaternion.angleTo(pelvisQ)).toBeLessThan(1e-4);
  expect(pose.rotate('head','z',.5)).toBe(true); model.update(0,edit); expect(at(model,'Head').quaternion.angleTo(new Quaternion())).toBeCloseTo(.5,5);
  pose.move('pelvis',start.pelvis!.clone().add(new Vector3(0,-.4,0)));
  expect(pose.rotate('pelvis','z',.35)).toBe(true); model.update(0,edit);
  expect(at(model,'Pelvis').quaternion.angleTo(pelvisQ)).toBeCloseTo(.35,5);
  const knee = xyz(model,'RightKnee'); pose.bend('rightFoot',.58); model.update(0,edit);
  expect(xyz(model,'RightKnee').distanceTo(knee)).toBeGreaterThan(.1);
  close(xyz(model,'RightFoot'),start.rightFoot!); close(xyz(model,'LeftFoot'),start.leftFoot!);
  expect(at(model,'RightFoot').getWorldQuaternion(new Quaternion()).angleTo(soleQ)).toBeLessThan(5e-4);
  pose.restore(); disposeMmdModel(model);
});

it('keeps two seated tabletop contacts, soles, and a wrist prop while the pelvis and spine move independently', async () => {
  const {model, orig} = await actor(true), seconds = .4;
  model.update(seconds,{physics:false}); const source = all(model);
  const pose = createPoseSolver(model,orig,seconds), show = () => model.update(seconds,edit);
  const prop = new Group(), sampleProp = () => {
    poseWristToy(prop,model.root,{assetId:'actor',toy:'encore',hand:'right',turn:15,tilt:10,inset:0});
    expect(prop.visible).toBe(true); return {p:prop.position.clone(),q:prop.quaternion.clone()};
  };
  const soleL = xyz(model,'LeftFoot'), soleR = xyz(model,'RightFoot'); pose.lockFeet(true);
  pose.move('pelvis',xyz(model,'Pelvis').add(new Vector3(0,-.22,.04))); show();
  const tableY = xyz(model,'RightArm').y - .24;
  const left = xyz(model,'LeftArm').add(new Vector3(.025,0,.08)).setY(tableY);
  const right = xyz(model,'RightArm').add(new Vector3(-.025,0,.08)).setY(tableY);
  pose.move('rightHand',right); pose.rotate('rightHand','y',.27); pose.pinWrist('rightHand',true); show();
  const propStart = sampleProp();
  pose.move('leftHand',left); pose.pinWrist('leftHand',true); show();
  const leftFinger = xyz(model,'LeftIndex1'), rightFinger = xyz(model,'RightIndex1'), chest = at(model,'Spine').quaternion.clone();
  const hip = xyz(model,'Pelvis').add(new Vector3(.035,-.015,-.01)); pose.move('pelvis',hip);
  pose.rotate('torso','x',.26); pose.rotate('pelvis','y',.10); pose.bend('leftHand',.36); show();
  close(xyz(model,'Pelvis'),hip); expect(at(model,'Spine').quaternion.angleTo(chest)).toBeGreaterThan(.22);
  close(xyz(model,'RightHand'),right); close(xyz(model,'LeftHand'),left); close(xyz(model,'RightIndex1'),rightFinger); close(xyz(model,'LeftIndex1'),leftFinger);
  close(xyz(model,'RightFoot'),soleR); close(xyz(model,'LeftFoot'),soleL);
  const kept = sampleProp(); close(kept.p,propStart.p); expect(kept.q.angleTo(propStart.q)).toBeLessThan(.0007);
  // Carry and turn the right contact on purpose. Only an explicit release lets it follow the trunk again.
  const newRight = right.clone().add(new Vector3(.02,.005,-.04)); pose.move('rightHand',newRight); show();
  close(sampleProp().p,propStart.p.clone().add(newRight).sub(right));
  pose.rotate('rightHand','z',.38); show(); const turned = sampleProp(); expect(turned.q.angleTo(kept.q)).toBeCloseTo(.38,3);
  pose.rotate('torso','y',.12); show(); close(xyz(model,'RightHand'),newRight); close(xyz(model,'LeftHand'),left); close(sampleProp().p,turned.p);
  pose.pinWrist('rightHand',false); pose.rotate('torso','z',.32); show();
  expect(xyz(model,'RightHand').distanceTo(newRight)).toBeGreaterThan(.015); close(xyz(model,'LeftHand'),left);
  pose.restore(); compare(model,source); disposeMmdModel(model);
});

it.each([true,false])('rolls back even if the edit binding throws after installing its clip (WASM=%s)', async native => {
  const { model, orig } = await actor(native), runtime = model.runtime, t = .42;
  model.update(1.7,{physics:false}); const later = all(model); model.setAnimation(orig); model.update(t,{physics:false}); const here = all(model);
  const bind = model.setAnimation.bind(model);
  vi.spyOn(model,'setAnimation').mockImplementation(clip => { bind(clip); if (clip !== orig) throw new Error('late bind failure'); });
  expect(() => createPoseSolver(model,orig,t)).toThrow('late bind failure');
  expect(model.runtime).toBe(runtime); compare(model,here); model.update(1.7,{physics:false}); compare(model,later); disposeMmdModel(model);
});

it('Bullet consumes the changing single-frame wrist before stepping without resets during the drag', async () => {
  const dir = new URL('../../../public/mmd/0.8.6/', import.meta.url);
  const factory = runInNewContext(`${readFileSync(new URL('mmd_bullet.js',dir),'utf8')};MmdBullet`, {console}) as
    (o: {wasmBinary: Uint8Array}) => Promise<CustomBulletMmdModule>;
  const backend = createCustomBulletMmdPhysicsBackend(await factory({wasmBinary: readFileSync(new URL('mmd_bullet.wasm',dir))}));
  const loader = new ThreeMmdLoader({ runtimeFactory: () => new DefaultMmdRuntime({ physics:'external', physicsBackend:backend }) });
  const f = poseFixture(), m = await loader.loadModel(f.pmx), vmd = await loader.loadAnimation(f.vmd);
  m.setAnimation(vmd); m.update(.4, {physics:true}); m.update(.42, {physics:true});
  const pose = createPoseSolver(m,vmd,.42), reset = vi.spyOn(backend,'reset'), bind = vi.spyOn(m,'setAnimation');
  const home = pose.points().rightHand!, positions: Vector3[] = [];
  for(let i=0;i<10;i++) {
    pose.move('rightHand', home.clone().add(new Vector3(.014*i,-.014*i,0)));
    m.update(.42+i/60,{physics:true,ik:false});
    const center = new Float32Array(3); expect(backend.readRigidBodyCenters([0],center)).toBe(true);
    const wrist = xyz(m, 'RightHand'); close(wrist,pose.points().rightHand!);
    close(new Vector3(center[0],center[1],-center[2]),wrist,.001);
    positions.push(wrist);
  }
  expect(positions[0].distanceTo(positions[9])).toBeGreaterThan(.1);
  const pinned = xyz(m,'RightHand'), hip = xyz(m,'Pelvis'); pose.pinWrist('rightHand',true);
  for (let i=1;i<=6;i++) {
    const seat = hip.clone().add(new Vector3(0,-i*.006,0)); pose.move('pelvis',seat);
    m.update(.42+(9+i)/60,{physics:true,ik:false}); close(xyz(m,'Pelvis'),seat); close(xyz(m,'RightHand'),pinned);
    const center = new Float32Array(3); expect(backend.readRigidBodyCenters([0],center)).toBe(true);
    close(new Vector3(center[0],center[1],-center[2]),pinned,.001);
  }
  expect(reset).not.toHaveBeenCalled(); expect(bind).not.toHaveBeenCalled();
  pose.restore(); backend.dispose?.(); disposeMmdModel(m);
});
