import {create} from 'zustand';
import {useBackpack} from '../../backpack';
import {BODY_DAY_SECONDS,type BodyProfile} from '../data';
import {nextMilestone,progressDays,receiveDose,stageOf,startGame,type ReproductionGame} from './game';
import {recordPictureTransition} from './pictureClock';

type Account={enabled:boolean;game:ReproductionGame};
type State={byAsset:Record<string,Account>};
export const useReproduction=create<State>(()=>({byAsset:{}}));
const state=useReproduction.getState;
const seconds=new Map<string,number>(); // Fractional stage time survives room changes; no per-frame publications.
function put(id:string,account:Account){
  const previous=state().byAsset[id];
  if(previous&&previous.game!==account.game&&account.game.trial)recordPictureTransition(previous.game,account.game,performance.now());
  useReproduction.setState(s=>({byAsset:{...s.byAsset,[id]:account}}));
}
export function activeGame(id:string,s=state()){const a=s.byAsset[id];return a?.enabled?a.game:undefined;}

/** Only a committed setting starts/resumes a book. Clearing settings pauses
 * an existing book for Undo, rather than manufacturing a second trial. */
export function configureReproduction(id:string,p:BodyProfile|null){
  const saved=state().byAsset[id],enabled=!!p?.reproduction;
  if(saved){if(saved.enabled!==enabled)put(id,{...saved,enabled});}
  else if(enabled&&p){
    // Backpack IDs restart on each page. Only a new actor book draws entropy;
    // all subsequent rounds and resume/undo operations keep the book's seed.
    const seed=crypto.getRandomValues(new Uint32Array(4)).join('-');
    seconds.set(id,p.daySeconds);put(id,{enabled,game:startGame(seed,p)});
  }
}
export function recordInternalDose(id:string,amount:number){
  const g=activeGame(id);if(!g||!Number.isFinite(amount)||amount<=0)return;
  const next=receiveDose(g);if(next!==g)put(id,{enabled:true,game:next});
}
export function advanceReproductiveClock(id:string,p:BodyProfile,delta:number){
  if(!p.reproduction||p.locked||!(delta>0)||!Number.isFinite(delta))return;
  const g=activeGame(id);if(!g||stageOf(g)==='complete')return;
  const elapsed=(seconds.get(id)??0)+delta,days=Math.floor(elapsed/BODY_DAY_SECONDS);
  seconds.set(id,elapsed%BODY_DAY_SECONDS);
  if(days)put(id,{enabled:true,game:progressDays(g,days,p)});
}
export function jumpReproductiveClock(id:string,p:BodyProfile,expected:ReproductionGame){
  const g=activeGame(id);if(!p.reproduction||g!==expected)return 0;
  const days=nextMilestone(g).days;if(!days)return 0;
  seconds.delete(id);put(id,{enabled:true,game:progressDays(g,days,p)});
  return days;
}
useBackpack.subscribe((bag,prev)=>{
  if(bag.entries===prev.entries)return;
  const old=state().byAsset,retired=Object.keys(old).filter(id=>!bag.entries.some(e=>e.kind==='model'&&e.id===id));
  if(!retired.length)return;
  const byAsset={...old};for(const id of retired){seconds.delete(id);delete byAsset[id];}useReproduction.setState({byAsset});
});
