import {useCallback,useLayoutEffect,useMemo,useRef,useState} from 'react';
import {useThree,type ThreeEvent} from '@react-three/fiber';
import type {Mesh} from 'three';
import {useLanguageStore} from '../../languageStore';
import {useHudKeyTexture,type KeyPainter} from '../hud/useHudKeyTexture';
import {useBackpack} from '../backpack/store';
import {DEFAULT_BODY_PROFILE} from '../bodyState/data';
import {openMilkPanel,pressMilk,releaseMilk,useMilkInteraction,type MilkMode,type MilkPanel,type OutletState} from '../bodyState/lactation/interaction';
import {setActorMilk,useBodyState} from '../bodyState/store';
import {HudButton,HudLine,HudSheet} from '../hud/PorcelainControls';
import {ActorHudTitle} from '../hud/actorHudDrag';
import {useHudWorldInput} from '../hud/hudWorldInput';
import {paintHudButton} from '../hud/hudAppearance';
import {useMmdVrStore} from '../mmdVrStore';
import {milkPressFrame,milkRayGuard} from './milkRay';
import {ObservationDiagram} from '../observation/ObservationDiagram';
import './milk-interaction.css';

type Props=MilkPanel & {onBack:()=>void;onObserve?:()=>void;onClothing?:()=>void;cameraKey?:{label:string;press():void}};
const sides=['left','right'] as const,modes=['left','right','both'] as const;
type Hold=NonNullable<ReturnType<typeof pressMilk>>;

function useMilkPage({assetId,runtimeId}:Props){
  const panel=useMemo(()=>({assetId,runtimeId}),[assetId,runtimeId]);
  useLayoutEffect(()=>openMilkPanel(panel),[panel]);
  const zh=useLanguageStore(s=>s.language==='zh'),l=(cn:string,en:string)=>zh?cn:en;
  const p=useBodyState(s=>s.byAsset[assetId]??DEFAULT_BODY_PROFILE),draft=useBodyState(s=>s.draft?.assetId===assetId);
  const live=useBackpack(s=>s.selected===assetId&&s.live[assetId]?.runtimeId===runtimeId&&s.live[assetId].visible&&!s.draft&&!s.busy);
  const stage=useMmdVrStore(s=>s.overlayOpen&&!s.physicsBusy&&!s.assetLoad.running&&!s.physicsFatal);
  const snapshot=useMilkInteraction(s=>s.reading?.panel===panel?s.reading:null),held=useMilkInteraction(s=>s.hold?.panel===panel?s.hold.mode:null);
  const shortTap=useMilkInteraction(s=>s.panel===panel&&s.shortTap);
  const stop=()=>{const h=useMilkInteraction.getState().hold;if(h?.panel===panel)releaseMilk(h);};
  const [settings,setSettings]=useState(false);
  const allowed=()=>{const s=useMmdVrStore.getState();return useMilkInteraction.getState().panel===panel&&s.overlayOpen&&!s.physicsBusy&&!s.assetLoad.running&&!s.physicsFatal&&
    !document.hidden&&(s.presentation!=='xr'||!useHudWorldInput.getState().blocked);};
  const change=(patch:Parameters<typeof setActorMilk>[1])=>{stop();if(allowed())setActorMilk(panel,patch);};
  const disabled=(mode:MilkMode)=>!stage||!live||draft||!snapshot||!p.lactating||!(mode==='both'?Math.max(p.left,p.right):p[mode]);
  const status=(state?:OutletState)=>state==='ready'?l('可出滴','Drops ready'):state==='confirm'?l('仅数值 · 待确认裸露','Fill only · confirm bare skin'):
    state==='blocked'?l('仅数值 · 出口被遮挡','Fill only · covered outlet'):state==='missing'?l('仅数值 · 未找到出口','Fill only · no outlet'):
    state==='unverified'?l('仅数值 · 露出未核实','Fill only · exposure unverified'):l('舞台未就绪','Stage not ready');
  const sideName=(s:MilkMode)=>s==='left'?l('左侧','Left'):s==='right'?l('右侧','Right'):l('双侧','Both');
  const holdLabel=(s:MilkMode)=>zh?`按住${sideName(s)}`:`Hold ${sideName(s).toLowerCase()}`;
  return {panel,p,settings,l,held,sideName,holdLabel,change,disabled,locked:!stage||!live||draft,stop,
    setSettings:(next:boolean)=>{stop();setSettings(next);},
    status:(s:typeof sides[number])=>p[s]<=0?l('已空 · 回充中','Empty · refilling'):status(snapshot?.[s]),
    title:l('泌乳互动','Milk interaction'),back:l('返回角色','Back to actor'),observe:l('看乳房','View breasts'),
    settingsLabel:l('确认露出','Confirm exposure'),enable:l('开启泌乳','Enable lactation'),
    hint:draft?l('先保存或放弃身体草稿。','Save or discard the body draft first.'):shortTap?l('轻点未排出，请按住到存量下降。','Tap was too brief. Hold until the amount drops.'):l('按住排出，松开停止；用量立即记入角色。','Hold to express, release to stop. The amount is saved immediately.'),
    fill:(s:typeof sides[number])=>`${Math.round(p[s]*100)}%`,
    begin:(mode:MilkMode,valid:Hold['valid'],source?:XRInputSource)=>!disabled(mode)&&allowed()?pressMilk(panel,mode,valid,source):null};
}
type Page=ReturnType<typeof useMilkPage>;

