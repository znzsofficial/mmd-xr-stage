import { useFrame } from "@react-three/fiber";
import { useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { useLanguageStore } from "../../languageStore";
import { useBackpack, type BackpackEntry, type BackpackLive } from "../backpack";
import { formatMmdVrModelScale, nextMmdVrModelScale, previousMmdVrModelScale } from "../mmdVrAdjustments";
import { useMmdVrStore } from "../mmdVrStore";
import { fileSource, PageControls } from "./BackpackPanels";
import { HudButton, HudLine, HudSheet } from "./PorcelainControls";
import { useHudWorldInput } from "./hudWorldInput";
import { isStoryRoom, STORIES, TOYS, useStagePlay } from '../play/stagePlay';
import { cueStory } from '../play/storyActions';

/** Resolve once on selection/move. Keep the controls stationary while the user aims.
 * A hidden or off-screen asset selected in the backpack uses the forward reading zone. */
export function positionWorldTools(camera: THREE.Camera, group: THREE.Group, anchor: BackpackLive["position"]) {
  const eye = camera.getWorldPosition(new THREE.Vector3());
  const forward = camera.getWorldDirection(new THREE.Vector3()).setY(0);
  if (forward.lengthSq() < 0.00001) forward.set(0, 0, -1);
  forward.normalize();
  const right = new THREE.Vector3(-forward.z, 0, forward.x);
  const delta = new THREE.Vector3(...anchor).sub(eye);
  const depth = delta.dot(forward), lateral = delta.dot(right);
  const distance = THREE.MathUtils.clamp(depth - 0.2, 1.45, 2.1);
  const side = depth > 0 && Math.abs(lateral) < depth * 0.85
    ? THREE.MathUtils.clamp(lateral * distance / depth + (lateral > 0 ? -0.84 : 0.84), -0.82, 0.82) : 0;
  const pos = eye.clone().addScaledVector(forward, distance).addScaledVector(right, side);
  pos.y = eye.y - 0.1;
  group.position.copy(group.parent ? group.parent.worldToLocal(pos) : pos);
  if (group.parent) group.parent.worldToLocal(eye);
  group.rotation.y = Math.atan2(eye.x - group.position.x, eye.z - group.position.z);
}

export function BackpackWorldTools() {
  const id = useBackpack(s => s.selected), draft = useBackpack(s => s.draft);
  const entry = useBackpack(s => s.entries.find(e => e.id === id));
  const instance = useBackpack(s => id ? s.live[id] : null);
  const blocked = useHudWorldInput(s => s.blocked);
  const recovery = useMmdVrStore(s => s.assetLoad.running || s.physicsFatal || s.placeMode);
  if (!entry || !instance || draft || blocked || recovery) return null;
  return <SelectedTools key={entry.id} entry={entry} instance={instance} />;
}

function SelectedTools({ entry, instance }: { entry: BackpackEntry; instance: BackpackLive }) {
  const t = useLanguageStore(s => s.t);
  const transform = useMmdVrStore(s => (entry.kind === "model" ? s.models : s.objects).find(e => e.id === instance.runtimeId));
  const busy = useBackpack(s => s.busy), physicsBusy = useMmdVrStore(s => s.physicsBusy);
  const [page, setPage] = useState<'tools'|'motions'|'prop'>('tools');
  const carries = useStagePlay(s=>s.character?.assetId===entry.id);
  const characterToy=useStagePlay(s=>s.character?.toy),room=useMmdVrStore(s=>s.prefs.scenery);
  const cues=page==='prop'&&carries&&isStoryRoom(room)&&characterToy===STORIES[room].toy;
  const group = useRef<THREE.Group>(null), last = useRef<BackpackLive["position"] | null>(null);
  useFrame(({ camera, gl }) => {
    const pos = instance.bounds?.center ?? instance.position;
    if (!group.current || (last.current && last.current.every((n, i) => n === pos[i]))) return;
    positionWorldTools(gl.xr.isPresenting ? gl.xr.getCamera() : camera, group.current, pos); last.current = [...pos];
  });
  const locked = busy || physicsBusy;
  const scale = transform?.scale ?? 1, rotation = transform?.rotationY ?? 0;
  return <group ref={group} name="backpack-world-tools" scale={0.86} pointerEventsOrder={1} pointerEventsType={{ deny: ["touch", "grab"] }}>
    <group position-y={cues?-.10:0}><HudSheet size={[1.34, cues?1.20:1.0]} /></group>
    <HudLine position={[-0.16, 0.37, 0]} text={entry.file.name} width={0.93} role="title" />
    <HudButton position={[0.47, 0.37, 0]} label={t(page !== 'tools' ? "hudTools" : "hudDone")} size={[0.31, 0.13]} variant="quiet" onPress={() => {
      if (page !== 'tools') setPage('tools'); else useBackpack.getState().select(null);
    }} disabled={busy} />
    {page==='motions' ? <MotionPicker id={entry.id} locked={locked} /> : page==='prop' ? <CharacterPropTools id={entry.id} instance={instance} locked={locked}/> : <>
      <HudLine position={[0, 0.225, 0]} width={1.24} role="muted" text={busy ? t("hudWorking") : `${t(instance.visible ? "hudOnStage" : "hudOnStageHidden")} · ${Math.round(rotation)}° · ${formatMmdVrModelScale(scale)}`} />
      <HudButton position={[-0.315, 0.06, 0]} label={t("hudMove")} size={[0.59, 0.15]} disabled={locked} onPress={() => useBackpack.getState().beginPlace(entry.id)} />
      {entry.kind === "model" ? <HudButton position={[0.315, 0.06, 0]} label={t("hudChangeMotion")} size={[0.59, 0.15]} disabled={locked} onPress={() => setPage('motions')} /> : null}
      <HudButton position={[-0.465, -0.145, 0]} label={t("hudTurnLeft")} size={[0.3, 0.14]} disabled={locked || !transform} onPress={() => useMmdVrStore.getState().requestModelRotation(instance.runtimeId, rotation - 15)} />
      <HudButton position={[-0.15, -0.145, 0]} label={t("hudTurnRight")} size={[0.3, 0.14]} disabled={locked || !transform} onPress={() => useMmdVrStore.getState().requestModelRotation(instance.runtimeId, rotation + 15)} />
      <HudButton position={[0.165, -0.145, 0]} label={t("hudSmaller")} size={[0.29, 0.14]} disabled={locked || !transform || previousMmdVrModelScale(scale) === scale} onPress={() => useMmdVrStore.getState().requestModelScale(instance.runtimeId, previousMmdVrModelScale(scale))} />
      <HudButton position={[0.475, -0.145, 0]} label={t("hudLarger")} size={[0.28, 0.14]} disabled={locked || !transform || nextMmdVrModelScale(scale) === scale} onPress={() => useMmdVrStore.getState().requestModelScale(instance.runtimeId, nextMmdVrModelScale(scale))} />
      {entry.kind==='model' && <HudButton position={[-.315,-.365,0]} size={[.59,.14]} label={t(carries?'propGrip':'propGive')} disabled={locked} onPress={()=>setPage('prop')}/>}
      <HudButton position={[entry.kind==='model'?.315:0, -0.365, 0]} label={t("hudPutAway")} size={[entry.kind==='model'?.59:1.24, 0.14]} disabled={locked} onPress={() => useBackpack.getState().putAway(entry.id)} />
    </>}
    {cues&&isStoryRoom(room)&&(['left','right'] as const).map((side,i)=><HudButton key={side} position={[(i-.5)*.63,-.555,0]} size={[.59,.14]} disabled={locked||!instance.visible} label={t(STORIES[room][side])} onPress={()=>cueStory(room,side)}/>)}
  </group>;
}

function CharacterPropTools({id,instance,locked}:{id:string;instance:BackpackLive;locked:boolean}) {
  const t=useLanguageStore(s=>s.t),held=useStagePlay(s=>s.held),prop=useStagePlay(s=>s.character?.assetId===id?s.character:null);
  const room=useMmdVrStore(s=>s.prefs.scenery);
  const toy=held?.toy??prop?.toy, wrists=instance.wrists;
  const hint=!wrists?.left&&!wrists?.right?t('propNoWrist'):!instance.visible?t('propHidden'):!toy?t('propEquipFirst'):
    `${t(room==='pool'&&toy==='bubbles'?'toyShell':TOYS[toy].label)} · ${prop?`${prop.tilt}° / ${prop.inset} cm`:t('propPickHand')}`;
  return <>
    <HudLine position={[0,.21,0]} text={hint} width={1.23} role="muted"/>
    {(['left','right'] as const).map((hand,i)=><HudButton key={hand} position={[(i-.5)*.63,.05,0]} size={[.59,.15]}
      label={t(hand==='left'?'propLeft':'propRight')} active={prop?.hand===hand} disabled={locked||!toy||!wrists?.[hand]||!instance.visible||prop?.hand===hand}
      onPress={()=>useStagePlay.getState().give(id,hand)}/>)}
    {prop && <>
      {([['propLower',-15,0],['propRaise',15,0],['propCloser',0,-1],['propFarther',0,1]] as const).map(([label,a,d],i)=><HudButton key={label} position={[(i-1.5)*.315,-.15,0]} size={[.30,.14]} label={t(label)}
        disabled={locked||Math.abs(prop.tilt+a)>90||Math.abs(prop.inset+d)>5} onPress={()=>useStagePlay.getState().adjust(a,d)}/>)}
      <HudButton position={[0,-.365,0]} size={[1.23,.14]} label={t('toyStow')} onPress={()=>useStagePlay.getState().stow()} disabled={locked}/>
    </>}
  </>;
}

function MotionPicker({ id, locked }: { id: string; locked: boolean }) {
  const t = useLanguageStore(s => s.t), entries = useBackpack(s => s.entries);
  const list = useMemo(() => entries.filter(e => e.kind === "motion"), [entries]);
  const [index, setIndex] = useState(0), page = Math.min(index, Math.max(0, list.length - 1));
  const entry = list[page];
  const binding = useBackpack(s => s.bindings[id]);
  return entry ? <>
    <HudLine position={[0, 0.18, 0]} text={entry.file.name} width={1.24} />
    <HudLine position={[0, 0.075, 0]} text={fileSource(entry) || t("hudLooseFile")} width={1.24} role="muted" />
    {(["body", "face"] as const).map((kind, i) => <HudButton key={kind} position={[(i - 0.5) * 0.63, -0.1, 0]} size={[0.59, 0.15]}
      label={t(kind === "body" ? "hudApplyBody" : "hudApplyFace")} active={binding?.[kind] === entry.file} disabled={locked}
      onPress={() => useBackpack.getState().applyMotion(id, entry.file, kind)} />)}
    <PageControls page={page} count={list.length} onPage={setIndex} y={-0.34} spread={0.41} />
  </> : <HudLine position={[0, 0, 0]} text={t("hudNoMotion")} width={1.24} center />;
}
