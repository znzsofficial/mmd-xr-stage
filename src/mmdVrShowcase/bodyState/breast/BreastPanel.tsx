import { useLanguageStore } from '../../../languageStore';
import { PrivateButton, PrivateLine, PrivateSlider } from '../../pelvic/HudPrivateControls';
import { privateVars } from '../../pelvic/palette';
import { ScreenActions } from '../BodyActions';
import type { BreastReading } from '../controlRows';
import type { BodyActor } from '../useBodyEditor';
import { BreastHudGraphic, BreastScreenGraphic } from './BreastGraphic';
import { setBreastView, useBreastView } from './view';
import './breast-panel.css';

type Props = { actor: BodyActor; row: BreastReading; blocked: boolean };
const copy = {
  zh: {outside:'外观', cut:'剖面', labels:'标注', angle:'观察角度', drag:'横拖旋转', freeze:'定格预览', resume:'继续预览'},
  en: {outside:'Exterior', cut:'Cutaway', labels:'Labels', angle:'View angle', drag:'Drag to rotate', freeze:'Freeze preview', resume:'Resume preview'},
};

function useFigureControls(assetId: string) {
  const t = useLanguageStore(s=>s.language==='zh'?copy.zh:copy.en);
  const {degrees,motion,section,labels} = useBreastView(assetId);
  const modes=[{label:t.outside,active:!section,run:()=>setBreastView(assetId,{section:false})},
    {label:t.cut,active:section,run:()=>setBreastView(assetId,{section:true})}];
  return {t,degrees,motion,section,labels,modes, motionLabel:motion?t.freeze:t.resume,
    toggleLabels:()=>setBreastView(assetId,{labels:!labels}),
    rotate:(angle:number)=>setBreastView(assetId,{degrees:Math.round(angle)}),
    toggle:()=>setBreastView(assetId,{motion:!motion})};
}

export function ScreenBreastPanel({actor,row,blocked}: Props) {
  const view=useFigureControls(actor.assetId), f=row.fullness;
  return <div className="breast-reading" style={privateVars}>
    <figure className="breast-figure">
      <BreastScreenGraphic {...actor}/>
      <figcaption>
        <dl>{row.readings.map(({label,value})=><div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl>
        <small title={row.detail}>{view.section && view.labels ? row.detail : row.caption}</small>
      </figcaption>
    </figure>
    <div className="breast-modes">
      <div className="body-views"><ScreenActions items={view.modes} blocked={false}/></div>
      {view.section&&<label className="breast-labels"><input type="checkbox" checked={view.labels} onChange={view.toggleLabels}/>{view.t.labels}</label>}
    </div>
    <label className="body-range"><span>{f.label}<output>{f.formatted}</output></span>
      <input aria-label={f.label} aria-valuetext={f.formatted} type="range" min={f.min} max={f.max} step={f.step}
        value={f.value} disabled={blocked} onChange={e=>f.change(e.currentTarget.valueAsNumber)}/></label>
    <div className="breast-view-actions">
      <label className="body-range"><span>{view.t.drag}<output>{view.degrees}°</output></span>
        <input aria-label={view.t.angle} type="range" min={-90} max={90} step={1} value={view.degrees}
          onChange={e=>view.rotate(e.currentTarget.valueAsNumber)}/></label>
      <div className="body-actions"><button type="button" aria-pressed={!view.motion} onClick={view.toggle}>{view.motionLabel}</button></div>
    </div>
  </div>;
}

// The picture and state rail share a top edge; the two slider hit planes
// sit side by side below them. A draft adds a footer without moving the art.
export const breastRowHeight=1.30, breastSpan=1.74;
const artWidth=1.23, artX=(artWidth-breastSpan)/2, artY=.234;
const readWidth=breastSpan-artWidth-.045, readX=(breastSpan-readWidth)/2;
const half=(breastSpan-.09)/2, sliderX=(breastSpan-half)/2;

export function HudBreastPanel({actor,row,blocked}: Props) {
  const view=useFigureControls(actor.assetId), f=row.fullness;
  return <group name="body:breast-view">
    <group position={[artX,artY,0]}><BreastHudGraphic {...actor} widthM={artWidth}/></group>
    {row.readings.map(({label,value},i)=><PrivateLine key={label} position={[readX,.55-i*.119,0]}
      width={readWidth} text={label} value={value}/>)}
    <PrivateLine position={[readX,.052,0]} width={readWidth} text={view.section&&view.labels?row.detail:row.caption}/>
    <PrivateButton position={[readX,-.091,0]} size={[readWidth,.14]} label={view.motionLabel} active={!view.motion} onPress={view.toggle}/>
    {view.modes.map((a,i)=><PrivateButton key={a.label} position={[artX+(i-.5)*(artWidth+.035)/2,-.263,0]} size={[(artWidth-.035)/2,.14]}
      label={a.label} active={a.active} variant="tab" onPress={a.run}/>)}
    {view.section&&<PrivateButton position={[readX,-.263,0]} size={[readWidth,.14]} label={view.t.labels} active={view.labels} onPress={view.toggleLabels}/>}
    <PrivateLine position={[-sliderX,-.43,0]} width={half} text={view.t.angle} value={`${view.degrees}°`}/>
    <PrivateSlider position={[-sliderX,-.551,0]} width={half} value={(view.degrees+90)/180} disabled={false} onChange={u=>view.rotate(u*180-90)}/>
    <PrivateLine position={[sliderX,-.43,0]} width={half} text={f.label} value={f.formatted}/>
    <PrivateSlider position={[sliderX,-.551,0]} width={half} value={(f.value-f.min)/(f.max-f.min)} disabled={blocked}
      onChange={u=>f.change(f.min+Math.round(u*(f.max-f.min)/f.step)*f.step)}/>
  </group>;
}