function ScreenHold({mode,page}:{mode:MilkMode;page:Page}){
  const owner=useRef<{hold:Hold;pointer?:number;key?:string}|null>(null);
  const cancel=(physicalRelease=false)=>{releaseMilk(owner.current?.hold??null,physicalRelease);owner.current=null;};
  useLayoutEffect(()=>{
    const end=(e:PointerEvent)=>{if(owner.current?.pointer===e.pointerId)cancel(e.type==='pointerup');};
    const up=(e:KeyboardEvent)=>{if(owner.current?.key===e.key)cancel(true);};
    window.addEventListener('pointerup',end,true);window.addEventListener('pointercancel',end,true);window.addEventListener('keyup',up,true);
    return ()=>{cancel();window.removeEventListener('pointerup',end,true);window.removeEventListener('pointercancel',end,true);window.removeEventListener('keyup',up,true);};
  },[]);
  const point=useRef({x:0,y:0});
  const end=(id:number)=>{if(owner.current?.pointer===id)cancel();};
  return <button type="button" className="milk-hold" data-held={page.held===mode||undefined} disabled={page.disabled(mode)}
    onPointerDown={e=>{
       if(e.button!==0||useMilkInteraction.getState().hold)return;
      const node=e.currentTarget;point.current={x:e.clientX,y:e.clientY};
      const hold=page.begin(mode,()=>node.isConnected&&node.contains(document.elementFromPoint(point.current.x,point.current.y)));
      if(hold)owner.current={hold,pointer:e.pointerId};
    }} onPointerMove={e=>{if(owner.current?.pointer!==e.pointerId)return;point.current={x:e.clientX,y:e.clientY};
      if(!(e.buttons&1)||!e.currentTarget.contains(document.elementFromPoint(e.clientX,e.clientY)))cancel();}}
    onPointerLeave={e=>end(e.pointerId)} onPointerUp={e=>end(e.pointerId)} onLostPointerCapture={e=>end(e.pointerId)} onPointerCancel={e=>end(e.pointerId)}
    onKeyDown={e=>{if(e.key!==' '&&e.key!=='Enter')return;e.preventDefault();if(e.repeat)return;
      const node=e.currentTarget,hold=page.begin(mode,()=>node===document.activeElement);if(hold)owner.current={hold,key:e.key};}}
     onKeyUp={e=>{if(owner.current?.key===e.key){e.preventDefault();cancel(true);}}} onBlur={()=>cancel()} onContextMenu={e=>e.preventDefault()}>{page.holdLabel(mode)}</button>;
}

