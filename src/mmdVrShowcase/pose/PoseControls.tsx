import { useId, useState } from 'react';
import { poseActions, type PoseKey } from './poseSession';
import { jointHint, limbBendLabel, nextPoseName, usePoseText } from './poseText';
import { POSE_ANGLE_STEP, POSE_AXES, POSE_BEND_STEP, usePoseTool } from './poseTool';
import { usePoseEditor, type PoseControlsProps } from './usePoseEditor';
import './pose-controls.css';

export { PoseHudControls } from './PoseHudControls';

export function PoseScreenControls(props: PoseControlsProps) {
  const s = usePoseEditor(props), t = usePoseText(), axis = usePoseTool(s => s.axis), id = useId();
  const [tab, setTab] = useState<'joints' | 'library'>('joints');
  const [draft, setDraft] = useState<string | null>(null), [last, setLast] = useState('');
  const [choice, setChoice] = useState('');
  const name = draft ?? nextPoseName(t.pose, s.savedNames), clean = name.trim();
  const chosen = s.savedNames.includes(choice) ? choice : s.savedNames[0];
  const movable = s.active && poseActions.canMove(s.selected), bend = s.active && poseActions.canBend(s.selected) && limbBendLabel(t, s.selected);
  const joint = s.keys.includes(s.selected), busy = s.dragging;
  const turn = (dir: number) => poseActions.rotate(s.selected, axis, dir * POSE_ANGLE_STEP);
  const save = () => {
    if (!s.active || !clean || s.savedNames.includes(clean)) return;
    if (s.save(clean)) { setChoice(clean); setLast(clean); setDraft(null); }
  };
  return <div className="pose-screen" aria-label={t.title} role="group">
    <div className="pose-screen-header"><h3>{t.title}</h3>{s.active && <span>{t.frozen}</span>}</div>
    {!s.active ? <><p role="status">{s.held ? t.held : t.unavailable}</p>
      <button onClick={s.begin}>{s.held ? t.resume : t.retry}</button>{s.held && <button onClick={s.restore}>{t.end}</button>}
      {props.onBack && <button onClick={s.leave}>{t.back}</button>}</> : <>
      <div className="pose-tabs">{(['joints', 'library'] as const).map(k => <button key={k} aria-pressed={tab === k}
        disabled={busy} onClick={() => setTab(k)}>{k === 'joints' ? t.adjust : t.library}</button>)}</div>
      {tab === 'joints' ? <>
        <label className="pose-field">{t.joint}<select disabled={busy || !s.keys.length} value={s.selected}
          onChange={e => poseActions.select(e.target.value as PoseKey)}>{s.keys.map(k => <option key={k} value={k}>{t.labels[k]}</option>)}</select></label>
        <p>{jointHint(t,true,movable,busy,s.wrist)}</p>
        <fieldset disabled={busy || !joint}><legend>{t.rotate}</legend>
          <div className="pose-axis">{POSE_AXES.map(a => <button key={a} aria-pressed={a === axis}
            onClick={() => usePoseTool.setState({ axis: a })}>{t.axes[a]}</button>)}</div>
          <div className="pose-step"><span>{t.labels[s.selected]} · {axis.toUpperCase()}</span>
            {[ -1, 1 ].map(d => <button key={d} aria-label={`${t.labels[s.selected]} ${axis.toUpperCase()} ${d * 5}°`} onClick={() => turn(d)}>{d < 0 ? '−5°' : '+5°'}</button>)}</div>
          {bend && <div className="pose-step"><span>{bend}</span>{[-1, 1].map(d => <button key={d} aria-label={`${bend} ${d * 10}°`}
            onClick={() => poseActions.bend(s.selected, d * POSE_BEND_STEP)}>{d < 0 ? '−10°' : '+10°'}</button>)}</div>}
        </fieldset>
        <div className="pose-row"><label><input type="checkbox" checked={s.feetLocked} disabled={busy || !(poseActions.canBend('leftFoot') || poseActions.canBend('rightFoot'))}
          onChange={e => poseActions.setFeetLocked(e.target.checked)}/>{t.lock}</label>
          {s.wrist && <button disabled={s.wrist.disabled} aria-pressed={s.wrist.pinned} onClick={s.wrist.toggle}>{s.wrist.pinned ? t.unpin : t.pin}</button>}
          <button disabled={busy || !s.canUndo} onClick={poseActions.undo}>{t.undo}</button></div>
      </> : <>
        <label className="pose-field" htmlFor={id}>{t.name}</label><input id={id} className="pose-name" type="text" maxLength={32} value={name}
          onChange={e => { setDraft(e.target.value); setLast(''); }} onKeyDown={e => { if (e.key === 'Enter' && !e.nativeEvent.isComposing) save(); }}/>
        <button disabled={busy || !clean || s.savedNames.includes(clean)} onClick={save}>{t.save}</button>
        <p role="status">{s.savedNames.includes(clean) ? t.duplicate : last ? `${t.saved}: ${last}` : ''}</p>
        {chosen ? <><label className="pose-field">{t.library}<select value={chosen} disabled={busy} onChange={e => setChoice(e.target.value)}>
          {s.savedNames.map(n => <option key={n} value={n}>{n}</option>)}</select></label>
          <button disabled={busy} onClick={() => { if (poseActions.load(props.assetId, props.runtimeId, chosen)) setTab('joints'); }}>{t.load}</button></> : <p>{t.empty}</p>}
      </>}
      <div className="pose-exit">{props.onBack && <button disabled={busy} onClick={s.leave}>{t.keep}</button>}<button disabled={busy} onClick={s.restore}>{t.end}</button></div>
    </>}
  </div>;
}
