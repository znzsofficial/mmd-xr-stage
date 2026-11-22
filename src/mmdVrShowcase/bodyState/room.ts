import { useBackpack } from '../backpack';
import type { MmdRuntimeHandle } from '../mmdRuntime/mmdRuntime';
import { advanceLiveBodies, cancelBodyPreview, useBodyState, type BodySupport } from './store';
import type { BodyProfile } from './data';

type Binding = {runtimeId:string; profile:BodyProfile; draft:boolean; elapsed:number; visible:boolean;
  support:BodySupport; published:BodySupport & {runtimeId:string}};

/** Room-local bridge. Never key persistent state by a transient runtime ID;
 * even a cold physics rebuild can replace the underlying mesh under that ID. */
export function createBodyRoom(runtime:Pick<MmdRuntimeHandle,'getBodySupport'|'setBodyProfile'>, invalidate:()=>void) {
  const bindings=new Map<string,Binding>(); let disposed=false;
  function sync(){
    if(disposed)return;
    const bag=useBackpack.getState(), state=useBodyState.getState(); let support=state.support;
    const writable=()=>{if(support===state.support)support={...support};return support;};
    for(const [id,b] of bindings){
      if(bag.live[id]?.runtimeId===b.runtimeId && (state.byAsset[id]||state.draft?.assetId===id))continue;
      if(runtime.setBodyProfile?.(b.runtimeId,null))invalidate();
      if(support[id]===b.published)delete writable()[id];
      bindings.delete(id);
    }
    for(const [id,live] of Object.entries(bag.live)){
      const draft=state.draft?.assetId===id, profile=draft?state.draft!.value:state.byAsset[id];
      if(!profile)continue;
      const ability=runtime.getBodySupport?.(live.runtimeId);
      if(!ability)continue; // a different room owns this newly published map
      let b=bindings.get(id);
      const newlyVisible=live.visible&&(!b?.visible||b.support!==ability);
      if(!b || b.support!==ability){
        const published={...ability,runtimeId:live.runtimeId};
        b={runtimeId:live.runtimeId,published,support:ability,profile,draft,elapsed:0,visible:live.visible};
        bindings.set(id,b); writable()[id]=published;
      }else if(b.profile===profile && b.draft===draft && b.visible===live.visible)continue;
      if(b.draft!==draft||b.visible!==live.visible||b.profile!==profile)b.elapsed=0;
      b.profile=profile; b.draft=draft; b.visible=live.visible;
      if(runtime.setBodyProfile?.(live.runtimeId,profile)||newlyVisible)invalidate();
    }
    if(support!==state.support)useBodyState.setState({support});
  }
  const stopBag=useBackpack.subscribe((s,p)=>{if(s.live!==p.live||s.entries!==p.entries)sync();});
  const stopState=useBodyState.subscribe((s,p)=>{if(s.byAsset!==p.byAsset||s.draft!==p.draft)sync();});
  sync();
  return {
    advance(delta:number){
      if(disposed||!Number.isFinite(delta)||delta<=0)return;
      for(const [id,b] of bindings){
        if(!b.visible || b.profile.locked&&(!b.profile.lactating||Math.min(b.profile.left,b.profile.right)===1))continue;
        // No per-frame UI writes. The caller has already excluded hidden-tab,
        // paused-session and busy time; do not derive delta from an absolute time.
        b.elapsed+=delta;
        if(b.elapsed>=.25){const elapsed=b.elapsed;b.elapsed=0;advanceLiveBodies([id],elapsed);}
      }
    },
    dispose(){
      if(disposed)return; disposed=true; stopBag(); stopState();
      const support={...useBodyState.getState().support}; let changed=false;
      for(const [id,b] of bindings){
        runtime.setBodyProfile?.(b.runtimeId,null);
        if(support[id]===b.published){delete support[id];changed=true;cancelBodyPreview(id);}
      }
      if(changed)useBodyState.setState({support}); bindings.clear();
    },
  };
}