export function MilkScreenControls(props:Props){
  const page=useMilkPage(props),{l,p}=page,{cameraKey}=props;
  const go=(fn:()=>void)=>{page.stop();fn();};
  return <div className="milk-interaction">
    <header className="screen-library-head"><h3>{page.title}</h3><button type="button" onClick={()=>go(props.onBack)}>{page.back}</button></header>
    {p.lactating?<>
      <div className="milk-readings">{sides.map(s=><div key={s} className="milk-side"><span>{page.sideName(s)} <strong>{page.fill(s)}</strong></span><small>{page.status(s)}</small></div>)}</div>
      <div className="milk-controls">{modes.map(mode=><ScreenHold key={mode} mode={mode} page={page}/>)}</div>
    </>:<button type="button" className="milk-enable" disabled={page.locked} onClick={()=>page.change({lactating:true})}>{page.enable}</button>}
    <div className="milk-links">{cameraKey&&<button type="button" onClick={()=>go(cameraKey.press)}>{cameraKey.label}</button>}
      {p.lactating&&props.onObserve&&<button type="button" onClick={()=>go(props.onObserve!)}>{page.observe}</button>}
      {props.onClothing&&<button type="button" onClick={()=>go(props.onClothing!)}>{l('服装','Clothing')}</button>}
      {p.lactating&&<button type="button" aria-expanded={page.settings} onClick={()=>page.setSettings(!page.settings)}>{page.settingsLabel}</button>}</div>
    {p.lactating&&page.settings&&<fieldset disabled={page.locked}><legend>{l('仅勾选能看见裸露乳头的一侧','Confirm only visibly bare nipples')}</legend>
      <div className="milk-checks">{sides.map(s=>{const key=s==='left'?'bareLeft':'bareRight';return <label key={key}><input type="checkbox" checked={p[key]} onChange={e=>page.change({[key]:e.target.checked})}/>{l(s==='left'?'左侧裸露':'右侧裸露',s==='left'?'Left bare':'Right bare')}</label>;})}</div>
      </fieldset>}
    <small className="milk-save-note">{page.hint}</small>
    {p.lactating&&<button type="button" disabled={page.locked} onClick={()=>{page.change({lactating:false});page.setSettings(false);}}>{l('关闭泌乳','Disable lactation')}</button>}
  </div>;
}

type XRPointer=ThreeEvent<PointerEvent>&{pointerState?:{inputSource?:XRInputSource}};
const rayTypes={allow:['ray']};
function HudHold({mode,page,x}:{mode:MilkMode;page:Page;x:number}){
  const {gl}=useThree(),mesh=useRef<Mesh>(null),owner=useRef<{id:number;hold:Hold}|null>(null);
  const disabled=page.disabled(mode),label=page.holdLabel(mode),active=page.held===mode;
  const [hovered,setHovered]=useState(false);
  const tex=useHudKeyTexture(286,88,useCallback<KeyPainter>(c=>paintHudButton(c,label,{active,disabled,hovered}),[label,active,disabled,hovered]));
  useLayoutEffect(()=>()=>releaseMilk(owner.current?.hold??null),[]);
  const end=(e:XRPointer)=>{e.stopPropagation();if(owner.current?.id===e.pointerId){releaseMilk(owner.current.hold,e.type==='pointerup');owner.current=null;}};
  return <mesh ref={mesh} name={`hud:${label}`} position={[x,.08,.002]} renderOrder={30} pointerEventsType={rayTypes}
    onPointerEnter={()=>setHovered(true)} onPointerDown={(e:XRPointer)=>{e.stopPropagation();const source=e.pointerState?.inputSource,node=mesh.current,session=gl.xr.getSession();
      if(!session||!node||source?.targetRayMode!=='tracked-pointer'||e.button!==0||e.pointerType!=='ray')return;
      const valid=milkRayGuard(gl,session,source,node);
       const eventFrame=(e.nativeEvent as unknown as Partial<XRInputSourceEvent>).frame;
       if(!valid(milkPressFrame(gl,session,source,eventFrame)))return;
      const hold=page.begin(mode,valid,source);if(hold)owner.current={id:e.pointerId,hold};
    }} onPointerLeave={e=>{setHovered(false);end(e);}} onPointerUp={end} onPointerCancel={end} onLostPointerCapture={end} onClick={e=>e.stopPropagation()}>
    <planeGeometry args={[.45,.15]}/><meshBasicMaterial map={tex} transparent fog={false} toneMapped={false} depthTest={false} depthWrite={false}/>
  </mesh>;
}

