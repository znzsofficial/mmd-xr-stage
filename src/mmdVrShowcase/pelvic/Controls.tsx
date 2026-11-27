import { useEffect, useLayoutEffect, useMemo, useRef, type SyntheticEvent } from 'react';
import { createPanelTexture } from '../../shared/panelTexture';
import type { PelvicActor } from './Section';
import { AtlasHudPanel, AtlasScreenPanel } from './atlas/AtlasPanel';
import { LivePelvicHudView, LivePelvicScreenView, livePaneHeight, type LiveMonitorNavigation } from '../observation/LivePelvicView';
import {ObservationDiagram} from '../observation/ObservationDiagram';
import {useLanguageStore} from '../../languageStore';
import {SECTION_H,SECTION_W} from './sectionPaint';
import {DepthHudReadout,DepthScreenReadout,StrokeHudReadout,StrokeScreenReadout,strokeReadoutHeight} from './StrokeReadout';
import { PrivateButton, PrivateLine, PrivateSheet } from './HudPrivateControls';
import {HudField,ScreenField} from './WorkbenchField';
import { PRIVATE_COLORS } from './palette';
import { usePelvicControls, type PelvicNavigation } from './usePelvicControls';
import type {Row,Key} from './controlRows';
import './controls.css';
import './workbench.css';
import {ActorHudTitle} from '../hud/actorHudDrag';

export { PelvicLiveSection } from './Section';
type ScreenProps=PelvicActor&PelvicNavigation&LiveMonitorNavigation&{onBack?:()=>void};
type HudProps=PelvicActor&PelvicNavigation&LiveMonitorNavigation&{onBack:()=>void};
function ScreenKeys({items,blocked,stop=false}:{items:Key[];blocked:boolean;stop?:boolean}) {
  const down=useRef<WeakMap<HTMLButtonElement,number>>(undefined);
  return <div className="pelvic-keys" data-choices={items.every(k=>k.active!==undefined)||undefined}>{items.map(k=>{
    // A held Stop cannot become Start if tracking is interrupted before release.
    const token=k.pressToken,arm=token===undefined?undefined:(e:SyntheticEvent<HTMLButtonElement>)=>(down.current??=new WeakMap()).set(e.currentTarget,token);
    return <button type="button" className="pelvic-key" key={k.id??k.label} disabled={blocked||k.disabled}
      aria-pressed={k.active} data-primary={k.primary||undefined} data-danger={k.danger||undefined} data-stop={stop||k.stop||undefined}
      onPointerDown={arm} onKeyDown={arm&&((e)=>{if(!e.repeat&&(e.key===' '||e.key==='Enter'))arm(e);})}
      onClick={arm?e=>{const t=down.current?.get(e.currentTarget);down.current?.delete(e.currentTarget);if(t===undefined||t===token)k.press();}:k.press}><span>{k.label}</span></button>;
  })}</div>;
}
function ScreenRow({row,blocked,actor}:{row:Row;blocked:boolean;actor:PelvicActor}) {
  if(row.kind==='strokeReading')return <StrokeScreenReadout {...actor}/>;
  if(row.kind==='depthReading')return <DepthScreenReadout {...actor}/>;
  if(row.kind==='buttons'){
    const keys=<ScreenKeys items={row.keys} blocked={blocked}/>;
    return row.label?<div className="pelvic-named-row" role="group" aria-label={row.label}><span>{row.label}</span>{keys}</div>:keys;
  }
  if(row.kind==='note')return <p className="pelvic-note" data-warn={row.warn||undefined}>{row.text}</p>;
  if(row.kind==='fieldPair')return <div className="pelvic-field-pair">{row.fields.map(f=><ScreenField key={f.label} row={f} blocked={blocked}/>)}</div>;
  if(row.kind==='choose')return <label className="pelvic-field">{row.label}<select value={row.chosen??''} aria-label={row.label}
    disabled={blocked||(!row.names.length&&!row.chosen)} onChange={e=>row.pick(e.currentTarget.value||null)}><option value="">{row.none}</option>
    {row.chosen&&!row.names.includes(row.chosen)&&<option value={row.chosen} disabled>{row.chosen}</option>}
    {row.names.map(s=><option value={s} key={s}>{s}</option>)}</select></label>;
  return <ScreenField row={row} blocked={blocked}/>;
}
function SizePreview(props:PelvicActor&{widthM?:number}) {
  const loading=useLanguageStore(s=>s.language==='zh'?'绘制中…':'Drawing…');
  return <ObservationDiagram {...props} part="vagina" loading={loading}/>;
}
function ScreenEditor({assetId,runtimeId,onBack,lens,...navigation}:ScreenProps) {
  const vm=usePelvicControls({assetId,runtimeId},'screen',navigation);
  const page=useRef<HTMLDivElement>(null);
  useLayoutEffect(()=>{
    const sidebar=page.current?.closest('.screen-library');if(sidebar)sidebar.scrollTop=0;
  },[]);
  return <div className="pelvic-screen" ref={page} role="group" aria-label={vm.title}>
    <header className="pelvic-heading"><h3>{vm.title}</h3>{vm.stop&&<ScreenKeys items={[vm.stop]} blocked={vm.blocked} stop/>}{onBack&&<button type="button" className="pelvic-key pelvic-back" onClick={onBack}>{vm.back}</button>}</header>
    <div className="pelvic-body" data-chart={vm.chart} data-live={vm.live} data-size-preview={vm.sizePreview||undefined}>
      {vm.sizePreview&&<div className="pelvic-size-preview"><SizePreview assetId={assetId} runtimeId={runtimeId}/></div>}
      {vm.live?<div className="pelvic-live-plate"><LivePelvicScreenView assetId={assetId} runtimeId={runtimeId} lens={lens} blocked={vm.blocked}/></div>:
        vm.chart&&<div className="pelvic-plate"><AtlasScreenPanel assetId={assetId} runtimeId={runtimeId}/></div>}
      <div className="pelvic-operation">
        {vm.enabled&&<nav className="pelvic-nav" aria-label={vm.title}><ScreenKeys items={vm.tabs} blocked={false}/></nav>}
        {!vm.motorReadout&&<p className="pelvic-note pelvic-state" data-warn={vm.warn||undefined} role="status">{vm.status}</p>}
        <div className="pelvic-fields">{vm.rows.map((row,i)=><ScreenRow key={`${row.kind}:${i}`} row={row} blocked={vm.blocked} actor={{assetId,runtimeId}}/>)}</div>
      </div>
    </div>
  </div>;
}
export function PelvicScreenControls(props:ScreenProps) {
  return <ScreenEditor key={`${props.assetId}:${props.runtimeId}`} {...props}/>;
}

