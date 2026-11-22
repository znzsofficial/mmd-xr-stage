import { useEffect, useLayoutEffect, useMemo, useRef, type CSSProperties } from 'react';
import { createPanelTexture } from '../../shared/panelTexture';
import type { PelvicActor } from './Section';
import { AtlasHudPanel, AtlasScreenPanel } from './atlas/AtlasPanel';
import { PrivateButton, PrivateLine, PrivateSheet, PrivateSlider } from './HudPrivateControls';
import { PRIVATE_COLORS, privateVars } from './palette';
import { usePelvicControls, type PelvicNavigation } from './usePelvicControls';
import type {Row,Key} from './controlRows';
import './controls.css';

export { PelvicLiveSection } from './Section';
const formatted=(v:number,unit:string)=>`${+v.toFixed(2)}${unit}`;
type ScreenProps=PelvicActor&PelvicNavigation&{onBack?:()=>void};
type HudProps=PelvicActor&PelvicNavigation&{onBack:()=>void};
function ScreenKeys({items,blocked,stop=false}:{items:Key[];blocked:boolean;stop?:boolean}) {
  return <div className="pelvic-keys">{items.map(k=><button type="button" className="pelvic-key" key={k.id??k.label} disabled={blocked||k.disabled}
    aria-pressed={k.active} data-primary={k.primary||undefined} data-danger={k.danger||undefined} data-stop={stop||undefined} onClick={k.press}><span>{k.label}</span></button>)}</div>;
}
function ScreenRow({row,blocked}:{row:Row;blocked:boolean}) {
  if(row.kind==='buttons')return <ScreenKeys items={row.keys} blocked={blocked}/>;
  if(row.kind==='note')return <p className="pelvic-note" data-warn={row.warn||undefined}>{row.text}</p>;
  if(row.kind==='choose')return <label className="pelvic-field">{row.label}<select value={row.chosen??''} aria-label={row.label}
    disabled={blocked||(!row.names.length&&!row.chosen)} onChange={e=>row.pick(e.currentTarget.value||null)}><option value="">{row.none}</option>
    {row.chosen&&!row.names.includes(row.chosen)&&<option value={row.chosen} disabled>{row.chosen}</option>}
    {row.names.map(s=><option value={s} key={s}>{s}</option>)}</select></label>;
  return <label className="pelvic-field"><span>{row.label}<output>{formatted(row.value,row.unit)}</output></span>
    <input type="range" aria-label={row.label} value={row.value} min={row.range[0]} max={row.range[1]} step={row.step}
      style={{'--progress':`${(row.value-row.range[0])/(row.range[1]-row.range[0])*100}%`} as CSSProperties}
      disabled={blocked||row.disabled} onChange={e=>row.change(e.currentTarget.valueAsNumber)}/></label>;
}
function ScreenEditor({assetId,runtimeId,onBack,...navigation}:ScreenProps) {
  const vm=usePelvicControls({assetId,runtimeId},'screen',navigation);
  const page=useRef<HTMLDivElement>(null);
  useLayoutEffect(()=>{
    const sidebar=page.current?.closest('.screen-library');if(sidebar)sidebar.scrollTop=0;
  },[]);
  return <div className="pelvic-screen" style={privateVars} ref={page} role="group" aria-label={vm.title}>
    <header className="pelvic-heading"><h3>{vm.title}</h3>{vm.stop&&<ScreenKeys items={[vm.stop]} blocked={vm.blocked} stop/>}{onBack&&<button type="button" className="pelvic-key pelvic-back" onClick={onBack}>{vm.back}</button>}</header>
    <div className="pelvic-body" data-chart={vm.chart}>
      {vm.enabled&&<nav className="pelvic-nav" aria-label={vm.title}><ScreenKeys items={vm.tabs} blocked={false}/></nav>}
      <p className="pelvic-note pelvic-state" data-warn={vm.warn||undefined} role="status">{vm.status}</p>
      {vm.chart&&<div className="pelvic-plate"><AtlasScreenPanel assetId={assetId} runtimeId={runtimeId}/></div>}
      <div className="pelvic-fields">{vm.rows.map((row,i)=><ScreenRow key={`${row.kind}:${i}`} row={row} blocked={vm.blocked}/>)}</div>
    </div>
  </div>;
}
export function PelvicScreenControls(props:ScreenProps) {
  return <ScreenEditor key={`${props.assetId}:${props.runtimeId}`} {...props}/>;
}

