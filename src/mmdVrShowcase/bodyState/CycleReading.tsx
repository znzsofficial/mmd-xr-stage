import { PrivateButton, PrivateLine, PrivateSlider } from '../pelvic/HudPrivateControls';
import { OrganHudPanel, OrganScreenPanel } from '../pelvic/atlas/AtlasPanel';
import { bodySpan, HudActions, ScreenActions } from './BodyActions';
import type { CycleReading } from './controlRows';
import { HudLiningDiagram, ScreenLiningDiagram } from './LiningDiagram';
import type { BodyActor } from './useBodyEditor';

type Props = { actor: BodyActor; row: CycleReading; blocked: boolean };

function ScreenDate({row, blocked}: Omit<Props,'actor'>) {
  const {date, previous, next} = row;
  return <div className="body-calendar">
    <button type="button" onClick={previous.run} disabled={blocked}>{previous.label}</button>
    <label className="body-range"><span>{date.label}<output>{date.value} / {date.max}</output></span>
      <input aria-label={date.label} type="range" min={1} max={date.max+.9} step={.1} value={date.value} disabled={blocked}
        onChange={e=>date.change(e.currentTarget.valueAsNumber)}/></label>
    <button type="button" onClick={next.run} disabled={blocked}>{next.label}</button>
  </div>;
}

export function ScreenCycleReading({actor,row,blocked}: Props) {
  return <div className="body-reading">
    <div className="body-views"><ScreenActions items={row.views} blocked={false}/></div>
    {row.organ ? <div className="body-organ-reading">
      <ScreenDate row={row} blocked={blocked}/>
      <OrganScreenPanel {...actor}/>
    </div> : <>
      <ScreenLiningDiagram {...row.pair}/>
      <ScreenDate row={row} blocked={blocked}/>
      <div className="body-cycle-settings"><ScreenActions items={row.settings} blocked={blocked}/></div>
    </>}
  </div>;
}

// OrganHudPanel is centred on its own origin, including its view/freeze controls.
const organWidth = .98, organHeight = organWidth * 1.30;
export const cycleRowHeight = (organ: boolean) => organ ? organHeight+.035 : 1.01;

function DateSlider({date, blocked, width, x=0, y=0}: {date: CycleReading['date']; blocked: boolean; width: number; x?: number; y?: number}) {
  const span = date.max-.1;
  return <PrivateSlider position={[x,y,0]} width={width} value={(date.value-1)/span} disabled={blocked}
    onChange={v=>date.change((10+Math.round(v*span*10))/10)}/>;
}

export function HudCycleReading({actor,row,blocked}: Props) {
  if (row.organ) {
    const rail = bodySpan-organWidth-.05;
    return <>
      <group position-x={(bodySpan-organWidth)/2}><OrganHudPanel {...actor} widthM={organWidth}/></group>
      <group position-x={-(bodySpan-rail)/2}>
        <PrivateButton position={[0,organHeight/2-.08,0]} size={[rail,.14]} label={row.views[0].label} variant="quiet" onPress={row.views[0].run}/>
        <PrivateLine position={[0,.245,0]} width={rail} text={row.date.label}/>
        <PrivateLine position={[0,.13,0]} width={rail} title text={`${row.date.value} / ${row.date.max}`}/>
        <DateSlider date={row.date} blocked={blocked} width={rail} y={-.02}/>
        <PrivateButton position={[0,-.235,0]} size={[rail,.15]} label={row.previous.label} disabled={blocked} onPress={row.previous.run}/>
        <PrivateButton position={[0,-.42,0]} size={[rail,.15]} label={row.next.label} disabled={blocked} onPress={row.next.run}/>
      </group>
    </>;
  }
  return <>
    <group position-y={.418}><HudActions items={row.views} blocked={false} tabs gallery/></group>
    <group position-y={.085}><HudLiningDiagram {...row.pair}/></group>
    <group position-y={-.245}>
      <PrivateButton position={[-.589,0,0]} size={[.27,.14]} label={row.previous.label} disabled={blocked} onPress={row.previous.run}/>
      <PrivateLine position={[-.285,0,0]} width={.285} text={`${row.date.value} / ${row.date.max}`}/>
      <DateSlider date={row.date} blocked={blocked} width={.54} x={.152}/>
      <PrivateButton position={[.589,0,0]} size={[.27,.14]} label={row.next.label} disabled={blocked} onPress={row.next.run}/>
    </group>
    <group position-y={-.418}><HudActions items={row.settings} blocked={blocked} gallery/></group>
  </>;
}
