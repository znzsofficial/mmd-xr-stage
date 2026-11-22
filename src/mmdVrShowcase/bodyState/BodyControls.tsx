import {useId,useLayoutEffect,useRef} from 'react';
import { HudButton, HudLine, HudSheet } from '../components/PorcelainControls';
import { HudSlider } from '../components/HudValues';
import { PrivateButton, PrivateLine, PrivateSheet } from '../pelvic/HudPrivateControls';
import { bodySpan as span, HudActions, ScreenActions } from './BodyActions';
import { breastRowHeight, breastSpan, HudBreastPanel, ScreenBreastPanel } from './breast/BreastPanel';
import { cycleRowHeight, HudCycleReading, ScreenCycleReading } from './CycleReading';
import type { Row } from './controlRows';
import { useBodyEditor, type BodyActor } from './useBodyEditor';
import './body-controls.css';

function ScreenDestination({row,blocked}:{row:Extract<Row,{kind:'destination'}>;blocked:boolean}) {
  const detail=useId();
  return <button type="button" className="body-destination" aria-label={row.action.label} aria-describedby={detail} disabled={blocked||row.action.disabled} onClick={row.action.run}>
    <span><strong>{row.action.label}</strong><small id={detail}>{row.detail}</small></span>
    <svg width="18" height="18" viewBox="0 0 20 20" aria-hidden="true"><path d="m7.5 4.5 5.5 5.5-5.5 5.5" fill="none" stroke="currentColor" strokeWidth="1.5"/></svg></button>;
}
function ScreenRow({ actor, row, blocked }: { actor: BodyActor; row: Row; blocked: boolean }) {
  switch (row.kind) {
    case 'actions': return <ScreenActions items={row.items} blocked={blocked}/>;
    case 'text': return <p className="body-note">{row.text}</p>;
    case 'destination': return <ScreenDestination row={row} blocked={blocked}/>;
    case 'breast': return <ScreenBreastPanel actor={actor} row={row} blocked={blocked}/>;
    case 'cycle': return <ScreenCycleReading actor={actor} row={row} blocked={blocked}/>;
    case 'morph': return <label className="body-select">{row.label}<select disabled={blocked||(!row.names.length&&!row.value)}
      value={row.value??''} onChange={e=>row.choose(e.currentTarget.value||null)}><option value="">{row.none}</option>
      {row.value&&!row.names.includes(row.value)&&<option value={row.value} disabled>{row.value}</option>}
      {row.names.map(n=><option key={n} value={n}>{n}</option>)}</select></label>;
    case 'field': return <label className="body-range"><span>{row.label}<output>{row.formatted}</output></span><input
      aria-label={row.label} aria-valuetext={row.formatted} type="range" min={row.min} max={row.max} step={row.step} value={row.value}
      disabled={blocked||row.disabled} onChange={e=>row.change(e.currentTarget.valueAsNumber)}/></label>;
  }
}

function ScreenEditor({onBack,...props}: BodyActor & {onBack?:()=>void}) {
  const editor = useBodyEditor(props);
  const back = editor.backAction ?? (onBack && {label:editor.back,run:onBack});
  const panel=useRef<HTMLDivElement>(null),heading=useRef<HTMLHeadingElement>(null),previous=useRef(editor.page);
  useLayoutEffect(()=>{
    const sidebar=panel.current?.closest('.screen-library');if(sidebar)sidebar.scrollTop=0;
    // If the control that opened a detail page was removed, give keyboard
    // users a reading position. Main section switches keep their button focus.
    if(previous.current!==editor.page&&!panel.current?.contains(document.activeElement))heading.current?.focus({preventScroll:true});
    previous.current=editor.page;
  },[editor.page]);
  return <div ref={panel} className="body-screen body-editor" data-page={editor.page}>
    <header className="body-page"><div className="body-page-name"><h4 ref={heading} tabIndex={-1}>{editor.title}</h4><small title={editor.name}>{editor.name}</small></div>
      {back&&<ScreenActions items={[back]} blocked={false}/>}</header>
    {!!editor.nav.length&&<nav aria-label={editor.sectionLabel} className="body-sections"><ScreenActions items={editor.nav} blocked={false}/></nav>}
    <div className="body-fields" key={editor.page}>{editor.rows.map((row,i)=><ScreenRow key={`${row.kind}:${i}`} actor={props} row={row} blocked={editor.blocked}/>)}</div>
    {editor.status&&<footer className="body-footer" data-preview={editor.inDraft||undefined}>
      <span className="body-edit-status" role="status">{editor.status}</span>
      {!!editor.footer.length&&<ScreenActions items={editor.footer} blocked={editor.blocked}/>}</footer>}
  </div>;
}

