import {useLayoutEffect,useState} from 'react';
import {useLanguageStore} from '../../languageStore';
import {useBackpack} from '../backpack';
import {useMmdVrStore} from '../mmdVrStore';
import {actions,line,type Action,type Row} from './controlRows';
import type {BodyProfile} from './data';
import {action,editorControls,pageTitle,parentPage,type Page} from './editor/controls';
import {cycleRows} from './editor/cyclePages';
import {lactationRows} from './editor/lactationPages';
import {shapeRows} from './editor/shapePages';
import {beginBodyPreview,cancelBodyPreview,commitBodyPreview,disableBodyState,drainBodySide,inspectBody,patchBodyPreview,stepBodyDay,useBodyState} from './store';

export type BodyActor = {assetId:string;runtimeId:string};

export function useBodyEditor({assetId,runtimeId}:BodyActor) {
  const zh=useLanguageStore(s=>s.language==='zh');
  const l=(cn:string,en:string)=>zh?cn:en;
  const [page,setPage]=useState<Page>('chest'),[fitBack,setFitBack]=useState<Page>('more');
  const [morphPage,setMorphPage]=useState(0);
  const [undo,setUndo]=useState<{previous:BodyProfile|undefined}|null>(null);
  const saved=useBodyState(s=>s.byAsset[assetId]);
  const draft=useBodyState(s=>s.draft?.assetId===assetId?s.draft.value:null);
  const support=useBodyState(s=>s.support[assetId]?.runtimeId===runtimeId?s.support[assetId]:undefined);
  const name=useBackpack(s=>s.entries.find(e=>e.id===assetId)?.file.name??'');
  const hidden=useBackpack(s=>!s.live[assetId]?.visible);
  const busy=useBackpack(s=>s.busy||s.selected!==assetId||s.live[assetId]?.runtimeId!==runtimeId);
  const blocked=useMmdVrStore(s=>s.physicsBusy||s.assetLoad.running||s.physicsFatal)||busy||hidden;
  useLayoutEffect(()=>inspectBody(assetId,runtimeId),[assetId,runtimeId]);

  function go(to:Page){if(to==='fit')setFitBack(page);setPage(to);}
  const up=parentPage(page,fitBack),back=l('返回','Back');
  const header={name,title:pageTitle(page,l),back,backAction:up?action(back,()=>setPage(up),{quiet:true}):null,blocked,inDraft:!!draft};
  const footer:Action[]=[];
  if(hidden)return {...header,rows:[line(l('请先显示此角色，再编辑身体状态。','Show this actor on stage to edit body state.'))],footer};

  // Browsing only inspects the model. All pages edit the same actor draft,
  // and returning to a parent page does not commit or cancel it.
  const start=()=>!blocked&&useBackpack.getState().live[assetId]?.runtimeId===runtimeId&&beginBodyPreview(assetId,true);
  const patch=(change:Partial<BodyProfile>)=>{if(start())patchBodyPreview(assetId,change);};
  const ui=editorControls(l,saved,draft,go,patch);
  const disable=()=>{disableBodyState(assetId);setUndo(null);setPage('chest');};
  function rows():Row[]{
    switch(page){
      case 'more':
        return [actions(ui.link('cycle'),ui.link('milk')),actions(ui.link('contact'),ui.link('fit')),
          ...(saved&&!draft?[actions(action(l('关闭身体状态','Turn off body state'),disable,{quiet:true}))]:[])];
      case 'chest': case 'breast': case 'fit': case 'morphs': case 'contact': case 'sensitivity':
        return shapeRows(page,ui,support,{page:morphPage,setPage:setMorphPage});
      case 'cycle': case 'organ': case 'rhythm': case 'lining': case 'secretions':
        return cycleRows(page,ui,days=>{if(start())stepBodyDay(assetId,days);});
      case 'milk': case 'milkLevel':
        return lactationRows(page,ui,side=>{if(start())drainBodySide(assetId,side);});
    }
  }

  if(draft){
    footer.push(action(l('取消预览','Cancel preview'),()=>cancelBodyPreview(assetId)),action(l('保存','Save'),()=>{
      if(blocked)return;
      setUndo({previous:saved});commitBodyPreview(assetId);
    },{primary:true}));
  }else if(undo){
    footer.push(action(l('撤销保存','Undo save'),()=>{
      if(blocked)return;
      if(!undo.previous)disableBodyState(assetId);
      else if(start()){patchBodyPreview(assetId,undo.previous);commitBodyPreview(assetId);}
      setUndo(null);
    },{quiet:true}));
  }
  return {...header,rows:rows(),footer};
}
