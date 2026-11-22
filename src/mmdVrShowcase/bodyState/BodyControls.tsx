import { useState } from 'react';
import { useLanguageStore } from '../../languageStore';
import { useBackpack } from '../backpack';
import { HudButton, HudLine, HudSheet } from '../components/PorcelainControls';
import { HudSlider } from '../components/HudValues';
import { PrivateButton, PrivateLine, PrivateSheet } from '../pelvic/HudPrivateControls';
import { bodySpan as span, HudActions, ScreenActions } from './BodyActions';
import { cycleRowHeight, HudCycleReading, ScreenCycleReading } from './CycleReading';
import type { Row } from './controlRows';
import { useBodyEditor, type BodyActor } from './useBodyEditor';
import './body-controls.css';

function ScreenRow({ actor, row, blocked }: { actor: BodyActor; row: Row; blocked: boolean }) {
  switch (row.kind) {
    case 'actions': return <ScreenActions items={row.items} blocked={blocked}/>;
    case 'text': return <p className="body-note">{row.text}</p>;
    case 'cycle': return <ScreenCycleReading actor={actor} row={row} blocked={blocked}/>;
    case 'morph': return <label className="body-select">{row.label}<select disabled={blocked||(!row.names.length&&!row.value)}
      value={row.value??''} onChange={e=>row.choose(e.currentTarget.value||null)}><option value="">{row.none}</option>
      {row.value&&!row.names.includes(row.value)&&<option value={row.value} disabled>{row.value}</option>}
      {row.names.map(n=><option key={n} value={n}>{n}</option>)}</select></label>;
    case 'field': return <label className="body-range"><span>{row.label}<output>{row.formatted}</output></span><input
      aria-label={row.label} type="range" min={row.min} max={row.max} step={row.step} value={row.value}
      disabled={blocked||row.disabled} onChange={e=>row.change(e.currentTarget.valueAsNumber)}/></label>;
  }
}

function ScreenEditor(props: BodyActor) {
  const editor = useBodyEditor(props);
  return <div className="body-editor">
    {editor.tabs.length>0&&<nav className="body-tabs" aria-label={editor.title}><ScreenActions items={editor.tabs} blocked={false}/></nav>}
    <div className="body-fields">{editor.rows.map((row,i)=><ScreenRow key={`${row.kind}:${i}`} actor={props} row={row} blocked={editor.blocked}/>)}</div>
    {editor.footer.length>0&&<div className="body-footer"><ScreenActions items={editor.footer} blocked={editor.blocked}/></div>}
  </div>;
}

/** Mounted inside the selected actor's screen tools; folding it discards a pending preview. */
export function BodyScreenControls(props: BodyActor) {
  const title = useLanguageStore(s=>s.language==='zh'?'身体状态':'Body state');
  const name = useBackpack(s=>s.entries.find(e=>e.id===props.assetId)?.file.name ?? '');
  const [open,setOpen] = useState(false);
  return <details className="body-screen" onToggle={e=>setOpen(e.currentTarget.open)}><summary>{title}{open&&<span className="body-identity" title={name}>{name}</span>}</summary>
    {open&&<ScreenEditor key={`${props.assetId}:${props.runtimeId}`} {...props}/>}
  </details>;
}

const stableSliderInteraction = () => {}; // The actor anchor stays still while pointing.
function rowHeight(row: Row) {
  if (row.kind === 'cycle') return cycleRowHeight(row.organ);
  if (row.kind === 'text') return .105;
  return row.kind === 'field' && row.scrub ? .26 : .175;
}
function HudRow({ actor, row, blocked }: { actor: BodyActor; row: Row; blocked: boolean }) {
  switch(row.kind) {
    case 'actions': return <HudActions items={row.items} blocked={blocked}/>;
    case 'text': return <HudLine position={[0,0,0]} role="muted" width={span} center text={row.text}/>;
    case 'cycle': return <HudCycleReading actor={actor} row={row} blocked={blocked}/>;
    case 'morph': return <HudButton position={[0,0,0]} size={[span,.14]} label={`${row.label}: ${row.value??row.none}`}
      disabled={blocked||(!row.names.length&&!row.value)} onPress={row.browse}/>;
    case 'field': return <>
      <HudLine position={[0,row.scrub ? .08 : 0,0]} width={.99} text={`${row.label} · ${row.formatted}`} center/>
      {row.scrub&&<HudSlider position={[0,-.044,0]} width={.84} disabled={blocked||row.disabled} value={(row.value-row.min)/(row.max-row.min)}
        onChange={t=>row.change(row.min+Math.round(t*(row.max-row.min)/row.step)*row.step)} onInteractionChange={stableSliderInteraction}/>}
      {([-1,1] as const).map(dir=><HudButton key={dir} position={[dir*.62,row.scrub?-.044:0,0]} size={[.2,.14]} label={dir<0?'−':'+'}
        disabled={blocked||row.disabled||(dir<0?row.value<=row.min:row.value>=row.max)}
        onPress={()=>row.change(Math.max(row.min,Math.min(row.max,+(row.value+dir*row.step).toFixed(3))))}/>)}</>;
  }
}

function HudEditor({onBack,...actor}: BodyActor & { onBack: () => void }) {
  const editor = useBodyEditor(actor);
  const cycle = editor.rows.find(row=>row.kind==='cycle');
  const showTabs = editor.tabs.length>0 && !cycle?.organ;
  const Sheet = cycle ? PrivateSheet : HudSheet, Back = cycle ? PrivateButton : HudButton;
  const name = Array.from(editor.name), galleryName=name.length>24 ? `${name.slice(0,12).join('')}…${name.slice(-9).join('')}` : editor.name;
  const h = .24+(showTabs ? .185:0)+editor.rows.reduce((sum,row)=>sum+rowHeight(row),0)+(editor.footer.length ? .19 : 0)+.06;
  // Align the top edge throughout editing. Header and tabs do not jump while navigating.
  const top = .69;
  const contentTop = top-.23;
  let y = contentTop-(showTabs ? .185:0);
  return <group name="body:actor-tools">
    <group position-y={top-h/2}><Sheet size={[1.55,h]}/></group>
    {cycle ? <PrivateLine position={[-.175,top-.115,0]} width={1.08} title text={`${cycle.organ?cycle.views[1].label:editor.title} · ${galleryName}`}/>
      : <HudLine position={[-.175,top-.115,0]} width={1.08} role="title" text={`${editor.title} · ${editor.name}`}/>}
    <Back position={[.55,top-.115,0]} size={[.33,.14]} label={editor.back} variant="quiet" onPress={onBack}/>
    {showTabs&&<group position-y={contentTop-.085}><HudActions items={editor.tabs} blocked={false} tabs gallery={!!cycle}/></group>}
    {editor.rows.map((row,i)=>{
      const height=rowHeight(row),center=y-height/2; y-=height;
      return <group key={`${row.kind}:${i}`} position-y={center}><HudRow actor={actor} row={row} blocked={editor.blocked}/></group>;
    })}
    {editor.footer.length>0&&<group position-y={y-.10}><HudActions items={editor.footer} blocked={editor.blocked} gallery={!!cycle}/></group>}
  </group>;
}

/** Replaces the selected asset sheet inside its already-positioned actor anchor. */
export function BodyHudControls(props: BodyActor & { onBack: () => void }) {
  return <HudEditor key={`${props.assetId}:${props.runtimeId}`} {...props}/>;
}
