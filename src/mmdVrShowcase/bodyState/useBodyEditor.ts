import {useLayoutEffect,useState} from 'react';
import {useLanguageStore} from '../../languageStore';
import {useBackpack} from '../backpack';
import {useMmdVrStore} from '../mmdVrStore';
import {actions,destination,line,type Action,type Row} from './controlRows';
import {DEFAULT_BODY_PROFILE,type BodyProfile} from './data';
import {action,editorControls,mainPages,pageTitle,parentPage,type DetailParents,type Page} from './editor/controls';
import {cycleRows} from './editor/cyclePages';
import {lactationRows,type DrainReceipts} from './editor/lactationPages';
import {shapeRows} from './editor/shapePages';
import {clearMilkEffects} from './lactation/events';
import {beginBodyPreview,cancelBodyPreview,commitBodyPreview,disableBodyState,drainBodySide,inspectBody,patchBodyPreview,stepBodyDay,useBodyState} from './store';

export type BodyActor = {assetId:string;runtimeId:string};

export function useBodyEditor({assetId,runtimeId}:BodyActor) {
  const zh=useLanguageStore(s=>s.language==='zh');
  const l=(cn:string,en:string)=>zh?cn:en;
  const [page,setPage]=useState<Page>('chest'),[parents,setParents]=useState<DetailParents>({});
  const [morphPage,setMorphPage]=useState(0);
  const [receipts,setReceipts]=useState<DrainReceipts>({});
  const [undo,setUndo]=useState<{kind:'save'|'clear';previous:BodyProfile|undefined;receipts?:DrainReceipts}|null>(null);
  const [feedback,setFeedback]=useState<'discarded'|'restored'|null>(null);
  const saved=useBodyState(s=>s.byAsset[assetId]);
  const draft=useBodyState(s=>s.draft?.assetId===assetId?s.draft.value:null);
  const support=useBodyState(s=>s.support[assetId]?.runtimeId===runtimeId?s.support[assetId]:undefined);
  const name=useBackpack(s=>s.entries.find(e=>e.id===assetId)?.file.name??'');
  const hidden=useBackpack(s=>!s.live[assetId]?.visible);
  const busy=useBackpack(s=>s.busy||s.selected!==assetId||s.live[assetId]?.runtimeId!==runtimeId);
  const blocked=useMmdVrStore(s=>s.physicsBusy||s.assetLoad.running||s.physicsFatal)||busy||hidden;
  useLayoutEffect(()=>inspectBody(assetId,runtimeId),[assetId,runtimeId]);

  function go(to:Page){if(to==='fit'||to==='breast')setParents(old=>({...old,[to]:page}));setPage(to);}
  const up=parentPage(page,parents),sectionLabel=l('身体状态','Body state');
  const parentName=up==='more'?l('设置','settings'):up?pageTitle(up,l):'';
  const back=up?l(`返回${parentName}`,`Back to ${parentName}`):draft?l('不保存并退出','Exit without saving'):l('返回角色','Back to actor');
  const nav=up||hidden?[]:mainPages.map(to=>action(pageTitle(to,l),()=>go(to),{active:to===page}));
  const status=draft?l('预览中 · 尚未保存','Preview · not saved'):
    feedback==='discarded'?l('已放弃改动','Changes discarded'):feedback==='restored'?l('已恢复原设置','Previous settings restored'):
    undo?.kind==='clear'?l('已清除本角色设置','Actor settings cleared'):undo?l('已保存到角色','Saved to actor'):null;
  const header={name,page,title:up?pageTitle(page,l):sectionLabel,sectionLabel,nav,status:hidden?null:status,back,
    backAction:up?action(back,()=>setPage(up),{quiet:true}):null,blocked,inDraft:!!draft};
  const footer:Action[]=[];
  if(hidden)return {...header,rows:[line(l('请先显示此角色，再编辑身体状态。','Show this actor on stage to edit body state.'))],footer};

  // Browsing only inspects the model. All pages edit the same actor draft,
  // and returning to a parent page does not commit or cancel it.
  function canEditNow(){
    const b=useBackpack.getState(),s=useMmdVrStore.getState(),live=b.live[assetId],owner=useBodyState.getState().inspection;
    return !blocked&&b.selected===assetId&&live?.visible&&live.runtimeId===runtimeId&&owner?.assetId===assetId&&owner.runtimeId===runtimeId&&
      !b.busy&&!b.draft&&!s.physicsBusy&&!s.physicsFatal&&!s.assetLoad.running;
  }
  function start(){
    const fresh=useBodyState.getState().draft?.assetId!==assetId;
    if(!canEditNow()||!beginBodyPreview(assetId,true))return false;
    if(fresh)setReceipts(undo?.receipts??{});
    return true;
  }
  const patch=(change:Partial<BodyProfile>)=>{
    const s=useBodyState.getState(),current=s.draft?.assetId===assetId?s.draft.value:s.byAsset[assetId]??DEFAULT_BODY_PROFILE;
    // Selecting the current mode or reselecting the current model morph is browsing.
    if((Object.keys(change) as (keyof BodyProfile)[]).some(k=>current[k]!==change[k])&&start()){
      patchBodyPreview(assetId,change);
      if(change.lactating===false)setReceipts({});
    }
  };
  const ui=editorControls(l,saved,draft,go,patch);
  const disable=()=>{if(!canEditNow()||!saved)return;disableBodyState(assetId);setUndo({kind:'clear',previous:saved});setFeedback(null);setPage('chest');};
  function rows():Row[]{
    switch(page){
      case 'more':
        return [destination(ui.link('contact'),l('调整按压幅度和回弹时间','Adjust compression and recovery')),
          destination(ui.link('fit'),l('选择角色自带的胸型','Choose a shape from this model')),
          ...(saved&&!draft?[actions(action(l('清除本角色设置','Clear actor settings'),disable,{danger:true}))]:[])];
      case 'chest': case 'breast': case 'fit': case 'morphs': case 'contact': case 'sensitivity':
        return shapeRows(page,ui,support,{page:morphPage,setPage:setMorphPage});
      case 'cycle': case 'organ': case 'rhythm': case 'lining': case 'secretions':
        return cycleRows(page,ui,days=>{if(start())stepBodyDay(assetId,days);});
      case 'milk': case 'milkLevel':
        return lactationRows(page,ui,draft?receipts:undo?.receipts??{},side=>{
          if(!start())return;
          const result=drainBodySide(assetId,side);
          if(result)setReceipts(old=>({...old,[side]:result}));
        });
    }
  }

  if(draft){
    footer.push(action(l('放弃改动','Discard changes'),()=>{if(canEditNow()){cancelBodyPreview(assetId);setFeedback('discarded');}}),action(l('保存到角色','Save to actor'),()=>{
      if(!canEditNow())return;
      setUndo({kind:'save',previous:saved,receipts});setFeedback(null);commitBodyPreview(assetId);
    },{primary:true}));
  }else if(undo){
    footer.push(action(undo.kind==='clear'?l('撤销清除','Undo clear'):l('撤销保存','Undo save'),()=>{
      if(!canEditNow())return;
      if(undo.kind==='save')clearMilkEffects(assetId);
      if(!undo.previous)disableBodyState(assetId);
      else if(start()){patchBodyPreview(assetId,undo.previous);commitBodyPreview(assetId);}
      setUndo(null);setFeedback('restored');
    },{quiet:true}));
  }
  return {...header,rows:rows(),footer};
}
