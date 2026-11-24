import {create} from 'zustand';
import {useBackpack} from '../../backpack/store';
import {DEFAULT_CHANCE,MAX_EGGS,resolveConception,type ConceptionEvent,type Ovum} from './game';

export {MAX_EGGS,type ConceptionEvent,type Ovum} from './game';
const emptyEggs:readonly Ovum[]=Object.freeze([]);
type Account={chance:number;eggs:readonly Ovum[];event?:ConceptionEvent};
const emptyAccount:Account={chance:DEFAULT_CHANCE,eggs:emptyEggs};
type State={byAsset:Record<string,Account>};
export const useConception=create<State>(()=>({byAsset:{}}));
let sequence=0;

export function chanceFor(id:string,s=useConception.getState()):number {
  return s.byAsset[id]?.chance??DEFAULT_CHANCE;
}

export function eggsFor(id:string,s=useConception.getState()):readonly Ovum[]{
  return s.byAsset[id]?.eggs??emptyEggs;
}

function ownsControls(assetId:string,runtimeId:string){
  const bag=useBackpack.getState(),live=bag.live[assetId];
  return bag.selected===assetId&&!bag.busy&&!bag.draft&&live?.visible&&live.runtimeId===runtimeId&&bag.entries.some(e=>e.id===assetId&&e.kind==='model');
}
export function setConceptionChance(assetId:string,runtimeId:string,percent:number){
  if(!Number.isFinite(percent)||!ownsControls(assetId,runtimeId))return false;
  const chance=Math.max(0,Math.min(100,percent));
  useConception.setState(s=>chanceFor(assetId,s)===chance?s:{byAsset:{...s.byAsset,[assetId]:{...(s.byAsset[assetId]??emptyAccount),chance}}});
  return true;
}

export function forceOvulation(assetId:string,runtimeId:string):boolean{
  if(!ownsControls(assetId,runtimeId))return false;
  const eggs=eggsFor(assetId);if(eggs.length>=MAX_EGGS)return false;
  const id=eggs.length+1,egg:Ovum={id,side:id%2?-1:1,fertilized:false};
  useConception.setState(s=>({byAsset:{...s.byAsset,[assetId]:{...(s.byAsset[assetId]??emptyAccount),eggs:[...eggs,egg]}}}));
  return true;
}

/** Only the pelvic delivery path owns this command. World-hand delivery has no selected actor. */
export function recordInternalDose(id:string,amount:number,target?:ConceptionEvent['target']){
  if(!Number.isFinite(amount)||amount<=0||!useBackpack.getState().entries.some(e=>e.id===id&&e.kind==='model'))return;
  useConception.setState(s=>{
    const eggs=eggsFor(id,s),egg=eggs.find(e=>!e.fertilized);
    if(!egg)return s;
    const chance=chanceFor(id,s),event=resolveConception(++sequence,chance,egg.side,target);
    return {byAsset:{...s.byAsset,[id]:{chance,event,eggs:eggs.map(e=>e===egg?{...egg,fertilized:event.success,event}:e)}}};
  });
}

useBackpack.subscribe((bag,prev)=>{
  if(bag.entries===prev.entries)return;
  const kept=new Set(bag.entries.filter(e=>e.kind==='model').map(e=>e.id));
  useConception.setState(s=>{
    let byAsset=s.byAsset;
    for(const id of Object.keys(byAsset))if(!kept.has(id)){
      if(byAsset===s.byAsset)byAsset={...byAsset};
      delete byAsset[id];
    }
    return byAsset===s.byAsset?s:{byAsset};
  });
});
