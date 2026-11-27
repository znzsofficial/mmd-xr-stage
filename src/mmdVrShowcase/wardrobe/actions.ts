import { useBackpack } from '../backpack/store';
import { setActorMilk, useBodyState } from '../bodyState/store';
import { useHudWorldInput } from '../hud/hudWorldInput';
import { useMmdVrStore } from '../mmdVrStore';
import { patchPelvic, usePelvic } from '../pelvic/store';
import type { WardrobeModel } from './model';

type Actor={assetId:string; runtimeId:string};
export type WardrobeProps=Actor & {onBack:()=>void; backLabel?:string};
type Previous={visible?:boolean;opacity?:number;weight?:number|null};
type Receipt={before:Previous;last:Previous};
const history=new WeakMap<File,Map<string,Receipt>>();
const skinHistory=new WeakMap<File,Map<string,{before:File|null;last:File|null}>>();
export function resolveActor({assetId,runtimeId}:Actor){
  const bag=useBackpack.getState(),stage=useMmdVrStore.getState(),live=bag.live[assetId];
  if(!stage.overlayOpen||stage.physicsBusy||stage.physicsFatal||stage.assetLoad.running||bag.busy||bag.draft||bag.selected!==assetId||!live?.visible||live.runtimeId!==runtimeId||
    stage.pendingModelRemovals.includes(runtimeId)||stage.pendingVisibilityToggles.includes(runtimeId)||stage.presentation==='xr'&&useHudWorldInput.getState().blocked)return null;
  const f=bag.entries.find(e=>e.id===assetId&&e.kind==='model')?.file;
  return f&&stage.materialModels[runtimeId]?stage.runtimeRef?.getWardrobe?.(runtimeId,f)??null:null;
}
export function hasWardrobeUndo(model:WardrobeModel){return !!history.get(model.file)?.size||!!skinHistory.get(model.file)?.size;}
export function recheckClothing(assetId:string){
  if(usePelvic.getState().byAsset[assetId]?.clothingClear)patchPelvic(assetId,{clothingClear:false});
}
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
  let changes=history.get(model.file);if(!changes)history.set(model.file,changes=new Map());
  const journalKey=(morph?'m:':'s:')+key,receipt:Receipt=changes.get(journalKey)??{before:{},last:{}};
  if(remember&&receipt.last[field]!==before)Object.assign(receipt.before,{[field]:before});
  Object.assign(receipt.last,{[field]:next});
  if(receipt.before[field]===next){delete receipt.before[field];delete receipt.last[field];}
  if(Object.keys(receipt.before).length)changes.set(journalKey,receipt);else changes.delete(journalKey);
  // A wardrobe edit cannot itself verify exposed skin. The independent
  // clothed mode (when selected) stays clothed, not promoted to clear.
  recheckClothing(actor.assetId);
  if(morph)stage.runtimeRef?.invalidateWardrobe?.();
  else if('visible' in change)stage.setMaterialVisible(actor.runtimeId,key,change.visible);
  else stage.setMaterialParam(actor.runtimeId,key,'opacity',change.opacity);
  return true;
}

export function restoreOutfit(actor:Actor,model:WardrobeModel,mode:'original'|'undo',onlySlot?:string){
  if(resolveActor(actor)!==model)return;
  if(onlySlot===undefined){
    for(const s of model.slots){
      const {active,pending}=model.skin.status(s.key),receipt=skinHistory.get(model.file)?.get(s.key);
      if(mode==='original'&&(active||pending))void selectSkin(actor,model,s.key,null,()=>true);
      else if(mode==='undo'&&receipt&&receipt.last===active)void selectSkin(actor,model,s.key,receipt.before,()=>true);
    }
  }
  const journal=history.get(model.file);if(!journal)return;
  for(const [key,receipt] of [...journal]){
    if(onlySlot!==undefined&&key!=='s:'+onlySlot)continue;
    const name=key.slice(2),before={...receipt.before},last={...receipt.last};
    const mat=useMmdVrStore.getState().materialModels[actor.runtimeId]?.find(m=>m.name===name);
    // Compare before writing: a later edit made in Materials owns that
    // field. Original outfit never resets an entire skin/garment material.
    if(before.visible!==undefined&&mat?.visible===last.visible)editWardrobe(actor,model,name,{visible:mode==='undo'?before.visible:true},false);
    if(before.opacity!==undefined&&mat?.opacity===last.opacity)editWardrobe(actor,model,name,{opacity:mode==='undo'?before.opacity:1},false);
    if(before.weight!==undefined&&model.weight(name)===last.weight)editWardrobe(actor,model,name,{weight:mode==='undo'?before.weight:null},false);
    if(mode==='undo')journal.delete(key);
  }
}

export function registerPiece(actor:Actor,model:WardrobeModel,key:string,on:boolean){
  if(resolveActor(actor)!==model)return false;
  if(!on&&model.manual(key))restoreOutfit(actor,model,'undo',key);
  return model.register(key,on);
}

export async function selectSkin(actor:Actor,model:WardrobeModel,key:string,file:File|null,current:()=>boolean){
  const valid=()=>current()&&resolveActor(actor)===model;
  const before=model.skin.status(key).active;
  if(!await model.skin.select(key,file,valid)||!valid()||file===before)return;
  let journal=skinHistory.get(model.file);if(!journal)skinHistory.set(model.file,journal=new Map());
  const prev=journal.get(key),original=prev?.last===before?prev.before:before;
  if(original===file)journal.delete(key);else journal.set(key,{before:original,last:file});
  // A colour-map swap is never proof of bare skin; old confirmations refer
  // to a different surface appearance. The geometry probes keep final say.
  recheckClothing(actor.assetId);
  const body=useBodyState.getState().byAsset[actor.assetId];if(body?.bareLeft||body?.bareRight)setActorMilk(actor,{bareLeft:false,bareRight:false});
  const stage=useMmdVrStore.getState(),list=stage.materialModels[actor.runtimeId];
  if(list)stage.setMaterialModels({...stage.materialModels,[actor.runtimeId]:[...list]});
}
