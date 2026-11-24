import { ThreeMmdLoader, disposeMmdModel } from '@yohawing/three-mmd-loader';
import { expect, it } from 'vitest';
import { useBackpack } from '../backpack/store';
import { useMmdVrStore } from '../mmdVrStore';
import { poseFixture } from './poseFixture.testSupport';
import { mountPoseRoom, poseActions as pose, usePoseSession } from './poseSession';
import { createPoseSolver, type PoseSolver } from './poseSolver';

it('keeps both mounted actors independently posed, with one-step undo including old pins, per-asset names and separate VMD restoration',async()=>{
  const bag=useBackpack.getState(),stage=useMmdVrStore.getState();
  const source=poseFixture(),loader=new ThreeMmdLoader(),vmd=await loader.loadAnimation(source.vmd);
  const a=await loader.loadModel(source.pmx),b=await loader.loadModel(source.pmx),models=new Map([['a1',a],['b1',b]]),solvers=new Map<string,PoseSolver>();
  for(const m of models.values()){m.setAnimation(vmd);m.update(.81,{physics:false});}
  const rig=(m:typeof a)=>m.mesh.skeleton.bones.flatMap(b=>[...b.position.toArray(),...b.quaternion.toArray()]);
  const near=(a:number[],b:number[])=>expect(Math.max(...a.map((x,i)=>Math.abs(x-b[i])))).toBeLessThan(3e-5);
  const originalA=rig(a),originalB=rig(b);
  const live=(runtimeId:string)=>({runtimeId,visible:true,position:[0,0,0] as [number,number,number]});
  useBackpack.setState({selected:'a',entries:['a','b'].map(id=>({id,file:new File([],id+'.pmx'),kind:'model',path:id})),live:{a:live('a1'),b:live('b1')},busy:false,draft:null});
  useMmdVrStore.setState({overlayOpen:true,playing:true,duration:2,physicsBusy:false,physicsFatal:false});
  const reseeds:string[]=[];
  const room=mountPoseRoom({open(id){const s=createPoseSolver(models.get(id)!,vmd,.81);solvers.set(id,s);return s;},
    close(id){solvers.get(id)?.restore();solvers.delete(id);},dirty(reseed,target){if(reseed)reseeds.push(target!);for(const id of solvers.keys())models.get(id)!.update(.81,{physics:false,ik:false});}});
  try{
    expect(pose.begin('a','a1')).toBe(true);pose.setFeetLocked(true);pose.select('rightHand');expect(pose.setWristPinned('a','a1','rightHand',true)).toBe(true);
    const locked=solvers.get('a1')!.capture();expect(locked.soles?.leftFoot).toBeTruthy();
    expect(pose.applyPreset('a','a1','supine')).toBe(true);const supine=rig(a);near(rig(b),originalB);
    expect(usePoseSession.getState()).toMatchObject({feetLocked:false,pinnedWrists:[]});
    expect(pose.undo()).toBe(true);expect(solvers.get('a1')!.capture()).toEqual(locked);
    expect(pose.applyPreset('a','a1','supine')).toBe(true);near(rig(a),supine);
    expect(pose.save('My pose')).toBe(true);
    useBackpack.getState().select('b');expect(pose.applyPreset('a','a1','allFours')).toBe(false);
    expect(pose.begin('b','b1')).toBe(true);expect(pose.load('b','b1','My pose')).toBe(false);
    expect(pose.applyPreset('a','b1','side')).toBe(false);expect(pose.applyPreset('b','a1','side')).toBe(false);
    expect(pose.applyPreset('b','b1','side')).toBe(true);const side=rig(b);near(rig(a),supine);
    expect(pose.save('My pose')).toBe(true);expect(pose.applyPreset('b','b1','allFours')).toBe(true);
    expect(pose.undo()).toBe(true);near(rig(b),side);near(rig(a),supine);
    useMmdVrStore.setState({physicsBusy:true});expect(solvers.size).toBe(0);
    useBackpack.getState().select('a');expect(pose.begin('a','a1')).toBe(false); // select A during rebuild
    reseeds.length=0;useMmdVrStore.setState({physicsBusy:false});room.afterPhysics();near(rig(a),supine);near(rig(b),side);
    expect(usePoseSession.getState()).toMatchObject({assetId:'a',editing:true});expect(reseeds.sort()).toEqual(['a1','b1']);
    useBackpack.getState().select('b');expect(pose.begin('b','b1')).toBe(true);
    expect(pose.rotate('torso','x',.22)).toBe(true);expect(rig(b)).not.toEqual(side);
    expect(pose.load('b','b1','My pose')).toBe(true);near(rig(b),side);
    pose.end();near(rig(b),originalB);near(rig(a),supine);expect(useMmdVrStore.getState().playing).toBe(false);
    useBackpack.getState().select('a');expect(pose.begin('a','a1')).toBe(true);
    expect(pose.undo()).toBe(true);expect(solvers.get('a1')!.capture()).toEqual(locked);
    expect(pose.load('a','a1','My pose')).toBe(true);near(rig(a),supine);
    pose.end();near(rig(a),originalA);expect(useMmdVrStore.getState().playing).toBe(true);
  }finally{room.dispose();useBackpack.setState(bag);useMmdVrStore.setState(stage);disposeMmdModel(a);disposeMmdModel(b);}
});
