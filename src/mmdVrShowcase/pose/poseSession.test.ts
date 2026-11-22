import {expect,it,vi} from 'vitest';
import {Vector3} from 'three';
import {useBackpack} from '../backpack';
import {useHudWorldInput} from '../components/hudWorldInput';
import {useMmdVrStore} from '../mmdVrStore';
import type {PoseSnapshot,PoseSolver} from './poseSolver';
import {mountPoseRoom,poseActions as pose,usePoseSession} from './poseSession';

it('treats one real drag as one undo, cancels unfinished edits on recall, and only reloads a named pose for its asset',()=>{
  const bag=useBackpack.getState(),stage=useMmdVrStore.getState();
  const entries=['a','b'].map(id=>({id,kind:'model' as const,file:new File([],`${id}.pmx`),path:id}));
  const live=(runtimeId:string)=>({runtimeId,visible:true,position:[0,0,0] as [number,number,number]});
  useBackpack.setState({entries,live:{a:live('m1'),b:live('m2')},selected:'a',busy:false,draft:null});
  useMmdVrStore.setState({overlayOpen:true,duration:3,playing:true,physicsBusy:false,physicsFatal:false});
  let x=0;const snapshot=():PoseSnapshot=>({bones:[x],poles:{},morphs:[],feetLocked:true});
  const open=vi.fn(()=>{x=0;return {keys:['pelvis'],feetLocked:true,canMove:()=>true,move:(_:string,p:Vector3)=>{x=p.y;return true;},
    capture:snapshot,apply:(s:PoseSnapshot)=>{x=s.bones[0];}} as unknown as PoseSolver;});
  const close=vi.fn(()=>{x=0;}),stop=mountPoseRoom({open,close,dirty:()=>{}});
  const drag=(...ys:number[])=>{pose.startDrag('pelvis');for(const y of ys)pose.move('pelvis',new Vector3(0,y,0));};
  try{
    expect(pose.begin('a','m1')).toBe(true);expect(useMmdVrStore.getState().playing).toBe(false);
    drag(-.2,-.4);pose.finishDrag();pose.save('Bench');expect(pose.undo()).toBe(true);expect(x).toBe(0);expect(pose.undo()).toBe(false);
    drag(-.1);useHudWorldInput.setState({blocked:true});expect(x).toBe(0);expect(usePoseSession.getState().editing).toBe(false);
    useHudWorldInput.setState({blocked:false});expect(pose.load('b','m2','Bench')).toBe(false);
    pose.load('a','m1','Bench');expect(x).toBe(-.4);
    pose.hold();useMmdVrStore.setState({physicsBusy:true});expect(x).toBe(0);
    useMmdVrStore.setState({physicsBusy:false});stop.afterPhysics();expect(x).toBe(-.4);expect(usePoseSession.getState().editing).toBe(false);
    pose.end();expect(useMmdVrStore.getState().playing).toBe(true);
    useBackpack.setState({live:{a:live('m3'),b:live('m2')}});
    expect(pose.load('a','m1','Bench')).toBe(false);expect(pose.load('a','m3','Bench')).toBe(true);
    useMmdVrStore.getState().requestSeek(1);expect(usePoseSession.getState().runtimeId).toBeNull();expect(close.mock.calls.length).toBe(3);
    useBackpack.setState({entries:[]});expect(usePoseSession.getState().names).toEqual({});
  }finally{stop.dispose();useHudWorldInput.setState({blocked:false});useMmdVrStore.setState(stage);useBackpack.setState(bag);}
});
