import { useState } from 'react';
import { HudButton, HudLine, HudSheet } from '../components/PorcelainControls';
import { poseActions } from './poseSession';
import { jointHint, limbBendLabel, nextPoseName, usePoseText } from './poseText';
import { POSE_ANGLE_STEP, POSE_AXES, POSE_BEND_STEP, usePoseTool } from './poseTool';
import { usePoseEditor, type PoseControlsProps } from './usePoseEditor';

const half = .315, full = 1.22;
const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
type KeyProps = { x?: number; y: number; w?: number; text: string; press: () => void; active?: boolean; disabled?: boolean; quiet?: boolean };
function Key({ x = 0, y, w = full, text, press, active, disabled, quiet }: KeyProps) {
  return <HudButton position={[x,y,0]} size={[w,.14]} label={text} onPress={press} active={active} disabled={disabled} variant={quiet ? 'quiet' : 'button'}/>;
}
function Line({ y, text, muted = false }: { y: number; text: string; muted?: boolean }) {
  return <HudLine position={[0,y,0]} text={text} width={full} role={muted ? 'muted' : 'body'}/>;
}

/** Actor sheet local bounds: x ±.67, y ±.775. All naming is operable inside XR. */
export function PoseHudControls(props: PoseControlsProps & { onBack: () => void }) {
  const s = usePoseEditor(props), t = usePoseText(), axis = usePoseTool(s => s.axis);
  const [tab, setTab] = useState<'joints' | 'library' | 'keyboard'>('joints');
  const [draft, setDraft] = useState<string | null>(null), [chosen, setChosen] = useState(''), [saved, setSaved] = useState('');
  const [lower, setLower] = useState(false);
  const busy = s.dragging, name = draft ?? nextPoseName(t.pose, s.savedNames), clean = name.trim();
  const savedIndex = Math.max(0, s.savedNames.indexOf(chosen)), entry = s.savedNames[savedIndex];
  const index = s.keys.indexOf(s.selected), joint = index !== -1, movable = s.active && joint && poseActions.canMove(s.selected);
  const bend = s.active && poseActions.canBend(s.selected) && limbBendLabel(t, s.selected);
  const keyStep = (d: number) => {
    if (s.keys.length) poseActions.select(s.keys[(index + d + s.keys.length) % s.keys.length]);
  };
  const edit = (value: string) => { setDraft(value.slice(0,32)); setSaved(''); };
  return <group name="pose:tools" pointerEventsType={{ allow: ['ray'] }} pointerEventsOrder={1}>
    <HudSheet size={[1.34,1.55]}/>
    <HudLine position={[-.33,.665,0]} width={.55} role="title" text={tab === 'keyboard' ? t.typeName : t.title}/>
    <Key x={.275} y={.665} w={.67} text={tab === 'keyboard' ? t.done : s.active ? t.keep : t.back}
      press={tab === 'keyboard' ? () => setTab('library') : s.leave} disabled={busy} quiet/>
    {!s.active ? <><Line y={.24} text={s.held ? t.held : t.unavailable}/>
      <Key y={.02} text={s.held ? t.resume : t.retry} press={s.begin}/>
      {s.held && <Key y={-.20} text={t.end} press={s.restore}/>}</> : tab === 'keyboard' ? <>
      <Line y={.50} text={name || t.name}/>
      {Array.from(lower ? letters.toLowerCase() : letters, (c,i) => <Key key={i} x={(i % 6 - 2.5) * .21} y={.34 - Math.floor(i / 6) * .155} w={.18}
        text={c} disabled={name.length >= 32} press={() => edit(name + c)}/>)}
      <Key x={-.465} y={-.65} w={.29} text={lower ? 'ABC' : 'abc'} press={() => setLower(!lower)}/>
      <Key x={-.155} y={-.65} w={.29} text={t.space} disabled={name.length >= 32} press={() => edit(name + ' ')}/>
      <Key x={.155} y={-.65} w={.29} text={t.erase} disabled={!name} press={() => edit(Array.from(name).slice(0,-1).join(''))}/>
      <Key x={.465} y={-.65} w={.29} text={t.clear} disabled={!name} press={() => edit('')}/>
    </> : <>
      <Key x={-half} y={.48} w={.59} text={t.adjust} active={tab === 'joints'} disabled={busy} press={() => setTab('joints')}/>
      <Key x={half} y={.48} w={.59} text={t.library} active={tab === 'library'} disabled={busy} press={() => setTab('library')}/>
      {tab === 'joints' ? <>
        <Key x={-.47} y={.30} w={.28} text={t.previous} disabled={busy || s.keys.length < 2} press={() => keyStep(-1)}/>
        <HudLine position={[0,.30,0]} width={.60} center text={t.labels[s.selected]}/>
        <Key x={.47} y={.30} w={.28} text={t.next} disabled={busy || s.keys.length < 2} press={() => keyStep(1)}/>
        <Line y={.145} text={jointHint(t,false,movable,busy,s.wrist)} muted/>
        {POSE_AXES.map((a,i) => <Key key={a} x={(i-1)*.42} y={.005} w={.38} text={t.axes[a]} active={axis === a} disabled={busy || !joint}
          press={() => usePoseTool.setState({ axis: a })}/>)}
        <Key x={-half} y={-.165} w={.59} text={`${axis.toUpperCase()} −5°`} disabled={busy || !joint} press={() => poseActions.rotate(s.selected,axis,-POSE_ANGLE_STEP)}/>
        <Key x={half} y={-.165} w={.59} text={`${axis.toUpperCase()} +5°`} disabled={busy || !joint} press={() => poseActions.rotate(s.selected,axis,POSE_ANGLE_STEP)}/>
        {bend && <><Key x={-half} y={-.335} w={.59} text={`${bend} −`} disabled={busy} press={() => poseActions.bend(s.selected,-POSE_BEND_STEP)}/>
          <Key x={half} y={-.335} w={.59} text={`${bend} +`} disabled={busy} press={() => poseActions.bend(s.selected,POSE_BEND_STEP)}/></>}
        <Key x={-half} y={-.505} w={.59} text={s.feetLocked ? t.unlock : t.lock} active={s.feetLocked}
          disabled={busy || !(poseActions.canBend('leftFoot') || poseActions.canBend('rightFoot'))} press={() => poseActions.setFeetLocked(!s.feetLocked)}/>
        <Key x={half} y={-.505} w={.59} text={t.undo} disabled={busy || !s.canUndo} press={poseActions.undo}/>
      </> : <>
        <Line y={.305} text={`${t.name}: ${name}`} />
        <Key x={-half} y={.135} w={.59} text={t.editName} disabled={busy} press={() => { setDraft(name); setTab('keyboard'); }}/>
        <Key x={half} y={.135} w={.59} text={t.save} disabled={busy || !clean || s.savedNames.includes(clean)}
          press={() => { if (s.save(clean)) { setChosen(clean); setSaved(clean); setDraft(null); } }}/>
        <Line y={-.025} muted text={s.savedNames.includes(clean) ? t.duplicate : saved ? `${t.saved}: ${saved}` : ''}/>
        {entry ? <><Line y={-.20} text={`${savedIndex + 1}/${s.savedNames.length}  ${entry}`}/>
          <Key x={-.475} y={-.385} w={.27} text={t.previous} disabled={busy || savedIndex === 0} press={() => setChosen(s.savedNames[savedIndex-1])}/>
          <Key y={-.385} w={.60} text={t.load} disabled={busy} press={() => { if (poseActions.load(props.assetId, props.runtimeId, entry)) setTab('joints'); }}/>
          <Key x={.475} y={-.385} w={.27} text={t.next} disabled={busy || savedIndex+1 >= s.savedNames.length} press={() => setChosen(s.savedNames[savedIndex+1])}/></> : <Line y={-.20} text={t.empty} muted/>}
      </>}
      {tab === 'joints' && s.wrist ? <>
        <Key x={-half} y={-.68} w={.59} text={s.wrist.pinned ? t.unpin : t.pin} active={s.wrist.pinned} disabled={s.wrist.disabled} press={s.wrist.toggle}/>
        <Key x={half} y={-.68} w={.59} text={t.end} press={s.restore} disabled={busy} quiet/>
      </> : <Key y={-.68} text={t.end} press={s.restore} disabled={busy} quiet/>}
    </>}
  </group>;
}
