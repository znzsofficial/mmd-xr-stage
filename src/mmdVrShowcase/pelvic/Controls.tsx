import { useEffect, useMemo } from 'react';
import { createPanelTexture } from '../../shared/panelTexture';
import { HudButton, HudLine, HudSheet } from '../components/PorcelainControls';
import { HudSlider } from '../components/HudValues';
import { HUD_COLORS } from '../hudAppearance';
import { PelvicHudSection, PelvicScreenSection, type PelvicActor } from './Section';
import { usePelvicControls, type Row, type Key } from './usePelvicControls';
import './controls.css';

export { PelvicLiveSection } from './Section';
const formatted=(v:number,unit:string)=>`${+v.toFixed(2)}${unit}`;
type ScreenProps=PelvicActor&{onBack?:()=>void};
type HudProps=PelvicActor&{onBack:()=>void};
function ScreenKeys({items,blocked}:{items:Key[];blocked:boolean}) {
  return <div className="pelvic-keys">{items.map(k=><button type="button" key={k.id??k.label} disabled={blocked||k.disabled}
    aria-pressed={k.active} data-danger={k.danger||undefined} onClick={k.press}>{k.label}</button>)}</div>;
}
function ScreenRow({row,blocked}:{row:Row;blocked:boolean}) {
  if(row.kind==='buttons')return <ScreenKeys items={row.keys} blocked={blocked}/>;
  if(row.kind==='note')return <p className="pelvic-note" data-warn={row.warn||undefined}>{row.text}</p>;
  if(row.kind==='choose')return <label className="pelvic-field">{row.label}<select value={row.chosen??''}
    disabled={blocked||(!row.names.length&&!row.chosen)} onChange={e=>row.pick(e.currentTarget.value||null)}><option value="">{row.none}</option>
    {row.chosen&&!row.names.includes(row.chosen)&&<option value={row.chosen} disabled>{row.chosen}</option>}
    {row.names.map(s=><option value={s} key={s}>{s}</option>)}</select></label>;
  return <label className="pelvic-field"><span>{row.label}<output>{formatted(row.value,row.unit)}</output></span>
    <input type="range" aria-label={row.label} value={row.value} min={row.range[0]} max={row.range[1]} step={row.step}
      disabled={blocked||row.disabled} onChange={e=>row.change(e.currentTarget.valueAsNumber)}/></label>;
}
function ScreenEditor({assetId,runtimeId,onBack}:ScreenProps) {
  const vm=usePelvicControls({assetId,runtimeId},'screen');
  return <div className="pelvic-screen" role="group" aria-label={vm.title}>
    <div className="pelvic-heading"><h3>{vm.title}</h3>{onBack&&<button type="button" onClick={onBack}>{vm.back}</button>}</div>
    {vm.enabled&&<><nav aria-label={vm.title}><ScreenKeys items={vm.tabs} blocked={false}/></nav>
      <PelvicScreenSection assetId={assetId} runtimeId={runtimeId}/></>}
    {vm.notes.map((row,i)=><ScreenRow key={i} row={row} blocked={vm.blocked}/>)}
    <div className="pelvic-fields">{vm.rows.map((row,i)=><ScreenRow key={`${row.kind}:${i}`} row={row} blocked={vm.blocked}/>)}</div>
  </div>;
}
export function PelvicScreenControls(props:ScreenProps) {
  return <ScreenEditor key={`${props.assetId}:${props.runtimeId}`} {...props}/>;
}

