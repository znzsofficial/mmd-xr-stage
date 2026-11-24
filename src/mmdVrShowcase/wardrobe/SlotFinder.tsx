import { useLayoutEffect, useReducer, useState } from 'react';
import { useLanguageStore } from '../../languageStore';
import { HudButton, HudLine, HudSheet } from '../hud/PorcelainControls';
import { useMmdVrStore } from '../mmdVrStore';
import { editWardrobe, registerPiece, resolveActor, type WardrobeProps } from './actions';
import type { WardrobeModel } from './model';
import { SkinPicker } from './SkinPicker';

export type FinderProps=WardrobeProps & {model:WardrobeModel;hud?:boolean};
export function SlotFinder(props:FinderProps){
  const {model,hud,onBack,assetId,runtimeId}=props,zh=useLanguageStore(s=>s.language==='zh'),l=(cn:string,en:string)=>zh?cn:en;
  const [cursor,step]=useState(0),[wire,setWire]=useState(false),[skin,setSkin]=useState(false),[,refresh]=useReducer(n=>n+1,0);
  const slots=model.slots,index=Math.min(cursor,slots.length-1),slot=slots[index],key=slot?.key;
  const mat=useMmdVrStore(s=>s.materialModels[runtimeId]?.find(m=>m.name===key));
  useLayoutEffect(()=>{
    if(!wire||skin||!slot||resolveActor({assetId,runtimeId})!==model)return;
    model.preview(slot.key);return ()=>model.preview(null);
  },[assetId,runtimeId,model,slot,wire,skin]);
  if(skin&&slot)return <SkinPicker {...props} key={slot.key} slot={slot} onBack={()=>setSkin(false)}/>;
  const piece=slot&&model.pieces.find(p=>p.kind!=='morph'&&p.key===slot.key),manual=slot&&model.manual(slot.key);
  const title=l('查找漏件','Find missing pieces'),back=l('返回衣柜','Back to wardrobe'),empty=l('此角色没有可绘制的材质槽。','No drawable material slots on this actor.');
  const name=slot?`#${slot.index+1} · ${slot.label}`:'',details=slot?l(`${slot.triangles} 个三角面`,`${slot.triangles} triangles`):'';
  const preview=wire?l('结束网格预览','End mesh preview'):l('预览网格范围','Preview mesh range');
  const save=manual?l('移出衣柜','Remove from wardrobe'):piece?l('已在衣柜中','Already in wardrobe'):l('保存为衣件','Save as clothing');
  const toggle=mat?.visible?l('隐藏此件','Hide item'):l('显示此件','Show item'),map=l('更换皮肤贴图','Switch skin texture');
  const note=slot&&!mat?.visible?l('此槽已隐藏。显示衣件后可预览网格。','This slot is hidden. Show the item to inspect its mesh.'):
    l('若网格连着身体，保留几何，改用同角色的皮肤贴图。','If the mesh includes the body, leave it visible and switch its skin texture.');
  function register(){if(slot&&registerPiece(props,model,slot.key,!manual))refresh();}
  function show(){if(slot&&mat&&piece&&editWardrobe(props,model,slot.key,{visible:!mat.visible}))refresh();}
  if(hud)return <group name="wardrobe-slot-finder"><HudSheet size={[1.78,1.52]}/>
    <HudLine position={[-.31,.61,0]} width={1} role="title" text={title}/><HudButton position={[.53,.61,0]} size={[.60,.145]} variant="quiet" label={back} onPress={onBack}/>
    {slot?<>
      <HudButton position={[-.59,.40,0]} size={[.48,.145]} label={l('上一槽','Previous slot')} disabled={!index} onPress={()=>step(index-1)}/>
      <HudLine position={[0,.40,0]} width={.58} center text={`${index+1} / ${slots.length}`}/>
      <HudButton position={[.59,.40,0]} size={[.48,.145]} label={l('下一槽','Next slot')} disabled={index===slots.length-1} onPress={()=>step(index+1)}/>
      <HudLine position={[0,.23,0]} width={1.62} center text={name} role="title"/><HudLine position={[0,.10,0]} width={1.62} center text={details}/>
      <HudButton position={[-.42,-.065,0]} size={[.80,.15]} label={preview} active={wire} disabled={!mat?.visible} onPress={()=>setWire(!wire)}/>
      <HudButton position={[.42,-.065,0]} size={[.80,.15]} label={save} disabled={!!piece&&!manual} onPress={register}/>
      <HudButton position={[-.42,-.26,0]} size={[.80,.15]} label={toggle} disabled={!piece||!mat} onPress={show}/>
      <HudButton position={[.42,-.26,0]} size={[.80,.15]} label={map} disabled={!slot.textured} onPress={()=>setSkin(true)}/>
      <HudLine position={[0,-.50,0]} width={1.64} center role="muted" text={l('整片身体也变成网格？请选择「更换皮肤贴图」。','If the body is included, switch its skin texture instead.')}/>
    </>:<HudLine position={[0,0,0]} width={1.62} text={empty} center/>}
  </group>;
  return <div className="wardrobe-screen" role="group" aria-label={title}><header><h3>{title}</h3><button onClick={onBack}>{back}</button></header>
    {slot?<><label className="wardrobe-select">{l('材质槽','Material slot')}<select value={index} onChange={e=>step(Number(e.target.value))}>
      {slots.map((s,i)=><option key={s.key} value={i}>#{s.index+1} · {s.label}</option>)}
    </select></label><p className="wardrobe-note">{details}</p>
    <div className="wardrobe-tools"><button aria-pressed={wire} disabled={!mat?.visible} onClick={()=>setWire(!wire)}>{preview}</button>
      <button disabled={!!piece&&!manual} onClick={register}>{save}</button>{piece&&<button disabled={!mat} onClick={show}>{toggle}</button>}</div>
    <footer><button disabled={!slot.textured} onClick={()=>setSkin(true)}>{map}</button></footer><p className="wardrobe-note">{note}</p></>:<p>{empty}</p>}
  </div>;
}