/** The actor sheet owns entry/exit and already identifies the selected file. */
export function BodyScreenControls(props: BodyActor & {onBack?:()=>void}) {
  return <ScreenEditor key={`${props.assetId}:${props.runtimeId}`} {...props}/>;
}

const stableSliderInteraction = () => {}; // The actor anchor stays still while pointing.
function rowHeight(row: Row) {
  if (row.kind === 'breast') return breastRowHeight;
  if (row.kind === 'cycle') return cycleRowHeight(row.organ);
  if (row.kind === 'text') return .105;
  if (row.kind === 'destination') return .245;
  return row.kind === 'field' && row.scrub ? .26 : .175;
}
function HudRow({ actor, row, blocked }: { actor: BodyActor; row: Row; blocked: boolean }) {
  switch(row.kind) {
    case 'actions': return <HudActions items={row.items} blocked={blocked}/>;
    case 'text': return <HudLine position={[0,0,0]} role="muted" width={span} center text={row.text}/>;
    case 'destination': return <><HudButton position={[0,.042,0]} size={[span,.14]} label={row.action.label} onPress={row.action.run} disabled={blocked||row.action.disabled}/>
      <HudLine position={[0,-.076,0]} role="muted" width={span} center text={row.detail}/></>;
    case 'breast': return <HudBreastPanel actor={actor} row={row} blocked={blocked}/>;
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
  const breast = editor.rows.some(row=>row.kind==='breast'), gallery = !!cycle || breast;
  const contentWidth=breast?breastSpan:span, extra=contentWidth-span;
  const Sheet = gallery ? PrivateSheet : HudSheet, Back = gallery ? PrivateButton : HudButton;
  const name = Array.from(editor.name), shortName=name.length>18 ? `${name.slice(0,9).join('')}…${name.slice(-6).join('')}` : editor.name;
  // One short receipt beside Undo; reserve two rows only for an editable draft.
  const compactReceipt=!!editor.status&&!editor.inDraft;
  const navHeight=editor.nav.length ? .18 : 0,statusHeight=editor.status ? (compactReceipt ? .20 : .135) : 0;
  const h = .24+navHeight+editor.rows.reduce((sum,row)=>sum+rowHeight(row),0)+statusHeight+(editor.inDraft ? .205 : 0)+.06;
  // Keep the header and back target still when the working page changes.
  const top = .69;
  const contentTop = top-.23;
  let y = contentTop-navHeight;
  return <group name="body:actor-tools">
    <group position-y={top-h/2}><Sheet size={[contentWidth+.1,h]}/></group>
    {gallery ? <PrivateLine position={[-.25-extra/4,top-.115,0]} width={.94+extra/2} title text={`${editor.title} · ${shortName}`}/>
      : <HudLine position={[-.25,top-.115,0]} width={.94} role="title" text={`${editor.title} · ${shortName}`}/>}
    <Back key={`${editor.page}:${editor.back}`} position={[.48,top-.115,0]} size={[.47,.14]} label={editor.back} variant="quiet" onPress={editor.backAction?.run??onBack}/>
    {!!editor.nav.length&&<group position-y={contentTop-.075}><HudActions items={editor.nav} blocked={false} tabs gallery={gallery} width={contentWidth}/></group>}
    {editor.rows.map((row,i)=>{
      const height=rowHeight(row),center=y-height/2; y-=height;
      return <group key={`${editor.page}:${row.kind}:${i}`} position-y={center}><HudRow actor={actor} row={row} blocked={editor.blocked}/></group>;
    })}
    {editor.status&&<group position={[compactReceipt&&editor.footer.length?-.24:0,y-(compactReceipt ? .10 : .069),0]}>
      {gallery?<PrivateLine position={[0,0,0]} width={compactReceipt&&editor.footer.length?contentWidth-.52:contentWidth} title text={editor.status}/>:
        <HudLine position={[0,0,0]} width={compactReceipt&&editor.footer.length?contentWidth-.52:contentWidth} role="title" text={editor.status}/>}
    </group>}
    {editor.footer.length>0&&<group key={`footer:${editor.page}`} position={[compactReceipt?contentWidth/2-.25:0,compactReceipt?y-.10:y-statusHeight-.105,0]} scale={1.25}>
      <HudActions items={editor.footer} blocked={editor.blocked} gallery={gallery} width={(compactReceipt ? .50 : contentWidth)/1.25}/></group>}
  </group>;
}

/** Replaces the selected asset sheet inside its already-positioned actor anchor. */
export function BodyHudControls(props: BodyActor & { onBack: () => void }) {
  return <HudEditor key={`${props.assetId}:${props.runtimeId}`} {...props}/>;
}
