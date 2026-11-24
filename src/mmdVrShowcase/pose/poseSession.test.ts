import {expect,it,vi} from 'vitest';
import {Vector3} from 'three';
import {useBackpack} from '../backpack/store';
import {useHudWorldInput} from '../hud/hudWorldInput';
import {useMmdVrStore} from '../mmdVrStore';
import type {PoseSnapshot,PoseSolver} from './poseSolver';
import {mountPoseRoom,poseActions as pose,usePoseSession} from './poseSession';

it('treats one real drag as one undo, cancels unfinished edits on recall, and only reloads a named pose for its asset',()=>{
  const bag=useBackpack.getState(),stage=useMmdVrStore.getState();
  const entries=['a','b'].map(id=>({id,kind:'model' as const,file:new File([],`${id}.pmx`),path:id}));
  const live=(runtimeId:string)=>({runtimeId,visible:true,position:[0,0,0] as [number,number,number]});
  useBackpack.setState({entries,live:{a:live('m1'),b:live('m2')},selected:'a',busy:false,draft:null});
  useMmdVrStore.setState({overlayOpen:true,duration:3,playing:true,physicsBusy:false,physicsFatal:false});
  let x=0;const snapshot=():PoseSnapshot=>({bones:[x],poles:{},morphs:[],feetLocked:true,wrists:{}});
  const open=vi.fn(()=>{x=0;return {keys:['pelvis'],feetLocked:true,pinnedWrists:[],canMove:()=>true,move:(_:string,p:Vector3)=>{x=p.y;return true;},
    capture:snapshot,apply:(s:PoseSnapshot)=>{x=s.bones[0];}} as unknown as PoseSolver;});
  const close=vi.fn(()=>{x=0;}),refitSkirt=vi.fn(),dirty=vi.fn(),stop=mountPoseRoom({open,close,dirty,refitSkirt});
  const drag=(...ys:number[])=>{pose.startDrag('pelvis');for(const y of ys)pose.move('pelvis',new Vector3(0,y,0));};
  try{
    expect(pose.begin('a','m1')).toBe(true);expect(useMmdVrStore.getState().playing).toBe(false);
    drag(-.2,-.4);expect(refitSkirt).not.toHaveBeenCalled();pose.finishDrag();expect(refitSkirt.mock.calls).toEqual([['m1']]);
    expect(dirty).toHaveBeenLastCalledWith(false,'m1');pose.save('Bench');expect(pose.undo()).toBe(true);expect(x).toBe(0);expect(pose.undo()).toBe(false);
    drag(-.1);useHudWorldInput.setState({blocked:true});expect(x).toBe(0);expect(usePoseSession.getState().editing).toBe(false);expect(refitSkirt).toHaveBeenCalledTimes(1);
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

it('holds a suspended editor on unmount and preserves that pose when the next actor has no editable rig',()=>{
  const bag=useBackpack.getState(),stage=useMmdVrStore.getState();
  const entries=['a','b'].map(id=>({id,kind:'model' as const,file:new File([],`${id}.pmx`),path:id}));
  const live=(runtimeId:string)=>({runtimeId,visible:true,position:[0,0,0] as [number,number,number]});
  useBackpack.setState({entries,live:{a:live('m1'),b:live('m2')},selected:'a',busy:false,draft:null});
  useMmdVrStore.setState({overlayOpen:true,duration:3,playing:true,physicsBusy:false,physicsFatal:false});
  let x=0;
  const solver={keys:['pelvis'],feetLocked:false,pinnedWrists:[],capture:():PoseSnapshot=>({bones:[x],morphs:[],poles:{},feetLocked:false,wrists:{}}),
    rotate:()=>{x++;return true;},apply:(s:PoseSnapshot)=>{x=s.bones[0];}};
  const room=mountPoseRoom({open:id=>(id==='m1'?solver:{keys:[]}) as unknown as PoseSolver,close:id=>{if(id==='m1')x=0;},dirty:()=>{}});
  try{
    pose.begin('a','m1');pose.rotate('pelvis','x',1);
    useMmdVrStore.setState({physicsBusy:true});
    pose.hold('a','m1'); // editor closes before the replacement mesh commits
    useMmdVrStore.setState({physicsBusy:false});room.afterPhysics();
    expect(x).toBe(1);expect(usePoseSession.getState()).toMatchObject({runtimeId:'m1',editing:false});
    useBackpack.getState().select('b');
    expect(pose.undo()).toBe(false);expect(pose.save('stale')).toBe(false);
    expect(pose.begin('a','m1')).toBe(false); // old panel is no longer the selection
    expect(pose.begin('b','m2')).toBe(false);expect(x).toBe(1);
    expect(usePoseSession.getState()).toMatchObject({assetId:'a',editing:false,canUndo:true});
    useBackpack.setState({bindings:{b:{face:new File([],'blink.vmd')}}});
    bag.applyMotion('b',null,'face');bag.finishCommand(useBackpack.getState().command!);
    expect(x).toBe(1);expect(usePoseSession.getState()).toMatchObject({assetId:'a',editing:false,canUndo:true});
    useBackpack.getState().select('a');expect(pose.begin('a','m1')).toBe(true);
    expect(pose.undo()).toBe(true);expect(x).toBe(0);pose.end();
    expect(useMmdVrStore.getState().playing).toBe(true);
  }finally{room.dispose();useMmdVrStore.setState(stage);useBackpack.setState(bag);}
});
