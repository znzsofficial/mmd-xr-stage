import { Matrix4, Raycaster, type Material, type Ray, type Scene, type Texture } from 'three';
import { useBackpack } from '../backpack/store';
import type { MmdRuntimeHandle } from '../mmdRuntime/mmdRuntime';
import { useMmdVrStore, type MmdVrMaterialState } from '../mmdVrStore';
import type { WandModel } from '../play/wandSurface';
import { stockingBlockers, stockingDraws } from './stockingDraws';
import { inspectStockingFit, type StockingFitResult } from './stockingFit';
import { mountStockings } from './stockingMount';
import { disarmStockingTear, readStockingState, rejectStockingFit } from './stockingState';
import { stockingWorldBlocks } from './stockingSight';
import { stockingSources } from './stockingSources';
import { garmentKeys } from './slots';

type FitStatus = 'unknown' | 'ready' | 'unavailable';
type Stockings = ReturnType<typeof mountStockings>;
type Actor = { assetId:string; model:WandModel; visible:boolean; transform:Matrix4;
  materials?:readonly MmdVrMaterialState[]; sources?:ReturnType<typeof fitSources>;
  garmentTags?:ReadonlySet<string>; draws?:ReturnType<typeof stockingDraws>; fit?:StockingFitResult; stockings?:Stockings; blocks?:ReturnType<typeof stockingBlockers> };
type Room = ReturnType<typeof mountStockingRoom>;
let current: Room | null = null;
const listeners = new Set<() => void>();
const notify = () => { for (const listener of listeners) listener(); };

// A published material edit can affect the visibility or alpha of the fitting
// surface. A separately drawn shoe only changes live occlusion. Compare these
// inputs on an edit, never by scanning draws or sampling texels on idle frames.
function fitSources(model:WandModel, draws:ReturnType<typeof stockingDraws>) {
  return stockingSources(model.mesh,draws).map(draw=>{
    const mat=draw.material() as Material & {map?:Texture|null};
    const map:Texture|null=(mat.transparent || mat.alphaTest) ? mat.map ?? mat.userData.mmdTslSourceDiffuseTexture ?? null : null;
    return {draw,map,opacity:mat.opacity,alphaTest:mat.alphaTest};
  });
}

function materialsAffectFit(a:Actor, materials:Actor['materials']) {
  if (a.materials===materials) return false;
  a.materials=materials;
  const previous=a.sources;
  if (!a.draws || !previous) return true;
  const next=fitSources(a.model,a.draws);
  return next.length!==previous.length || next.some(({draw,map,opacity,alphaTest},i)=>{
    const old=previous[i]; return draw!==old.draw || map!==old.map || opacity!==old.opacity || alphaTest!==old.alphaTest;
  });
}

export function subscribeStockingFit(listener:()=>void) { listeners.add(listener); return ()=>{listeners.delete(listener);}; }
export function readStockingFit(runtimeId:string):StockingFitResult|null { return current?.fit(runtimeId) ?? null; }
export function stockingFitStatus(runtimeId:string):FitStatus { return current?.status(runtimeId) ?? 'unknown'; }
export function readStockingFitOwner(runtimeId:string):object|null { return current?.owner(runtimeId) ?? null; }
export function pickStockingSurface(runtimeId:string,ray:Ray) { return current?.pick(runtimeId,ray) ?? null; }

/** Install only from the committed room effect. Loaded model identity, not
 * its file/runtime id, owns every CPU sampler, mesh, texture and pick cache. */
