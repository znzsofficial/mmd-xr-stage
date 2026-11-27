import { Matrix4, Raycaster, type Ray, type Scene } from 'three';
import { useBackpack } from '../backpack/store';
import type { MmdRuntimeHandle } from '../mmdRuntime/mmdRuntime';
import type { WandModel } from '../play/wandSurface';
import { stockingBlockers, stockingDraws } from './stockingDraws';
import { fitStockings } from './stockingFit';
import { mountStockings } from './stockingMount';
import { readStockingState,rejectStockingFit } from './stockingState';
import { stockingWorldBlocks } from './stockingSight';
import { garmentKeys } from './slots';

type FitStatus = 'unknown' | 'ready' | 'unavailable';
type Stockings = ReturnType<typeof mountStockings>;
type Actor = { assetId:string; model:WandModel; status:FitStatus; visible:boolean; transform:Matrix4;
  garmentTags?:ReadonlySet<string>; draws?:ReturnType<typeof stockingDraws>; fits?:ReturnType<typeof fitStockings>; stockings?:Stockings; blocks?:ReturnType<typeof stockingBlockers> };
type Room = ReturnType<typeof mountStockingRoom>;
let current: Room | null = null;
const listeners = new Set<() => void>();
const notify = () => { for (const listener of listeners) listener(); };

export function subscribeStockingFit(listener:()=>void) { listeners.add(listener); return ()=>{listeners.delete(listener);}; }
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
    const next:Actor={assetId,model,status:'unknown',transform:new Matrix4(),visible:false};
    actors.set(id,next); return next;
  }
  function advance(evaluated:boolean) {
    frame++;
    const live=useBackpack.getState().live;
    let changed=false;
    for (const [id,a] of actors) {
      if (live[a.assetId]?.runtimeId!==id || runtime.getModelSurface(id)!==a.model) {
        a.stockings?.dispose(); actors.delete(id); changed ||= a.status!=='unknown';
      } else if (a.fits!==undefined && a.garmentTags!==garmentKeys(a.model.mesh)) {
        a.stockings?.dispose(); a.stockings=undefined; a.fits=undefined; a.status='unknown'; changed=true;
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
      if (a.fits===undefined) {
        a.garmentTags=garmentKeys(model.mesh);
        a.draws??=stockingDraws(model); a.fits=fitStockings(model.mesh,a.draws);
        a.status=a.fits?'ready':'unavailable'; changed=true;
      }
      if (!a.fits) { rejectStockingFit({assetId,runtimeId:id}); continue; }
      a.stockings??=mountStockings(scene,a.fits,id);
      const moved=!a.transform.equals(model.root.matrixWorld);
      a.stockings.update(frame,evaluated||moved||!a.visible,state.tears);
      a.transform.copy(model.root.matrixWorld); a.visible=true;
    }
    if (changed) notify();
  }
  const room={ advance, status:(id:string):FitStatus=>actors.get(id)?.status??'unknown', owner:(id:string)=>{
    const a=actors.get(id); return a?.status==='ready' ? a.model : null;
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
