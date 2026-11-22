import { useBackpack } from '../backpack';
import { useHudWorldInput } from '../components/hudWorldInput';
import { useMmdVrStore } from '../mmdVrStore';
import { patchPelvic, usePelvic } from '../pelvic/store';
import type { WardrobeModel } from './model';

type Actor={assetId:string; runtimeId:string};
export type WardrobeProps=Actor & {onBack:()=>void; backLabel?:string};
type Previous={visible?:boolean;opacity?:number;weight?:number|null};
const history=new WeakMap<WardrobeModel,Map<string,Previous>>();
export function resolveActor({assetId,runtimeId}:Actor){
  const bag=useBackpack.getState(),stage=useMmdVrStore.getState(),live=bag.live[assetId];
  if(!stage.overlayOpen||stage.physicsBusy||stage.physicsFatal||stage.assetLoad.running||bag.busy||bag.draft||bag.selected!==assetId||!live?.visible||live.runtimeId!==runtimeId||
    stage.pendingModelRemovals.includes(runtimeId)||stage.pendingVisibilityToggles.includes(runtimeId)||stage.presentation==='xr'&&useHudWorldInput.getState().blocked)return null;
  const f=bag.entries.find(e=>e.id===assetId&&e.kind==='model')?.file;
  return f&&stage.materialModels[runtimeId]?stage.runtimeRef?.getWardrobe?.(runtimeId,f)??null:null;
}
export function hasWardrobeUndo(model:WardrobeModel){return !!history.get(model)?.size;}
export function editWardrobe(actor:Actor,model:WardrobeModel,key:string,change:{visible:boolean}|{opacity:number}|{weight:number|null},remember=true){
  // Callback may have survived React batching, physics rollback, or a new
  // instance of the same File with the same runtime ID. Check the actual mesh.
  if(resolveActor(actor)!==model)return false;
  const morph='weight' in change,stage=useMmdVrStore.getState();
  if(!model.pieces.some(p=>p.key===key&&(p.kind==='morph')===morph))return false;
  const mat=stage.materialModels[actor.runtimeId].find(m=>m.name===key);
  if(!morph&&!mat)return false;
  const field=morph?'weight':'visible' in change?'visible':'opacity';
  const next=morph?change.weight:'visible' in change?change.visible:change.opacity;
  const before=morph?model.weight(key):field==='visible'?mat!.visible:mat!.opacity;
  if(next===before||typeof next==='number'&&(!Number.isFinite(next)||next<0||next>1))return false;
  if(morph&&!model.setWeight(key,change.weight))return false;
  let changes=history.get(model);if(!changes)history.set(model,changes=new Map());
  const journalKey=(morph?'m:':'s:')+key,original=changes.get(journalKey)??{};
  if(remember&&!Object.hasOwn(original,field))Object.assign(original,{[field]:before});
  if(original[field]===next)delete original[field];
  if(Object.keys(original).length)changes.set(journalKey,original);else changes.delete(journalKey);
  // A wardrobe edit cannot itself verify exposed skin. The independent
  // clothed mode (when selected) stays clothed, not promoted to clear.
  if(usePelvic.getState().byAsset[actor.assetId]?.clothingClear)patchPelvic(actor.assetId,{clothingClear:false});
  if(morph)stage.runtimeRef?.invalidateWardrobe?.();
  else if('visible' in change)stage.setMaterialVisible(actor.runtimeId,key,change.visible);
  else stage.setMaterialParam(actor.runtimeId,key,'opacity',change.opacity);
  return true;
}

export function restoreOutfit(actor:Actor,model:WardrobeModel,mode:'original'|'undo'){
  if(resolveActor(actor)!==model)return;
  if(mode==='undo'){
    for(const [key,p] of [...(history.get(model)??[])]){
      const name=key.slice(2),before={...p};
      if(before.visible!==undefined)editWardrobe(actor,model,name,{visible:before.visible},false);
      if(before.opacity!==undefined)editWardrobe(actor,model,name,{opacity:before.opacity},false);
      if(before.weight!==undefined)editWardrobe(actor,model,name,{weight:before.weight},false);
    }
    history.delete(model);return;
  }
  for(const p of model.pieces){if(p.kind==='morph')editWardrobe(actor,model,p.key,{weight:null});
    else{editWardrobe(actor,model,p.key,{visible:true});editWardrobe(actor,model,p.key,{opacity:1});}}
}