export function MilkHudControls(props:Props){
  const page=useMilkPage(props),{p,l}=page;
  const go=(fn:()=>void)=>{page.stop();fn();};
  const inlineFigure=!props.onObserve,extra=inlineFigure?.47:0;
  return <group name="milk:interaction"><group position-y={extra/2}><HudSheet size={[1.51,1.03+extra]}/></group>
    <ActorHudTitle position={[-.25,.406+extra,0]} width={.93} text={page.settings?page.settingsLabel:page.title}/>
    <HudButton position={[.48,.406+extra,0]} size={[.45,.14]} variant="quiet" label={page.settings?l('返回泌乳','Back to milk'):page.back}
      onPress={()=>page.settings?page.setSettings(false):go(props.onBack)}/>
    {inlineFigure&&<group position-y={.565}><ObservationDiagram assetId={props.assetId} runtimeId={props.runtimeId} part="breast" widthM={.68} loading={l('正在绘制图像…','Drawing figure…')}/></group>}
    {page.settings?<>
      <HudLine position={[0,.245,0]} width={1.42} text={l('仅确认能看见裸露乳头的一侧','Confirm only visibly bare nipples')}/>
      {sides.map((s,i)=>{const k=s==='left'?'bareLeft':'bareRight';return <HudButton key={s} position={[(i-.5)*.72,.095,0]} size={[.68,.14]}
        label={`${page.sideName(s)} · ${p[k]?l('已确认裸露','Bare confirmed'):l('确认裸露','Confirm bare')}`} active={p[k]} disabled={page.locked} onPress={()=>page.change({[k]:!p[k]})}/>;})}
       {sides.map((s,i)=><HudLine key={s} position={[(i-.5)*.72,-.045,0]} width={.69} role="muted" text={page.status(s)}/>)}
       {props.onClothing&&<HudLine position={[0,-.22,0]} width={1.42} role="muted" text={l('出口被遮挡时，可去服装检查外衣和内衣。','If covered, check outerwear and underwear in Clothing.')}/>}
    </>:<>
      {p.lactating?<>{sides.map((s,i)=><group key={s} position-x={(i-.5)*.72}><HudLine position={[0,.275,0]} width={.69} text={`${page.sideName(s)} ${page.fill(s)}`}/>
        <HudLine position={[0,.195,0]} width={.69} role="muted" text={page.status(s)}/></group>)}
        {modes.map((mode,i)=><HudHold key={mode} mode={mode} x={(i-1)*.48} page={page}/>)}</>:<HudButton position={[0,.13,0]} size={[1.42,.16]} variant="primary" label={page.enable} disabled={page.locked} onPress={()=>page.change({lactating:true})}/>}
      {p.lactating&&props.onObserve&&<HudButton position={[-.48,-.175,0]} size={[.45,.14]} label={page.observe} onPress={()=>go(props.onObserve!)}/>}
      {props.onClothing&&<HudButton position={[0,-.175,0]} size={[.45,.14]} label={l('服装','Clothing')} onPress={()=>go(props.onClothing!)}/>}
      {p.lactating&&<HudButton position={[inlineFigure?0:.48,-.175,0]} size={[inlineFigure?1.42:.45,.14]} label={page.settingsLabel} onPress={()=>page.setSettings(true)}/>}
      <HudLine position={[p.lactating?-.20:0,-.382,0]} width={p.lactating?.97:1.42} role="muted" text={page.hint}/>
      {p.lactating&&<HudButton position={[.52,-.382,0]} size={[.39,.14]} variant="quiet" label={l('关闭泌乳','Disable lactation')} disabled={page.locked} onPress={()=>page.change({lactating:false})}/>}
    </>}
  </group>;
}