// The body sheet is read in front of the selected actor. Put the moving
// section beside the controls, so the stop button never moves with a sample.
const panelW=2.46, chartW=1.03, editorW=1.28, leftX=-.666, rightX=.54, top=.69;
const chartH=chartW*1.30;
const spacing=.03, rowGap=.025, noteFont=26, density=560;
function HudKeys({items,w,blocked,label,tabs=false,stop=false,live=false}:{items:Key[];w:number;blocked:boolean;label?:string;tabs?:boolean;stop?:boolean;live?:boolean}) {
  const inset=label ? .32 : 0,bw=(w-inset-spacing*(items.length-1))/items.length;
  return <>{label&&<PrivateLine position={[(inset-spacing-w)/2,0,0]} width={inset-spacing} text={label}/>}
    {items.map((k,i)=><PrivateButton key={k.id??k.label} position={[inset/2+(i-(items.length-1)/2)*(bw+spacing),0,0]}
    size={[bw,.135]} label={k.label} onPress={k.press} pressToken={k.pressToken} active={k.active} disabled={blocked||k.disabled} danger={k.danger}
    variant={stop||k.stop?'stop':live&&k.primary?'stroke':live&&(tabs||k.active!==undefined)?'lens':tabs?'tab':k.primary?'primary':'button'}/>)}</>;
}

