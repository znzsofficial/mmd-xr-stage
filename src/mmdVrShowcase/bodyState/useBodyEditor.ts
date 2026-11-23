import {useLayoutEffect,useState} from 'react';
import {useLanguageStore} from '../../languageStore';
import {useBackpack} from '../backpack';
import {useMmdVrStore} from '../mmdVrStore';
import {actions,destination,line,type Action,type Row} from './controlRows';
import {DEFAULT_BODY_PROFILE,type BodyProfile} from './data';
import {action,editorControls,mainPages,pageTitle,parentPage,type DetailParents,type Page} from './editor/controls';
import {cycleRows,daysPerPage} from './editor/cyclePages';
import {lactationRows} from './editor/lactationPages';
import {shapeRows} from './editor/shapePages';
import {beginBodyPreview,cancelBodyPreview,commitBodyPreview,disableBodyState,fastForwardReproduction,inspectBody,patchBodyPreview,stepBodyDay,useBodyState} from './store';
import {activeGame,useReproduction} from './reproduction/store';

export type BodyActor = {assetId:string;runtimeId:string};

export function useBodyEditor({assetId,runtimeId}:BodyActor) {
  const zh=useLanguageStore(s=>s.language==='zh');
  const sectionLabel=useLanguageStore(s=>s.t('actorBodyState'));
  const l=(cn:string,en:string)=>zh?cn:en;
  const [page,setPage]=useState<Page>('chest'),[parents,setParents]=useState<DetailParents>({});
  const [morphPage,setMorphPage]=useState(0);
  const [calendarIndex,setCalendarIndex]=useState(0);
  const [undo,setUndo]=useState<{kind:'save'|'clear';previous:BodyProfile|undefined}|null>(null);
  const [feedback,setFeedback]=useState<'discarded'|'restored'|null>(null);
  const saved=useBodyState(s=>s.byAsset[assetId]);
  const game=useReproduction(s=>page==='reproduction'?activeGame(assetId,s):undefined);
  const draft=useBodyState(s=>s.draft?.assetId===assetId?s.draft.value:null);
  const support=useBodyState(s=>s.support[assetId]?.runtimeId===runtimeId?s.support[assetId]:undefined);
  const name=useBackpack(s=>s.entries.find(e=>e.id===assetId)?.file.name??'');
  const hidden=useBackpack(s=>!s.live[assetId]?.visible);
  const busy=useBackpack(s=>s.busy||s.selected!==assetId||s.live[assetId]?.runtimeId!==runtimeId);
  const blocked=useMmdVrStore(s=>s.physicsBusy||s.assetLoad.running||s.physicsFatal)||busy||hidden;
  useLayoutEffect(()=>inspectBody(assetId,runtimeId),[assetId,runtimeId]);

  function go(to:Page){
    if(to==='fit'||to==='calendar')setParents(old=>({...old,[to]:page}));
    if(to==='calendar')setCalendarIndex(Math.floor(((draft??saved??DEFAULT_BODY_PROFILE).day-1)/daysPerPage));
    setPage(to);
  }
  const up=parentPage(page,parents);
  const parentName=up?pageTitle(up,l):'';
  const back=up?l(`返回${parentName}`,`Back to ${parentName}`):draft?l('不保存并退出','Exit without saving'):l('返回角色','Back to actor');
  const nav=up||hidden?[]:mainPages.map(to=>action(pageTitle(to,l),()=>go(to),{active:to===page}));
  const status=draft?l('草稿未保存 · 切栏保留','Unsaved draft · shared across tabs'):
    feedback==='discarded'?l('已放弃，恢复角色原值','Changes discarded · original values restored'):feedback==='restored'?l('已撤销，恢复角色原值','Undone · original values restored'):
    undo?.kind==='clear'?l('已清除本角色设置','Actor settings cleared'):undo?l('已保存到角色','Saved to actor'):null;
  const header={name,page,title:up?pageTitle(page,l):sectionLabel,sectionLabel,nav,status:hidden?null:status,back,
    backAction:up?action(back,()=>setPage(up),{quiet:true}):null,blocked,inDraft:!!draft};
  const footer:Action[]=[];
  if(hidden)return {...header,rows:[line(l('请先显示此角色，再编辑身体设置。','Show this actor on stage to edit body settings.'))],footer};

  // Browsing only inspects the model. All pages edit the same actor draft,
  // and returning to a parent page does not commit or cancel it.
  function canEditNow(){
    const b=useBackpack.getState(),s=useMmdVrStore.getState(),live=b.live[assetId],owner=useBodyState.getState().inspection;
    return !blocked&&b.selected===assetId&&live?.visible&&live.runtimeId===runtimeId&&owner?.assetId===assetId&&owner.runtimeId===runtimeId&&
      !b.busy&&!b.draft&&!s.physicsBusy&&!s.physicsFatal&&!s.assetLoad.running;
  }
  const start=()=>canEditNow()&&beginBodyPreview(assetId,true);
  const patch=(change:Partial<BodyProfile>)=>{
    const s=useBodyState.getState(),current=s.draft?.assetId===assetId?s.draft.value:s.byAsset[assetId]??DEFAULT_BODY_PROFILE;
    // Selecting the current mode or reselecting the current model morph is browsing.
    if((Object.keys(change) as (keyof BodyProfile)[]).some(k=>current[k]!==change[k])&&start()){
      patchBodyPreview(assetId,change);
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
      case 'chest': case 'fit': case 'morphs': case 'contact': case 'sensitivity':
        return shapeRows(page,ui,support,{page:morphPage,setPage:setMorphPage});
      case 'cycle': case 'compare': case 'calendar': case 'rhythm': case 'lining': case 'secretions': case 'reproduction':
        return cycleRows(page,ui,days=>{if(start())stepBodyDay(assetId,days);},{index:calendarIndex,setIndex:setCalendarIndex,
          choose:day=>{if(day!==ui.p.day)patch({day,daySeconds:0});setPage(parents.calendar??'cycle');},
        },game,g=>{if(canEditNow())fastForwardReproduction(assetId,g);});
      case 'milk':return lactationRows(ui);
    }
  }

  if(draft){
    footer.push(action(l('放弃改动','Discard changes'),()=>{if(canEditNow()){cancelBodyPreview(assetId);setFeedback('discarded');}}),action(l('保存到角色','Save to actor'),()=>{
      const current=useBodyState.getState();if(!canEditNow()||current.draft?.assetId!==assetId)return;
      setUndo({kind:'save',previous:current.byAsset[assetId]});setFeedback(null);commitBodyPreview(assetId);
    },{primary:true}));
  }else if(undo){
    footer.push(action(undo.kind==='clear'?l('撤销清除','Undo clear'):l('撤销保存','Undo save'),()=>{
      if(!canEditNow())return;
      if(!undo.previous)disableBodyState(assetId);
      else if(start()){patchBodyPreview(assetId,undo.previous);commitBodyPreview(assetId);}
      else return;
      setUndo(null);setFeedback('restored');
    },{quiet:true}));
  }
  return {...header,rows:rows(),footer};
}
