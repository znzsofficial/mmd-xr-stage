import {create} from 'zustand';
import type {Vector3} from 'three';
import {useBackpack} from '../backpack';
import {useMmdVrStore} from '../mmdVrStore';
import {useHudWorldInput} from '../components/hudWorldInput';
import type {PoseKey,PoseSnapshot,PoseSolver} from './poseSolver';
export type {PoseKey};

type SessionState={assetId:string|null;runtimeId:string|null;editing:boolean;selected:PoseKey;
  keys:readonly PoseKey[];feetLocked:boolean;canUndo:boolean;dragging:boolean;names:Record<string,readonly string[]>};
const idle={assetId:null,runtimeId:null,editing:false,selected:'pelvis' as PoseKey,keys:[] as readonly PoseKey[],feetLocked:false,canUndo:false,dragging:false};
export const usePoseSession=create<SessionState>(()=>({...idle,names:{}}));

// Presets are data belonging to a File in this page's backpack. Only the
// current room can own a solver or hold a reference to its skeleton.
const library=new Map<string,Map<string,PoseSnapshot>>();
type Room={open:(id:string)=>PoseSolver|null;close:(id:string)=>void;dirty:(reseed?:boolean)=>void};
let room:Room|null=null;
let active:{id:string;asset:string;solver:PoseSolver;history:PoseSnapshot[];drag:PoseSnapshot|null;moved:boolean;wasPlaying:boolean}|null=null;
const ui=()=>usePoseSession.getState();
function finish(resume:boolean){
  const a=active;if(!a)return;
  active=null;
  try{room?.close(a.id);}finally{
    usePoseSession.setState(idle);room?.dirty();
    if(resume&&a.wasPlaying&&useMmdVrStore.getState().duration>0)useMmdVrStore.getState().setPlaying(true);
  }
}
function valid(asset:string,id:string){
  const b=useBackpack.getState(),s=useMmdVrStore.getState();
  return !!room&&s.overlayOpen&&!s.physicsFatal&&!s.physicsBusy&&!s.assetLoad.running&&!b.busy&&!b.draft&&b.live[asset]?.visible&&b.live[asset]?.runtimeId===id;
}
function begin(asset:string,id:string){
  if(!valid(asset,id))return false;
  if(active?.id===id&&active.asset===asset){usePoseSession.setState({editing:true});return true;}
  const wasPlaying=active?.wasPlaying||useMmdVrStore.getState().playing;
  finish(false);
  const solver=room?.open(id);if(!solver)return false;
  const keys=solver.keys;
  if(!keys.length){room?.close(id);room?.dirty();return false;}
  useMmdVrStore.getState().setPlaying(false);
  active={asset,id,solver,history:[],drag:null,moved:false,wasPlaying};
  usePoseSession.setState({assetId:asset,runtimeId:id,editing:true,keys,selected:keys.includes('pelvis')?'pelvis':keys[0],feetLocked:solver.capture().feetLocked,canUndo:false,dragging:false});
  room?.dirty();return true;
}
function remember(before:PoseSnapshot){
  if(!active)return;
  active.history.push(before);if(active.history.length>24)active.history.shift();
  if(!ui().canUndo)usePoseSession.setState({canUndo:true});
}
function change(edit:(s:PoseSolver)=>boolean,reseed=false){
  if(!active||!ui().editing||active.drag)return false;
  const a=active,before=a.solver.capture();if(!edit(a.solver))return false;
  remember(before);room?.dirty(reseed);return true;
}
function finishDrag(cancel=false){
  const a=active;if(!a?.drag)return;
  const before=a.drag;a.drag=null;
  if(a.moved){if(cancel){a.solver.apply(before);room?.dirty(true);}else remember(before);}
  a.moved=false;usePoseSession.setState({dragging:false});
}
export const poseActions={begin,end:()=>finish(true),
  hold(){finishDrag();if(active)usePoseSession.setState({editing:false});},
  select(key:PoseKey){if(ui().editing&&!ui().dragging&&ui().keys.includes(key))usePoseSession.setState({selected:key});},
  canMove(key:PoseKey){return active?.solver.canMove(key)??false;},
  canBend(key:PoseKey){return active?.solver.canBend(key)??false;},
  point(key:PoseKey,out:Vector3){return active?.solver.point(key,out)??false;},
  startDrag(key:PoseKey){if(!active||!ui().editing||active.drag||!ui().keys.includes(key))return false;
    active.drag=active.solver.capture();active.moved=false;usePoseSession.setState({selected:key,dragging:true});return true;},
  move(key:PoseKey,target:Vector3){if(!active?.drag||ui().selected!==key||!active.solver.move(key,target))return false;
    active.moved=true;room?.dirty();return true;},finishDrag,
  rotate(key:PoseKey,axis:'x'|'y'|'z',radians:number){if(!active?.drag)return change(s=>s.rotate(key,axis,radians));
    if(ui().selected!==key||!active.solver.rotate(key,axis,radians))return false;active.moved=true;room?.dirty();return true;},
  bend:(key:PoseKey,radians:number)=>change(s=>s.bend(key,radians)),
  setFeetLocked(value:boolean){if(ui().feetLocked!==value&&change(s=>{s.lockFeet(value);return true;}))usePoseSession.setState({feetLocked:value});},
  undo(){const a=active;if(!a||a.drag)return false;const snap=a.history.pop();if(!snap)return false;
    a.solver.apply(snap);usePoseSession.setState({feetLocked:snap.feetLocked,canUndo:a.history.length>0});room?.dirty(true);return true;},
  save(name:string){const a=active,label=name.trim().slice(0,48);if(!label||!a||a.drag)return false;
    const book=library.get(a.asset)??new Map<string,PoseSnapshot>();book.set(label,a.solver.capture());library.set(a.asset,book);
    usePoseSession.setState(s=>({names:{...s.names,[a.asset]:[...book.keys()]}}));return true;},
  load(asset:string,id:string,name:string){const snap=library.get(asset)?.get(name);if(!snap||!begin(asset,id))return false;
    if(!change(s=>{s.apply(snap);return true;},true))return false;usePoseSession.setState({feetLocked:snap.feetLocked});return true;},
};

