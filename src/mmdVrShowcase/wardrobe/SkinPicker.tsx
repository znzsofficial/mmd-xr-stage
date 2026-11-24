import { useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { useLanguageStore } from '../../languageStore';
import { relativePath } from '../../mmdImport/folderFiles';
import { useBackpack } from '../backpack/store';
import { HudButton, HudLine, HudSheet } from '../hud/PorcelainControls';
import { selectSkin } from './actions';
import type { FinderProps } from './SlotFinder';
import type { ClothingSlot } from './slots';
import { isSkinImage } from './skinMaps';

export function SkinPicker(props:FinderProps & {slot:ClothingSlot}){
  const {model,slot,hud,onBack}=props,skin=model.skin,key=slot.key,zh=useLanguageStore(s=>s.language==='zh'),l=(cn:string,en:string)=>zh?cn:en;
  useSyncExternalStore(skin.subscribe,skin.snapshot);
  const {active,pending,error,choices}=skin.status(key),files=useBackpack(s=>s.files),imported=useMemo(()=>files.filter(isSkinImage),[files]);
  const [pick,setPick]=useState<File|null>(active),[local,setLocal]=useState<File|null>(null);
  const options=[...new Set([...choices,...(local?[local]:[]),...imported])],chosen=pick&&options.includes(pick)?pick:options[0],i=options.indexOf(chosen);
  const request=useRef<object|null>(null);
  function cancel(){if(request.current){request.current=null;skin.cancel(key);}}
  useLayoutEffect(()=>()=>{if(request.current){request.current=null;skin.cancel(key);}},[skin,key]);
  function choose(file:File){cancel();setPick(file);}
  function apply(file:File|null){const ticket=request.current={};void selectSkin(props,model,key,file,()=>request.current===ticket).finally(()=>{if(request.current===ticket)request.current=null;});}
  const title=l('更换皮肤贴图','Switch skin texture'),back=l('返回材质槽','Back to slot'),original=l('原图','Original');
  const use=l('应用这张图','Apply this image'),reset=l('恢复原图','Restore original');
  const current=l(`当前：${active?.name??original}`,`Current: ${active?.name??original}`);
  const message=error?l('图片读取失败，已保留当前贴图。','Could not read the image. The current texture was kept.'):
    pending?l(`正在读取：${pending.name}`,`Loading: ${pending.name}`):l('使用为同一角色、同一 UV 展开绘制的皮肤图。','Use a skin image painted for this character’s UV layout.');
  const empty=l('先在屏幕选择皮肤图，或随模型导入图片。','Choose a skin image on screen or import it with the model.');
  const blocked=!chosen||!isSkinImage(chosen)||chosen===pending||chosen===active&&!pending;
  if(hud)return <group name="wardrobe-skin-picker"><HudSheet size={[1.78,1.52]}/>
    <HudLine position={[-.31,.61,0]} width={1} role="title" text={title}/><HudButton position={[.53,.61,0]} size={[.60,.145]} variant="quiet" label={back} onPress={onBack}/>
    <HudLine position={[0,.43,0]} width={1.64} center text={`#${slot.index+1} · ${slot.label}`}/>
    <HudLine position={[0,.26,0]} width={1.64} center text={chosen?relativePath(chosen):empty} role="title"/>
    <HudButton position={[-.58,.06,0]} size={[.48,.145]} label={l('上一张','Previous')} disabled={i<=0} onPress={()=>choose(options[i-1])}/>
    <HudLine position={[0,.06,0]} width={.60} center text={`${i+1} / ${options.length}`}/>
    <HudButton position={[.58,.06,0]} size={[.48,.145]} label={l('下一张','Next')} disabled={i>=options.length-1} onPress={()=>choose(options[i+1])}/>
    <HudButton position={[-.42,-.16,0]} size={[.80,.15]} variant="primary" label={use} disabled={blocked} onPress={()=>chosen&&apply(chosen)}/>
    <HudButton position={[.42,-.16,0]} size={[.80,.15]} label={reset} disabled={!active&&!pending&&!error} onPress={()=>apply(null)}/>
    <HudLine position={[0,-.37,0]} width={1.64} center text={current}/><HudLine position={[0,-.55,0]} width={1.64} center text={message} role={error?'warning':'muted'}/>
  </group>;
  return <div className="wardrobe-screen" role="group" aria-label={title}><header><h3>{title}</h3><button onClick={onBack}>{back}</button></header>
    <p>#{slot.index+1} · {slot.label}</p><p className="wardrobe-note">{current}</p>
    <label className="wardrobe-select">{l('从设备选择图片','Choose an image from this device')}<input type="file" accept=".png,.jpg,.jpeg,.webp" onChange={e=>{
      const file=e.currentTarget.files?.[0];e.currentTarget.value='';if(file){setLocal(file);choose(file);}}}/></label>
    {!!options.length&&<label className="wardrobe-select">{l('本页皮肤候选','Images in this tab')}<select value={i} onChange={e=>choose(options[Number(e.target.value)])}>
      {options.map((f,n)=><option key={n} value={n}>{n+1} · {relativePath(f)}</option>)}
    </select></label>}
    <div className="wardrobe-tools"><button data-primary="true" disabled={blocked} onClick={()=>chosen&&apply(chosen)}>{use}</button>
      <button disabled={!active&&!pending&&!error} onClick={()=>apply(null)}>{reset}</button></div>
    <p className="wardrobe-note" role="status">{chosen&&!isSkinImage(chosen)?l('请选择 PNG、JPEG 或 WebP 图片。','Choose a PNG, JPEG or WebP image.'):message}</p>
  </div>;
}
