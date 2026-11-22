import { create } from 'zustand';
import { useBackpack } from '../backpack';
import { advanceBody, DEFAULT_BODY_PROFILE, moveDay, normalizeBody, type BodyProfile } from './data';

export type BodySupport = { morphs:readonly string[]; bones:boolean; sides:{left:boolean;right:boolean}; clothing:'authored-only' };
type LiveSupport = BodySupport & {runtimeId:string};
type Draft = { assetId:string; value:BodyProfile };
type Inspection = {assetId:string;runtimeId:string};
type State = {byAsset:Record<string,BodyProfile>; draft:Draft|null; support:Record<string,LiveSupport>; inspection:Inspection|null};
export const useBodyState = create<State>(()=>({byAsset:{},draft:null,support:{},inspection:null}));

/** Opening tools asks the mounted room what this model can display. It does
 * not create a profile, start its clock, or apply a default shape. */
export function inspectBody(assetId:string,runtimeId:string){
  const inspection={assetId,runtimeId}; useBodyState.setState({inspection});
  return ()=>{if(useBodyState.getState().inspection===inspection){cancelBodyPreview(assetId);useBodyState.setState({inspection:null});}};
}

export function beginBodyPreview(assetId:string, confirmedAdult=false):boolean {
  const bag=useBackpack.getState(), s=useBodyState.getState(), saved=s.byAsset[assetId];
  if(bag.selected!==assetId || bag.busy || bag.draft || !bag.live[assetId]?.visible || !bag.entries.some(e=>e.id===assetId&&e.kind==='model'))return false;
  if(s.draft?.assetId===assetId)return true;
  if(!saved && confirmedAdult!==true)return false;
  useBodyState.setState({draft:{assetId,value:{...(saved??DEFAULT_BODY_PROFILE)}}});
  return true;
}

function edit(assetId:string, fn:(p:BodyProfile)=>BodyProfile) {
  const d=useBodyState.getState().draft;
  if(d?.assetId!==assetId)return;
  const value=fn(d.value);
  if(value!==d.value)useBodyState.setState({draft:{assetId,value}});
}
export function patchBodyPreview(assetId:string, patch:Partial<BodyProfile>) {
  edit(assetId,p=>normalizeBody({...p,...patch,...(patch.day!==undefined&&patch.daySeconds===undefined?{daySeconds:0}:{})}));
}
export function stepBodyDay(assetId:string, days=1) {edit(assetId,p=>moveDay(p,days));}
export function drainBodySide(assetId:string, side:'left'|'right', amount=.25) {
  if(!(amount>0) || !Number.isFinite(amount) || (side!=='left'&&side!=='right'))return;
  edit(assetId,p=>p.lactating?{...p,[side]:Math.max(0,p[side]-amount)}:p);
}
export function commitBodyPreview(assetId:string) {
  const {draft,byAsset}=useBodyState.getState();
  if(draft?.assetId===assetId)useBodyState.setState({byAsset:{...byAsset,[assetId]:draft.value},draft:null});
}
export function cancelBodyPreview(assetId:string) {
  if(useBodyState.getState().draft?.assetId===assetId)useBodyState.setState({draft:null});
}
export function disableBodyState(assetId:string) {
  const {byAsset,draft}=useBodyState.getState();
  if(!byAsset[assetId]&&draft?.assetId!==assetId)return;
  const next={...byAsset}; delete next[assetId];
  useBodyState.setState({byAsset:next,draft:draft?.assetId===assetId?null:draft});
}

export function advanceLiveBodies(ids:Iterable<string>, seconds:number) {
  const s=useBodyState.getState(); let byAsset=s.byAsset,draft=s.draft;
  for(const id of ids){
    if(draft?.assetId===id){
      const value=advanceBody(draft.value,seconds); if(value!==draft.value)draft={assetId:id,value};
    }else if(byAsset[id]){
      const value=advanceBody(byAsset[id],seconds);
      if(value!==byAsset[id]){if(byAsset===s.byAsset)byAsset={...byAsset}; byAsset[id]=value;}
    }
  }
  if(byAsset!==s.byAsset||draft!==s.draft)useBodyState.setState({byAsset,draft});
}

// The page's file library owns committed values, even between viewing sessions.
// Neither the page store nor a layout may retain scene objects or runtime handles.
useBackpack.subscribe((bag,prev)=>{
  const s=useBodyState.getState(); let byAsset=s.byAsset, draft=s.draft;
  if(bag.entries!==prev.entries){
    const ids=new Set(bag.entries.filter(e=>e.kind==='model').map(e=>e.id));
    for(const id of Object.keys(byAsset))if(!ids.has(id)){if(byAsset===s.byAsset)byAsset={...byAsset}; delete byAsset[id];}
    if(draft&&!ids.has(draft.assetId))draft=null;
  }
  if(draft&&bag.live!==prev.live){
    const before=prev.live[draft.assetId],after=bag.live[draft.assetId];
    if(!after?.visible || after.runtimeId!==before?.runtimeId)draft=null;
  }
  if(draft&&(bag.selected!==draft.assetId || bag.draft || bag.busy))draft=null;
  if(byAsset!==s.byAsset||draft!==s.draft)useBodyState.setState({byAsset,draft});
});
