import { DefaultMmdRuntime, ThreeMmdLoader, disposeMmdModel, type ThreeMmdModel } from '@yohawing/three-mmd-loader';
import { Vector3 } from 'three';
import { expect, it } from 'vitest';
import { useBackpack } from '../backpack/store';
import { useMmdVrStore } from '../mmdVrStore';
import { poseFixture } from './poseFixture.testSupport';
import { createPoseSolver, type PoseKey, type PoseSolver } from './poseSolver';
import { mountPoseRoom, poseActions as pose, usePoseSession } from './poseSession';

const where = (model: ThreeMmdModel, name: string) => model.mesh.skeleton.getBoneByName(name)!.getWorldPosition(new Vector3());
const near = (a: Vector3, b: Vector3) => expect(a.distanceTo(b)).toBeLessThan(3e-5);

it('undoes and cancels a carried pin, then recalls its unreachable landing on a newly placed instance of only that actor', async () => {
  const bag = useBackpack.getState(), stage = useMmdVrStore.getState();
  const f = poseFixture(), loader = new ThreeMmdLoader({runtimeFactory:() => new DefaultMmdRuntime()});
  const load = () => loader.loadModel(f.pmx), anim = await loader.loadAnimation(f.vmd);
  const a = await load(), b = await load(), next = await load();
  const models = new Map([['a1',a],['b1',b],['a2',next]]), bindings = new Map<string,PoseSolver>();
  for (const [i,m] of [a,b,next].entries()) {
    m.root.scale.setScalar(.8 + i*.15); m.root.rotation.y = -.35 + i*.61; m.root.position.set(i*2, i*.4, i*.9);
    m.root.updateMatrixWorld(true); m.setAnimation(anim); m.update(.7,{physics:false});
  }
  const newRoom = () => mountPoseRoom({
    open(id) { const solver = createPoseSolver(models.get(id)!,anim,.7); bindings.set(id,solver); return solver; },
    close(id) { bindings.get(id)?.restore(); bindings.delete(id); },
    dirty() { for (const id of bindings.keys()) models.get(id)!.update(.7,{physics:false,ik:false}); },
  });
  const live = (runtimeId:string) => ({runtimeId,visible:true,position:[0,0,0] as [number,number,number]});
  const entries = ['a','b'].map(id => ({id,kind:'model' as const,file:new File([],`${id}.pmx`),path:id}));
  const move = (key:PoseKey, p:Vector3, finish=true) => {
    expect(pose.startDrag(key)).toBe(true); expect(pose.move(key,p)).toBe(true); if (finish) pose.finishDrag();
  };
  useBackpack.setState({entries,selected:'a',live:{a:live('a1'),b:live('b1')},busy:false,draft:null});
  useMmdVrStore.setState({overlayOpen:true,playing:true,duration:2,physicsBusy:false,physicsFatal:false});
  let room = newRoom();
  try {
    expect(pose.begin('a','a1')).toBe(true);
    const landing = where(a,'RightArm').add(new Vector3(.01,-.25,.10)), hip = where(a,'Pelvis');
    move('rightHand',landing); expect(pose.setWristPinned('a','a1','rightHand',true)).toBe(true);
    const carry = landing.clone().add(new Vector3(.06,.01,-.02));
    move('rightHand',carry,false); near(where(a,'RightHand'),carry); pose.hold('a','a1'); near(where(a,'RightHand'),landing);
    expect(pose.begin('a','a1')).toBe(true); move('rightHand',carry); expect(pose.undo()).toBe(true);
    expect(pose.setWristPinned('a','a1','rightHand',false)).toBe(true); expect(pose.undo()).toBe(true);
    expect(usePoseSession.getState().pinnedWrists).toEqual(['rightHand']); near(where(a,'RightHand'),landing);
    const length = (m:ThreeMmdModel, joint:string, tip:string) => where(m,joint).distanceTo(where(m,tip));
    const arm = length(a,'RightArm','RightElbow'), forearm = length(a,'RightElbow','RightHand');
    move('pelvis',hip.clone().add(new Vector3(1.8,.1,0)));
    const extended = where(a,'RightHand'), elbow = where(a,'RightElbow');
    expect(extended.distanceTo(landing)).toBeGreaterThan(.8);
    expect(length(a,'RightArm','RightHand')).toBeCloseTo(arm+forearm,5);
    expect(length(a,'RightArm','RightElbow')).toBeCloseTo(arm,5); expect(length(a,'RightElbow','RightHand')).toBeCloseTo(forearm,5);
    for (let i=0;i<12;i++) pose.rotate('head','x',.05);
    near(where(a,'RightHand'),extended); near(where(a,'RightElbow'),elbow);
    expect(pose.save('Table')).toBe(true);
    const localLanding = a.mesh.worldToLocal(landing.clone()), localHip = a.mesh.worldToLocal(hip.clone());
    const localExtended = a.mesh.worldToLocal(extended.clone());
    // Rebuild the evaluator while the hand is held out of range.
    useMmdVrStore.setState({physicsBusy:true}); useMmdVrStore.setState({physicsBusy:false}); room.afterPhysics();
    move('pelvis',hip); near(where(a,'RightHand'),landing);
    // An explicit wrist drag, unlike trunk motion, replaces the landing with
    // the point actually reached, even if the pointer went past arm's length.
    move('rightHand',where(a,'RightArm').add(new Vector3(9,0,0))); const repinned = where(a,'RightHand');
    move('pelvis',hip.clone().add(new Vector3(.10,0,0))); near(where(a,'RightHand'),repinned);
    useBackpack.getState().select('b'); expect(pose.begin('b','b1')).toBe(true); pose.select('rightHand');
    expect(usePoseSession.getState().pinnedWrists).toEqual([]); expect(pose.setWristPinned('a','a1','rightHand',true)).toBe(false);
    expect(pose.load('b','b1','Table')).toBe(false);
    room.dispose(); useBackpack.setState({selected:'a',live:{a:live('a2'),b:live('b1')}}); room = newRoom();
    expect(pose.load('a','a1','Table')).toBe(false); expect(pose.load('a','a2','Table')).toBe(true);
    expect(usePoseSession.getState().pinnedWrists).toEqual(['rightHand']); near(where(next,'RightHand'),next.mesh.localToWorld(localExtended));
    move('pelvis',next.mesh.localToWorld(localHip)); near(where(next,'RightHand'),next.mesh.localToWorld(localLanding));
    expect(where(next,'RightHand').distanceTo(landing)).toBeGreaterThan(2);
  } finally {
    room.dispose(); useBackpack.setState(bag); useMmdVrStore.setState(stage); for (const m of models.values()) disposeMmdModel(m);
  }
});