// Keep CJK glyphs intact and avoid truncating the clothing/registration
// instructions with the standard single-line title ellipsis.
function noteLines(text:string,w:number) {
  const ctx=document.createElement('canvas').getContext('2d');if(!ctx)return [text];
  ctx.font=`500 ${noteFont}px system-ui,sans-serif`;
  const limit=w*density-6, words=text.match(/[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}，。；：、]|[^\s\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}，。；：、]+|\s+/gu)??[];
  const lines:string[]=[];let line='';
  function append(word:string){
    if(line&&ctx!.measureText(line+word).width>limit){lines.push(line.trimEnd());line='';}
    if(line||word.trim())line+=word;
  }
  for(const w of words){if(ctx.measureText(w).width>limit)for(const ch of w)append(ch);else append(w);}
  if(line.trim())lines.push(line.trimEnd());return lines;
}
function HudNote({lines,w,warn}:{lines:string[];w:number;warn?:boolean}) {
  const text=lines.join('\n'),h=lines.length*35+5;
  const texture=useMemo(()=>createPanelTexture(Math.round(w*density),h,({ctx})=>{
    ctx.font=`500 ${noteFont}px system-ui,sans-serif`;ctx.textBaseline='middle';ctx.fillStyle=warn?PRIVATE_COLORS.danger:PRIVATE_COLORS.muted;
    text.split('\n').forEach((s,i)=>ctx.fillText(s,2,i*35+19));
  },'en'),[w,h,text,warn]);
  useEffect(()=>()=>texture.dispose(),[texture]);
  return <mesh raycast={()=>null} pointerEvents="none" renderOrder={30}><planeGeometry args={[w,h/density]}/>
    <meshBasicMaterial map={texture} transparent toneMapped={false} depthTest={false} depthWrite={false} fog={false}/></mesh>;
}
type HudRow={row:Row;h:number;lines:string[]};
function measureRows(rows:Row[],w:number):HudRow[] {
  return rows.map(row=>{const lines=row.kind==='note'?noteLines(row.text,w):[];return {row,lines,
    h:row.kind==='buttons'?.135:row.kind==='field'||row.kind==='fieldPair'?.226:row.kind==='strokeReading'?strokeReadoutHeight:row.kind==='depthReading'?.11:(lines.length*35+5)/density};});
}
function HudColumn({items,from,w,blocked,actor,live}:{items:HudRow[];from:number;w:number;blocked:boolean;actor:PelvicActor;live:boolean}) {
  let y=from;
  return <>{items.map(({row,h,lines},i)=>{
    const center=y-h/2;y-=h+rowGap;
    if(row.kind==='choose')return null; // XR uses the paged actor morph browser instead.
    return <group position-y={center} key={`${i}:${row.kind}`}>
      {row.kind==='strokeReading'?<StrokeHudReadout {...actor} width={w}/>:row.kind==='depthReading'?<DepthHudReadout {...actor} width={w}/>:row.kind==='note'?<HudNote lines={lines} w={w} warn={row.warn}/>:row.kind==='buttons'?<HudKeys items={row.keys} label={row.label} blocked={blocked} w={w} live={live}/>:
        row.kind==='fieldPair'?row.fields.map((f,j)=><group key={f.label} position-x={(j-.5)*(w+spacing)/2}><HudField row={f} blocked={blocked} width={(w-spacing)/2}/></group>):
        <HudField row={row} blocked={blocked} width={w}/>}
    </group>;
  })}</>;
}
function HudEditor({assetId,runtimeId,onBack,lens,...navigation}:HudProps) {
  const vm=usePelvicControls({assetId,runtimeId},'xr',navigation), split=vm.chart||vm.live||vm.sizePreview,width=split?panelW:1.34;
  const cw=split?editorW:width-.1;
  // Note wrapping must not allocate a measurement canvas on each sampling or
  // slider tick; rows only need new metrics when their content/layout changes.
  const rowKey=vm.rows.map(r=>r.kind==='note'?r.text:r.kind).join('|');
  const metrics=useMemo(()=>measureRows(vm.rows,cw),[rowKey,cw]);
  const statusLines=useMemo(()=>vm.motorReadout?[]:noteLines(vm.status,cw),[vm.motorReadout,vm.status,cw]);
  const rows=metrics.map((m,i)=>({...m,row:vm.rows[i]}));
  const plateTop=top-.21,contentTop=vm.enabled?top-.365:plateTop,stopH=vm.stop?.label ? .135+rowGap : 0;
  const statusH=vm.motorReadout?0:((vm.live?Math.max(3,statusLines.length):statusLines.length)*35+5)/density;
  const columnHeight=(a:HudRow[])=>a.reduce((sum,r)=>sum+r.h+rowGap,0);
  const previewH=chartW*SECTION_H/SECTION_W;
  const h=Math.max(top-contentTop+stopH+statusH+rowGap+columnHeight(rows),top-plateTop+(vm.live?livePaneHeight:vm.chart?chartH:vm.sizePreview?previewH:0))+.036;
  return <group name="pelvic:controls" pointerEventsOrder={1} pointerEventsType={{allow:['ray']}}>
    <group position-y={top-h/2}><PrivateSheet size={[width,h]}/></group>
    <ActorHudTitle position={[-.20,top-.087,0]} width={width-.51} text={vm.title}/>
    <PrivateButton position={[width/2-.218,top-.087,0]} size={[.337,.135]} label={vm.back} variant="quiet" onPress={onBack}/>
    {vm.enabled&&<group position={[split?rightX:0,top-.253,0]}><HudKeys items={vm.tabs} blocked={false} w={cw} tabs live={vm.live}/></group>}
    {vm.sizePreview&&<group position={[leftX,plateTop-previewH/2,0]}><SizePreview assetId={assetId} runtimeId={runtimeId} widthM={chartW}/></group>}
    {vm.live?<group position={[leftX,plateTop,0]}><LivePelvicHudView assetId={assetId} runtimeId={runtimeId} widthM={chartW} lens={lens} blocked={vm.blocked}/></group>:
      vm.chart&&<group position={[leftX,plateTop-chartH/2,0]}><AtlasHudPanel assetId={assetId} runtimeId={runtimeId} widthM={chartW}/></group>}
    <group position-x={split?rightX:0}>
      {vm.stop&&<group position-y={contentTop-.0675}><HudKeys items={[vm.stop]} w={cw} blocked={vm.blocked} stop/></group>}
      {!vm.motorReadout&&<group position-y={contentTop-stopH-statusH/2}><HudNote lines={statusLines} w={cw} warn={vm.warn}/></group>}
      <HudColumn items={rows} from={contentTop-stopH-statusH-rowGap} w={cw} blocked={vm.blocked} actor={{assetId,runtimeId}} live={vm.live}/>
    </group>
  </group>;
}
export function PelvicHudControls(props:HudProps) {
  return <HudEditor key={`${props.assetId}:${props.runtimeId}`} {...props}/>;
}
