import {create} from 'zustand';
import {useBackpack} from '../../backpack';
import {DEFAULT_CHANCE,resolveConception,type ConceptionEvent} from './game';

export type {ConceptionEvent} from './game';
type Account={chance:number;event?:ConceptionEvent};
type State={byAsset:Record<string,Account>};
export const useConception=create<State>(()=>({byAsset:{}}));
let sequence=0;

export function chanceFor(id:string,s=useConception.getState()):number {
  return s.byAsset[id]?.chance??DEFAULT_CHANCE;
}

export function setConceptionChance(assetId:string,runtimeId:string,percent:number){
  const bag=useBackpack.getState(),live=bag.live[assetId];
  if(!Number.isFinite(percent)||bag.selected!==assetId||bag.busy||bag.draft||!live?.visible||live.runtimeId!==runtimeId||
    !bag.entries.some(e=>e.id===assetId&&e.kind==='model'))return false;
  const chance=Math.max(0,Math.min(100,percent));
  useConception.setState(s=>chanceFor(assetId,s)===chance?s:{byAsset:{...s.byAsset,[assetId]:{...s.byAsset[assetId],chance}}});
  return true;
}

/** Only the pelvic delivery path owns this command. World-hand delivery has no selected actor. */
export function recordInternalDose(id:string,amount:number,target?:ConceptionEvent['target']){
  if(!Number.isFinite(amount)||amount<=0||!useBackpack.getState().entries.some(e=>e.id===id&&e.kind==='model'))return;
  useConception.setState(s=>{
    const chance=chanceFor(id,s);
    // Alternate this actor's illustration side without drawing another random number.
    const event=resolveConception(++sequence,chance,s.byAsset[id]?.event?.side===-1?1:-1,target);
    return {byAsset:{...s.byAsset,[id]:{chance,event}}};
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
