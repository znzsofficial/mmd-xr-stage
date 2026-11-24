import {create} from 'zustand';
import type {Vector3} from 'three';
import {useBackpack} from '../backpack';
import {useMmdVrStore} from '../mmdVrStore';
import {useHudWorldInput} from '../components/hudWorldInput';
import type {PoseKey,PoseSnapshot,PoseSolver,WristKey} from './poseSolver';
import type {PosePresetId} from './presetCatalog';
export type {PoseKey};

type SessionState={assetId:string|null;runtimeId:string|null;editing:boolean;selected:PoseKey;
  keys:readonly PoseKey[];feetLocked:boolean;pinnedWrists:readonly WristKey[];canUndo:boolean;dragging:boolean;names:Record<string,readonly string[]>};
const idle={assetId:null,runtimeId:null,editing:false,selected:'pelvis' as PoseKey,keys:[] as readonly PoseKey[],feetLocked:false,pinnedWrists:[] as readonly WristKey[],canUndo:false,dragging:false};
export const usePoseSession=create<SessionState>(()=>({...idle,names:{}}));

// Presets are data belonging to a File in this page's backpack. Only the
// current room can own a solver or hold a reference to its skeleton.
const library=new Map<string,Map<string,PoseSnapshot>>();
type Room={open:(id:string)=>PoseSolver|null;close:(id:string)=>void;dirty:(reseed?:boolean,runtimeId?:string)=>void;refitSkirt?:(runtimeId:string)=>void};
let room:Room|null=null;
type Editor={id:string;asset:string;solver:PoseSolver;history:PoseSnapshot[];drag:PoseSnapshot|null;moved:boolean;wasPlaying:boolean};
let active:Editor|null=null;
// These are still-mounted actors in this room. Only one receives controls;
// opening another actor must not restore the first one's animation.
const held=new Map<string,Editor>();
// Data only. A physics rebuild may span a selection change or closing the editor.
type Suspended={asset:string;id:string;pose:PoseSnapshot;history:PoseSnapshot[];wasPlaying:boolean;editing:boolean;selected:PoseKey};
let suspended:Suspended|null=null;
const suspendedHeld=new Map<string,Suspended>();
const ui=()=>usePoseSession.getState();
const locks=(solver:PoseSolver)=>({feetLocked:solver.feetLocked,pinnedWrists:solver.pinnedWrists});
function finish(resume:boolean){
  const a=active;if(!a)return;
  active=null;
  try{room?.close(a.id);}finally{
    usePoseSession.setState(idle);room?.dirty();
    if(resume&&!held.size&&!suspendedHeld.size&&a.wasPlaying&&useMmdVrStore.getState().duration>0)useMmdVrStore.getState().setPlaying(true);
  }
}
function valid(asset:string,id:string){
  const b=useBackpack.getState(),s=useMmdVrStore.getState();
  return !!room&&s.overlayOpen&&!s.physicsFatal&&!s.physicsBusy&&!s.assetLoad.running&&!b.busy&&!b.draft&&b.live[asset]?.visible&&b.live[asset]?.runtimeId===id&&b.entries.some(e=>e.id===asset&&e.kind==='model');
}
function bind(asset:string,id:string,editing:boolean){
  if(!valid(asset,id))return false;
  if(active?.id===id&&active.asset===asset){usePoseSession.setState({editing});return true;}
  const wasPlaying=active?.wasPlaying||suspended?.wasPlaying||[...held.values()].some(e=>e.wasPlaying)||useMmdVrStore.getState().playing;
  const prior=held.get(id);if(prior&&prior.asset!==asset)return false;
  const solver=prior?.solver??room?.open(id);if(!solver)return false;
  const keys=solver.keys;
  if(!keys.length){room?.close(id);room?.dirty();return false;}
  finishDrag(true);
  if(active?.history.length){held.set(active.id,active);active=null;}else finish(false);
  held.delete(id);
  useMmdVrStore.getState().setPlaying(false);
  active=prior??{asset,id,solver,history:[],drag:null,moved:false,wasPlaying};
  usePoseSession.setState({assetId:asset,runtimeId:id,editing,keys,selected:keys.includes('pelvis')?'pelvis':keys[0],...locks(solver),canUndo:active.history.length>0,dragging:false});
  room?.dirty();return true;
}
function begin(asset:string,id:string){
  if(useBackpack.getState().selected!==asset)return false;
  if(suspended?.asset===asset&&suspended.id===id){suspended.editing=true;return false;} // wait for afterPhysics to bind
  const waiting=suspendedHeld.get(id);
  if(waiting?.asset===asset){
    if(suspended?.history.length)suspendedHeld.set(suspended.id,{...suspended,editing:false});
    suspendedHeld.delete(id);suspended={...waiting,editing:true};return false;
  }
  if(!bind(asset,id,true))return false;
  if(suspended?.history.length)suspendedHeld.set(suspended.id,{...suspended,editing:false});
  suspended=null;
  return true;
}
function remember(before:PoseSnapshot){
  if(!active)return;
  active.history.push(before);if(active.history.length>24)active.history.shift();
  if(!ui().canUndo)usePoseSession.setState({canUndo:true});
}
const changesSkirtSupport=(key:PoseKey)=>key==='pelvis'||key==='torso'||key==='leftFoot'||key==='rightFoot';
function change(edit:(s:PoseSolver)=>boolean,reseed=false,refit=false){
  if(!active||!ui().editing||active.drag)return false;
  const a=active,before=a.solver.capture();if(!edit(a.solver))return false;
  remember(before);if(refit)room?.refitSkirt?.(a.id);room?.dirty(reseed,a.id);return true;
}
function finishDrag(cancel=false){
  const a=active;if(!a?.drag)return;
  const before=a.drag;a.drag=null;
  if(a.moved){if(cancel){a.solver.apply(before);room?.dirty(true,a.id);}else{
    remember(before);
    if(changesSkirtSupport(ui().selected)){room?.refitSkirt?.(a.id);room?.dirty(false,a.id);}
  }}
  a.moved=false;usePoseSession.setState({dragging:false});
}
export const poseActions={begin,end:()=>finish(true),
  hold(asset?:string,id?:string){
    if(suspended&&(!asset||suspended.asset===asset&&suspended.id===id))suspended.editing=false;
    if(active&&(!asset||active.asset===asset&&active.id===id)){finishDrag(true);usePoseSession.setState({editing:false});}
  },
  select(key:PoseKey){if(ui().editing&&!ui().dragging&&ui().keys.includes(key))usePoseSession.setState({selected:key});},
  canMove(key:PoseKey){return active?.solver.canMove(key)??false;},
  canBend(key:PoseKey){return active?.solver.canBend(key)??false;},
  canPreset(id:PosePresetId){const a=active;return !!a&&ui().editing&&!a.drag&&useBackpack.getState().selected===a.asset&&!!valid(a.asset,a.id)&&a.solver.canPreset(id);},
  applyPreset(asset:string,runtimeId:string,id:PosePresetId){
    const a=active;if(!a||a.asset!==asset||a.id!==runtimeId||!poseActions.canPreset(id))return false;
    const changed=change(s=>s.applyPreset(id),true);usePoseSession.setState(locks(a.solver));return changed;
  },
  point(key:PoseKey,out:Vector3){return active?.solver.point(key,out)??false;},
  wristTarget(key:PoseKey,out:Vector3){return active?.solver.wristTarget(key,out)??false;},
  startDrag(key:PoseKey){if(!active||!ui().editing||active.drag||!ui().keys.includes(key))return false;
    active.drag=active.solver.capture();active.moved=false;usePoseSession.setState({selected:key,dragging:true});return true;},
  move(key:PoseKey,target:Vector3){if(!active?.drag||ui().selected!==key||!active.solver.move(key,target))return false;
    active.moved=true;room?.dirty();return true;},finishDrag,
  rotate(key:PoseKey,axis:'x'|'y'|'z',radians:number){if(!active?.drag)return change(s=>s.rotate(key,axis,radians),false,changesSkirtSupport(key));
    if(ui().selected!==key||!active.solver.rotate(key,axis,radians))return false;active.moved=true;room?.dirty();return true;},
  bend:(key:PoseKey,radians:number)=>change(s=>s.bend(key,radians),false,changesSkirtSupport(key)),
  setFeetLocked(value:boolean){if(active&&ui().feetLocked!==value&&change(s=>{s.lockFeet(value);return s.feetLocked===value;}))usePoseSession.setState({feetLocked:value});},
  setWristPinned(asset:string,id:string,key:WristKey,value:boolean){
    const a=active;if(!a||a.asset!==asset||a.id!==id||ui().selected!==key||!change(s=>s.pinWrist(key,value)))return false;
    usePoseSession.setState({pinnedWrists:a.solver.pinnedWrists});return true;
  },
  undo(){const a=active;if(!a||a.drag||!ui().editing)return false;const snap=a.history.pop();if(!snap)return false;
    a.solver.apply(snap);usePoseSession.setState({...locks(a.solver),canUndo:a.history.length>0});room?.dirty(true,a.id);return true;},
  save(name:string){const a=active,label=name.trim().slice(0,48);if(!label||!a||a.drag||!ui().editing)return false;
    const book=library.get(a.asset)??new Map<string,PoseSnapshot>();book.set(label,a.solver.capture());library.set(a.asset,book);
    usePoseSession.setState(s=>({names:{...s.names,[a.asset]:[...book.keys()]}}));return true;},
  load(asset:string,id:string,name:string){const snap=library.get(asset)?.get(name);if(!snap||!begin(asset,id))return false;
    if(!change(s=>{s.apply(snap);return true;},true)||!active)return false;usePoseSession.setState(locks(active.solver));return true;},
};

