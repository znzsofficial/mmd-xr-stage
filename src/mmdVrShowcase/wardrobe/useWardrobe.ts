import { useReducer, useState, useSyncExternalStore } from 'react';
import { useLanguageStore } from '../../languageStore';
import { useBackpack } from '../backpack/store';
import { useMmdVrStore } from '../mmdVrStore';
import { usePelvic } from '../pelvic/store';
import { editWardrobe, hasWardrobeUndo, resolveActor, restoreOutfit, type WardrobeProps } from './actions';
import type { Piece } from './catalog';

const noSkin=()=>0,noSubscribe=()=>()=>{};

export function useWardrobe(props:WardrobeProps){
  const {assetId,runtimeId}=props,zh=useLanguageStore(s=>s.language==='zh'),l=(cn:string,en:string)=>zh?cn:en;
  const materials=useMmdVrStore(s=>s.materialModels[runtimeId]);
  const ref=useMmdVrStore(s=>s.runtimeRef),ready=useMmdVrStore(s=>s.overlayOpen&&!s.physicsBusy&&!s.physicsFatal&&!s.assetLoad.running);
  const live=useBackpack(s=>s.live[assetId]),file=useBackpack(s=>s.entries.find(e=>e.id===assetId&&e.kind==='model')?.file);
  const selected=useBackpack(s=>s.selected===assetId&&!s.busy&&!s.draft);
  const model=ready&&ref&&file&&selected&&live?.visible&&live.runtimeId===runtimeId?resolveActor(props):null;
  useSyncExternalStore(model?.skin.subscribe??noSubscribe,model?.skin.snapshot??noSkin);
  const types=['clothing','accessory','morph'] as const;
  const labels={clothing:l('衣物','Clothes'),accessory:l('配件','Accessories'),morph:l('服装形态','Morphs')};
  const blocker=usePelvic(s=>s.support[assetId]?.runtimeId===runtimeId?s.support[assetId]?.blockerName:null);
  const [choice,setChoice]=useState<{kind:Piece['kind'];key?:string}|null>(null),[,refresh]=useReducer((n:number)=>n+1,0);
  const all=model?.pieces.filter(p=>p.kind==='morph'||materials?.some(m=>m.name===p.key))??[];
  const preferred=all.find(p=>p.kind!=='morph'&&props.backLabel&&p.key===blocker);
  // A live obstruction can change just after hiding a garment. Pin the item
  // before applying the action so the next click never addresses a new row.
  const kind=choice?.kind??preferred?.kind??types.find(k=>all.some(p=>p.kind===k))??'clothing';
  const items=all.filter(p=>p.kind===kind),index=Math.max(0,items.findIndex(p=>p.key===(choice?.key??preferred?.key))),piece=items[index];
  function values(p?:Piece){
    const mat=p&&p.kind!=='morph'?materials?.find(m=>m.name===p.key):undefined;
    const weight=p?.kind==='morph'?model?.weight(p.key)??null:null;
    const param=p?.kind==='morph'?weight??model?.evaluated(p.key)??0:mat?.opacity??1;
    return {mat,weight,percent:Math.min(100,Math.max(0,Math.round(param*100)))};
  }
  const choose=(p:Piece)=>setChoice({kind:p.kind,key:p.key});
  const edit=(p:Piece,change:Parameters<typeof editWardrobe>[3])=>{if(model){choose(p);if(editWardrobe(props,model,p.key,change))refresh();}};
  const toggle=(p:Piece)=>{const {mat,weight}=values(p);if(mat)edit(p,{visible:!mat.visible});else if(p.kind==='morph')edit(p,{weight:weight===null?1:null});};
  const available=!!model,undo=!!model&&hasWardrobeUndo(model),modified=!!model?.slots.some(s=>{const v=model.skin.status(s.key);return v.active||v.pending;})||
    undo&&all.some(p=>p.kind==='morph'?model!.weight(p.key)!==null:materials?.some(m=>m.name===p.key&&(!m.visible||m.opacity!==1)));
  return {l,model,types,labels,kind,items,index,piece,values,...values(piece),available,undo,modified,
    title:l('衣柜','Wardrobe'),back:props.backLabel??l('返回角色','Back to actor'),
    field:kind==='morph'?l('形态权重','Morph weight'):l('不透明度','Opacity'),
    empty:!available?l('请重新选择场上可见的角色。','Select a visible actor on stage.'):
      kind==='morph'?l('未找到可调的服装顶点形态。','No supported garment vertex morphs.'):
      kind==='clothing'?l('未识别出独立衣物材质。','No separate clothing materials identified.'):
      l('未识别出独立配件材质。','No separate accessory materials identified.'),
    finder:l('查找漏件','Find missing pieces'),
    note:l('找不到衣件？按材质槽查看，也可更换画在皮肤上的衣服。','Inspect material slots or switch a skin texture for painted-on clothes.'),
    setKind:(kind:Piece['kind'])=>setChoice({kind}),choose,
    toggle,setPercent:(p:Piece,v:number)=>edit(p,p.kind==='morph'?{weight:v/100}:{opacity:v/100}),
    follow:(p:Piece)=>edit(p,{weight:null}),restore:(mode:'original'|'undo')=>{if(model){restoreOutfit(props,model,mode);refresh();}},
  };
}