export function mountPoseRoom(host:Room){
  finish(false);room=host;
  // Physics switches can replace the model/evaluator. Carry data, never the
  // old rig, across that transition. Restore only after this room commits it.
  let suspended:{asset:string;id:string;pose:PoseSnapshot;history:PoseSnapshot[];wasPlaying:boolean;editing:boolean;selected:PoseKey}|null=null;
  const stopStage=useMmdVrStore.subscribe((s,p)=>{
    if(room!==host)return;
    if(!s.overlayOpen||s.prefs.scenery!==p.prefs.scenery||s.playing||s.seekEpoch!==p.seekEpoch||s.assetLoad.running||s.physicsFatal){suspended=null;finish(false);}
    else if(active&&(s.physicsBusy||s.physicsEnabled!==p.physicsEnabled)){
      const a=active;suspended={asset:a.asset,id:a.id,pose:a.drag??a.solver.capture(),history:a.history,wasPlaying:a.wasPlaying,editing:ui().editing,selected:ui().selected};
      finish(false);
    }
  });
  const stopBag=useBackpack.subscribe((b,p)=>{
    if(suspended&&(b.busy||b.draft||!b.live[suspended.asset]?.visible||b.live[suspended.asset].runtimeId!==suspended.id))suspended=null;
    if(!active||room!==host)return;
    if(b.busy||b.draft||!b.live[active.asset]?.visible||b.live[active.asset].runtimeId!==active.id)finish(false);
    else if(b.selected!==p.selected&&b.selected!==active.asset){finishDrag(true);poseActions.hold();}
  });
  const stopHud=useHudWorldInput.subscribe((s,p)=>{if(s.blocked&&!p.blocked&&room===host){finishDrag(true);poseActions.hold();}});
  return {afterPhysics(){
    const saved=suspended;suspended=null;if(!saved||room!==host||!valid(saved.asset,saved.id))return;
    if(active&&active.id!==saved.id)return;
    if(!begin(saved.asset,saved.id)||!active)return;
    active.solver.apply(saved.pose);active.history=saved.history;active.wasPlaying=saved.wasPlaying;
    usePoseSession.setState({editing:saved.editing&&useBackpack.getState().selected===saved.asset&&!useHudWorldInput.getState().blocked,
      selected:saved.selected,feetLocked:saved.pose.feetLocked,canUndo:saved.history.length>0});host.dirty(true);
  },dispose(){stopStage();stopBag();stopHud();suspended=null;if(room===host){finish(false);room=null;}}};
}
useBackpack.subscribe((b,p)=>{if(b.entries===p.entries||!library.size)return;
  const names={...ui().names};let changed=false;
  for(const id of library.keys())if(!b.entries.some(e=>e.id===id)){library.delete(id);delete names[id];changed=true;}
  if(changed)usePoseSession.setState({names});
});