// The body sheet is read in front of the selected actor. Put the moving
// section beside the controls, so the stop button never moves with a sample.
const panelW=1.80, chartW=.79, editorW=.86, leftX=-.46, rightX=.414, top=.69;
const spacing=.03, rowGap=.025, noteFont=26, density=560;
function HudKeys({items,w,blocked,tabs=false}:{items:Key[];w:number;blocked:boolean;tabs?:boolean}) {
  const bw=(w-spacing*(items.length-1))/items.length;
  return <>{items.map((k,i)=><HudButton key={k.id??k.label} position={[(i-(items.length-1)/2)*(bw+spacing),0,0]}
    size={[bw,.135]} label={k.label} onPress={k.press} active={k.active} disabled={blocked||k.disabled} danger={k.danger} variant={tabs?'tab':'button'}/>)}</>;
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
    ctx.font=`500 ${noteFont}px system-ui,sans-serif`;ctx.textBaseline='middle';ctx.fillStyle=warn?HUD_COLORS.danger:HUD_COLORS.muted;
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
const noop=()=>{};
function HudColumn({items,from,w,blocked}:{items:HudRow[];from:number;w:number;blocked:boolean}) {
  let y=from;
  return <>{items.map(({row,h,lines},i)=>{
    const center=y-h/2;y-=h+rowGap;
    if(row.kind==='choose')return null; // XR uses the paged actor morph browser instead.
    return <group position-y={center} key={`${i}:${row.kind}`}>
      {row.kind==='note'?<HudNote lines={lines} w={w} warn={row.warn}/>:row.kind==='buttons'?<HudKeys items={row.keys} blocked={blocked} w={w}/>:
        <><HudLine position={[0,.069,0]} width={w} center text={`${row.label}   ${formatted(row.value,row.unit)}`}/>
          <HudSlider position={[0,-.046,0]} width={w-.45} value={(row.value-row.range[0])/(row.range[1]-row.range[0])} disabled={blocked||row.disabled}
            onInteractionChange={noop} onChange={v=>row.change(+(row.range[0]+Math.round(v*(row.range[1]-row.range[0])/row.step)*row.step).toFixed(4))}/>
          {([-1,1] as const).map(d=><HudButton key={d} position={[d*(w/2-.082),-.046,0]} size={[.164,.13]} label={d<0?'−':'+'}
            disabled={blocked||row.disabled||(d<0?row.value<=row.range[0]:row.value>=row.range[1])}
            onPress={()=>row.change(+Math.min(row.range[1],Math.max(row.range[0],row.value+d*row.step)).toFixed(4))}/>)}</>}
    </group>;
  })}</>;
}
function HudEditor({assetId,runtimeId,onBack}:HudProps) {
  const vm=usePelvicControls({assetId,runtimeId},'xr'), width=vm.enabled?panelW:1.34;
  const cw=vm.enabled?editorW:width-.1;
  // Note wrapping must not allocate a measurement canvas on each sampling or
  // slider tick; rows only need new metrics when their content/layout changes.
  const rowKey=vm.rows.map(r=>r.kind==='note'?r.text:r.kind).join('|'),noteKey=vm.notes.map(r=>r.kind==='note'?r.text:r.kind).join('|');
  const metrics=useMemo(()=>measureRows(vm.rows,cw),[rowKey,cw]);
  const noteMetrics=useMemo(()=>measureRows(vm.notes,chartW),[noteKey]);
  const rows=metrics.map((m,i)=>({...m,row:vm.rows[i]})), notes=noteMetrics.map((m,i)=>({...m,row:vm.notes[i]}));
  const contentTop=vm.enabled?top-.365:top-.21,chartH=chartW*282/344;
  const columnHeight=(a:HudRow[])=>a.reduce((sum,r)=>sum+r.h+rowGap,0);
  const h=top-contentTop+Math.max(columnHeight(rows),vm.enabled?chartH+.04+columnHeight(notes):0)+.036;
  return <group name="pelvic:controls" pointerEventsOrder={1} pointerEventsType={{allow:['ray']}}>
    <group position-y={top-h/2}><HudSheet size={[width,h]}/></group>
    <HudLine position={[-.20,top-.087,0]} width={width-.51} role="title" text={vm.title}/>
    <HudButton position={[width/2-.218,top-.087,0]} size={[.337,.135]} label={vm.back} variant="quiet" onPress={onBack}/>
    {vm.enabled&&<><group position-y={top-.253}><HudKeys items={vm.tabs} blocked={false} w={width-.1} tabs/></group>
      <group position={[leftX,contentTop-chartH/2,0]}><PelvicHudSection assetId={assetId} runtimeId={runtimeId} widthM={chartW}/></group>
      <group position-x={leftX}><HudColumn items={notes} from={contentTop-chartH-.035} w={chartW} blocked={vm.blocked}/></group></>}
    <group position-x={vm.enabled?rightX:0}><HudColumn items={rows} from={contentTop} w={cw} blocked={vm.blocked}/></group>
  </group>;
}
export function PelvicHudControls(props:HudProps) {
  return <HudEditor key={`${props.assetId}:${props.runtimeId}`} {...props}/>;
}