// The body sheet is read in front of the selected actor. Put the moving
// section beside the controls, so the stop button never moves with a sample.
const panelW=2.02, chartW=1.04, editorW=.83, leftX=-.44, rightX=.545, top=.69;
const chartH=chartW*1.30;
const spacing=.03, rowGap=.025, noteFont=26, density=560;
function HudKeys({items,w,blocked,tabs=false,stop=false}:{items:Key[];w:number;blocked:boolean;tabs?:boolean;stop?:boolean}) {
  const bw=(w-spacing*(items.length-1))/items.length;
  return <>{items.map((k,i)=><PrivateButton key={k.id??k.label} position={[(i-(items.length-1)/2)*(bw+spacing),0,0]}
    size={[bw,.135]} label={k.label} onPress={k.press} active={k.active} disabled={blocked||k.disabled} danger={k.danger} variant={stop?'stop':tabs?'tab':k.primary?'primary':'button'}/>)}</>;
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
    h:row.kind==='buttons'?.135:row.kind==='field'?.226:(lines.length*35+5)/density};});
}
function HudColumn({items,from,w,blocked}:{items:HudRow[];from:number;w:number;blocked:boolean}) {
  let y=from;
  return <>{items.map(({row,h,lines},i)=>{
    const center=y-h/2;y-=h+rowGap;
    if(row.kind==='choose')return null; // XR uses the paged actor morph browser instead.
    return <group position-y={center} key={`${i}:${row.kind}`}>
      {row.kind==='note'?<HudNote lines={lines} w={w} warn={row.warn}/>:row.kind==='buttons'?<HudKeys items={row.keys} blocked={blocked} w={w}/>:
        <><PrivateLine position={[0,.069,0]} width={w} text={row.label} value={formatted(row.value,row.unit)}/>
          <PrivateSlider position={[0,-.046,0]} width={w-.375} value={(row.value-row.range[0])/(row.range[1]-row.range[0])} disabled={blocked||row.disabled}
            onChange={v=>row.change(+(row.range[0]+Math.round(v*(row.range[1]-row.range[0])/row.step)*row.step).toFixed(4))}/>
          {([-1,1] as const).map(d=><PrivateButton key={d} position={[d*(w/2-.082),-.046,0]} size={[.164,.13]} label={d<0?'−':'+'}
            disabled={blocked||row.disabled||(d<0?row.value<=row.range[0]:row.value>=row.range[1])}
            onPress={()=>row.change(+Math.min(row.range[1],Math.max(row.range[0],row.value+d*row.step)).toFixed(4))}/>)}</>}
    </group>;
  })}</>;
}
function HudEditor({assetId,runtimeId,onBack,...navigation}:HudProps) {
  const vm=usePelvicControls({assetId,runtimeId},'xr',navigation), width=vm.chart?panelW:1.34;
  const cw=vm.chart?editorW:width-.1;
  // Note wrapping must not allocate a measurement canvas on each sampling or
  // slider tick; rows only need new metrics when their content/layout changes.
  const rowKey=vm.rows.map(r=>r.kind==='note'?r.text:r.kind).join('|');
  const metrics=useMemo(()=>measureRows(vm.rows,cw),[rowKey,cw]);
  const statusLines=useMemo(()=>noteLines(vm.status,cw),[vm.status,cw]);
  const rows=metrics.map((m,i)=>({...m,row:vm.rows[i]}));
  const contentTop=vm.enabled?top-.365:top-.21,stopH=vm.stop?.label ? .135+rowGap : 0,statusH=(statusLines.length*35+5)/density;
  const columnHeight=(a:HudRow[])=>a.reduce((sum,r)=>sum+r.h+rowGap,0);
  const h=top-contentTop+Math.max(stopH+statusH+rowGap+columnHeight(rows),vm.chart?chartH:0)+.036;
  return <group name="pelvic:controls" pointerEventsOrder={1} pointerEventsType={{allow:['ray']}}>
    <group position-y={top-h/2}><PrivateSheet size={[width,h]}/></group>
    <PrivateLine position={[-.20,top-.087,0]} width={width-.51} title text={vm.title}/>
    <PrivateButton position={[width/2-.218,top-.087,0]} size={[.337,.135]} label={vm.back} variant="quiet" onPress={onBack}/>
    {vm.enabled&&<group position-y={top-.253}><HudKeys items={vm.tabs} blocked={false} w={width-.1} tabs/></group>}
    {vm.chart&&<group position={[leftX,contentTop-chartH/2,0]}><AtlasHudPanel assetId={assetId} runtimeId={runtimeId} widthM={chartW}/></group>}
    <group position-x={vm.chart?rightX:0}>
      {vm.stop&&<group position-y={contentTop-.0675}><HudKeys items={[vm.stop]} w={cw} blocked={vm.blocked} stop/></group>}
      <group position-y={contentTop-stopH-statusH/2}><HudNote lines={statusLines} w={cw} warn={vm.warn}/></group>
      <HudColumn items={rows} from={contentTop-stopH-statusH-rowGap} w={cw} blocked={vm.blocked}/>
    </group>
  </group>;
}
export function PelvicHudControls(props:HudProps) {
  return <HudEditor key={`${props.assetId}:${props.runtimeId}`} {...props}/>;
}