export function mountStockingRoom(scene:Scene,runtime:Pick<MmdRuntimeHandle,'getModelSurface'>,stale:()=>boolean,sight:(ray:Ray,point:Ray['origin'])=>boolean) {
  const actors=new Map<string,Actor>(), caster=new Raycaster();
  let frame=0;
  function actor(id:string,assetId:string,model:WandModel) {
    const old=actors.get(id);
    if (old?.model===model && old.assetId===assetId) return old;
    old?.stockings?.dispose();
    const next:Actor={assetId,model,transform:new Matrix4(),visible:false};
    actors.set(id,next);
    // A pick can encounter a replacement occluder before the next advance.
    if (old?.fit) notify();
    return next;
  }
  function advance(evaluated:boolean) {
    frame++;
    const live=useBackpack.getState().live;
    const materials=useMmdVrStore.getState().materialModels;
    let changed=false;
    for (const [id,a] of actors) {
      if (live[a.assetId]?.runtimeId!==id || runtime.getModelSurface(id)!==a.model) {
        a.stockings?.dispose(); actors.delete(id); changed ||= !!a.fit;
      } else if (a.fit && (a.garmentTags!==garmentKeys(a.model.mesh) || (live[a.assetId].visible && materialsAffectFit(a,materials[id])))) {
        // A held pull still owns the old triangles even when the model stays.
        disarmStockingTear({assetId:a.assetId,runtimeId:id});
        a.stockings?.dispose(); a.stockings=undefined; a.fit=undefined; a.sources=undefined; changed=true;
      }
    }
    for (const assetId in live) {
      const l=live[assetId], state=readStockingState(assetId), id=l.runtimeId;
      if (!state.worn || !l.visible) {
        const a=actors.get(id);
        if (a?.stockings) { a.stockings.dispose(); a.stockings=undefined; }
        if (a) a.visible=false;
        continue;
      }
      const model=runtime.getModelSurface(id); if (!model) continue;
      const a=actor(id,assetId,model);
      if (!a.fit) {
        a.garmentTags=garmentKeys(model.mesh);
        a.draws??=stockingDraws(model); a.materials=materials[id]; a.sources=fitSources(model,a.draws);
        a.fit=inspectStockingFit(model.mesh,a.draws);
        changed=true;
      }
      if (!a.fit.patches) { rejectStockingFit({assetId,runtimeId:id}); continue; }
      a.stockings??=mountStockings(scene,a.fit.patches,id);
      const moved=!a.transform.equals(model.root.matrixWorld);
      a.stockings.update(frame,evaluated||moved||!a.visible,state.tears);
      a.transform.copy(model.root.matrixWorld); a.visible=true;
    }
    if (changed) notify();
  }
  const room={ advance, fit:(id:string)=>actors.get(id)?.fit ?? null, status:(id:string):FitStatus=>{
    const fit=actors.get(id)?.fit; return !fit ? 'unknown' : fit.patches ? 'ready' : 'unavailable';
  }, owner:(id:string)=>{
    const a=actors.get(id); return a?.fit?.patches ? a.model : null;
  }, pick(id:string,ray:Ray) {
    const a=actors.get(id), live=useBackpack.getState().live;
    if (stale() || !a?.stockings || !a.visible || !live[a.assetId]?.visible || live[a.assetId]?.runtimeId!==id ||
      !readStockingState(a.assetId).worn || runtime.getModelSurface(id)!==a.model) return null;
    caster.ray.copy(ray); caster.far=Infinity;
    const hit=a.stockings.pick(caster); if (!hit || !sight(ray,hit.point)) return null;
    caster.far=hit.distance;
    if (stockingWorldBlocks(scene,caster)) return null;
    for (const assetId in live) {
      const l=live[assetId]; if (!l.visible) continue;
      const model=runtime.getModelSurface(l.runtimeId); if (!model) continue;
      const other=actor(l.runtimeId,assetId,model);
      if (other!==a && other.stockings?.pick(caster)) return null;
      other.draws??=stockingDraws(model); other.blocks??=stockingBlockers(other.draws);
      if (other.blocks(frame,ray,hit.distance)) return null;
    }
    return hit;
  }, dispose(){
    for (const a of actors.values()) a.stockings?.dispose();
    actors.clear(); if (current===room) { current=null; notify(); }
  } };
  current=room; notify(); return room;
}