export function mountPoseRoom(host:Room){
  function closeHeld(){for(const id of held.keys())room?.close(id);held.clear();}
  function clear(){suspended=null;suspendedHeld.clear();closeHeld();finish(false);}
  clear();room=host;
  // Physics switches can replace the model/evaluator. Carry data, never the
  // old rig, across that transition. Restore only after this room commits it.
  const stopStage=useMmdVrStore.subscribe((s,p)=>{
    if(room!==host)return;
    if(!s.overlayOpen||s.prefs.scenery!==p.prefs.scenery||s.playing||s.seekEpoch!==p.seekEpoch||s.assetLoad.running||s.physicsFatal)clear();
    else if(s.physicsBusy||s.physicsEnabled!==p.physicsEnabled){
      for(const [id,a] of held)suspendedHeld.set(id,{asset:a.asset,id,pose:a.solver.capture(),history:a.history,wasPlaying:a.wasPlaying,editing:false,selected:'pelvis'});
      closeHeld();
      if(active){const a=active;suspended={asset:a.asset,id:a.id,pose:a.drag??a.solver.capture(),history:a.history,wasPlaying:a.wasPlaying,editing:ui().editing,selected:ui().selected};finish(false);}
    }
  });
  const stopBag=useBackpack.subscribe((b,p)=>{
    if(room!==host)return;
    // Clearing a different actor's slot neither restarts the clock nor rebinds this rig.
    const unbinding=b.command?.type==='motion' && !b.command.file ? b.command.runtimeId : null;
    const gone=(asset:string,id:string)=>b.busy&&(!unbinding||unbinding===id)||b.draft||!b.live[asset]?.visible||b.live[asset].runtimeId!==id||b.entries!==p.entries&&!b.entries.some(e=>e.id===asset);
    for(const [id,a] of held)if(gone(a.asset,id)){held.delete(id);host.close(id);host.dirty();}
    for(const [id,a] of suspendedHeld)if(gone(a.asset,id))suspendedHeld.delete(id);
    if(suspended&&gone(suspended.asset,suspended.id))suspended=null;
    if(suspended&&b.selected!==p.selected&&b.selected!==suspended.asset)suspended.editing=false;
    if(!active)return;
    if(gone(active.asset,active.id))finish(false);
    else if(b.selected!==p.selected&&b.selected!==active.asset)poseActions.hold(active.asset,active.id);
  });
  const stopHud=useHudWorldInput.subscribe((s,p)=>{if(s.blocked&&!p.blocked&&room===host)poseActions.hold();});
  return {afterPhysics(){
    if(room!==host)return;
    for(const [id,a] of suspendedHeld){
      suspendedHeld.delete(id);if(!valid(a.asset,id)||active?.id===id)continue;
      const solver=host.open(id);if(!solver)continue;
      solver.apply(a.pose);held.set(id,{asset:a.asset,id,solver,history:a.history,wasPlaying:a.wasPlaying,moved:false,drag:null});host.dirty(true,id);
    }
    const saved=suspended;suspended=null;if(!saved||!valid(saved.asset,saved.id))return;
    if(active&&active.id!==saved.id)return;
    const editing=saved.editing&&useBackpack.getState().selected===saved.asset&&!useHudWorldInput.getState().blocked;
    if(!bind(saved.asset,saved.id,editing)||!active)return;
    active.solver.apply(saved.pose);active.history=saved.history;active.wasPlaying=saved.wasPlaying;
    usePoseSession.setState({selected:active.solver.keys.includes(saved.selected)?saved.selected:ui().selected,...locks(active.solver),canUndo:saved.history.length>0});host.dirty(true,saved.id);
  },dispose(){stopStage();stopBag();stopHud();if(room===host){clear();room=null;}}};
}
useBackpack.subscribe((b,p)=>{if(b.entries===p.entries||!library.size)return;
  const names={...ui().names};let changed=false;
  for(const id of library.keys())if(!b.entries.some(e=>e.id===id)){library.delete(id);delete names[id];changed=true;}
  if(changed)usePoseSession.setState({names});
});
