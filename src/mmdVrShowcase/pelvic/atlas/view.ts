import {create} from 'zustand';
import {useBackpack} from '../../backpack/store';
import type {FoldStyle} from '../vulvaForm';
import {MAX_EGGS} from '../../bodyState/reproduction/game';

// Camera and illustration transport are presentation only. They must never
// call the contact solver, change a ledger or advance the character's day.
export const atlasAngles = {front:0,oblique:38,side:90} as const;
/** The fitting sheet only selects measurements. Body illustrations use
 * their named, read-only scope independently of the instrument panel. */
export type AtlasMode='entry'|'measure';
export type AtlasView={mode:AtlasMode;degrees:number;motion:boolean;labels:boolean;foldStyle:FoldStyle;eggId:number};
const initial:AtlasView={mode:'entry',degrees:atlasAngles.oblique,motion:true,labels:false,foldStyle:'natural',eggId:1};
const reduced:AtlasView={...initial,motion:false};
let preference:MediaQueryList|undefined;
const defaults=()=>{
  if(!preference&&typeof window!=='undefined')preference=window.matchMedia?.('(prefers-reduced-motion: reduce)');
  return preference?.matches?reduced:initial;
};
export const useAtlasSettings=create<{actors:Record<string,AtlasView>}>(()=>({actors:{}}));
export function readAtlasView(id:string){return useAtlasSettings.getState().actors[id]??defaults();}
export function useAtlasView(id:string){return useAtlasSettings(s=>s.actors[id]??defaults());}
export function setAtlasView(id:string,patch:Partial<AtlasView>){
  const old=readAtlasView(id),next={...old,...patch};
  if(!Number.isFinite(next.degrees)||!Number.isInteger(next.eggId)||next.eggId<1||next.eggId>MAX_EGGS)return;
  next.degrees=Math.min(90,Math.max(-90,Math.round(next.degrees)));
  if(next.mode===old.mode&&next.motion===old.motion&&next.degrees===old.degrees&&next.labels===old.labels&&next.foldStyle===old.foldStyle&&next.eggId===old.eggId)return;
  useAtlasSettings.setState(s=>({actors:{...s.actors,[id]:next}}));
}
useBackpack.subscribe((s,p)=>{if(s.entries===p.entries)return;
  const actors=useAtlasSettings.getState().actors,keep=Object.entries(actors).filter(([id])=>s.entries.some(e=>e.id===id));
  if(keep.length!==Object.keys(actors).length)useAtlasSettings.setState({actors:Object.fromEntries(keep)});
});
