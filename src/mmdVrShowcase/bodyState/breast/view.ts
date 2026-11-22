import {create} from 'zustand';
import {useBackpack} from '../../backpack';

export type BreastView={degrees:number;motion:boolean;section:boolean;labels:boolean};
// Start square to the actor: bilateral fullness and the round lower outline
// are easiest to compare from the front. Returning retains that actor's angle.
const normal:BreastView={degrees:0,motion:true,section:false,labels:false},reduced={...normal,motion:false};
let preference:MediaQueryList|undefined;
function initial(){
  if(!preference&&typeof window!=='undefined')preference=window.matchMedia?.('(prefers-reduced-motion: reduce)');
  return preference?.matches?reduced:normal;
}
export const breastViews=create<{actors:Record<string,BreastView>}>(()=>({actors:{}}));
export const readBreastView=(id:string)=>breastViews.getState().actors[id]??initial();
export const useBreastView=(id:string)=>breastViews(s=>s.actors[id]??initial());
export function setBreastView(id:string,patch:Partial<BreastView>){
  const old=readBreastView(id),degrees=Math.min(90,Math.max(-90,Math.round(patch.degrees??old.degrees))),motion=patch.motion??old.motion;
  const section=patch.section??old.section,labels=patch.labels??old.labels;
  if(!Number.isFinite(degrees)||degrees===old.degrees&&motion===old.motion&&section===old.section&&labels===old.labels)return;
  breastViews.setState(s=>({actors:{...s.actors,[id]:{degrees,motion,section,labels}}}));
}
useBackpack.subscribe((s,p)=>{if(s.entries===p.entries)return;
  const a=breastViews.getState().actors,entries=Object.entries(a).filter(([id])=>s.entries.some(e=>e.id===id));
  if(entries.length!==Object.keys(a).length)breastViews.setState({actors:Object.fromEntries(entries)});
});
