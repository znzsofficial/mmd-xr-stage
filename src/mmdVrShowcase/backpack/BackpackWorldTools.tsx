import { useFrame } from "@react-three/fiber";
import { useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import * as THREE from "three";
import { useLanguageStore } from "../../languageStore";
import { useBackpack, type BackpackEntry, type BackpackLive } from "./store";
import { formatMmdVrModelScale, nextMmdVrModelScale, previousMmdVrModelScale } from "../settings/mmdVrAdjustments";
import { useMmdVrStore } from "../mmdVrStore";
import { PageControls } from "./BackpackPanels";
import { isWebgpuStageSession } from './sessionAssets';
import { HudButton, HudLine, HudSheet } from "../hud/PorcelainControls";
import { useHudWorldInput } from "../hud/hudWorldInput";
import { isStoryRoom, STORIES, toyLabel } from '../play/propCatalog';
import { canGiveTo, useStagePlay } from '../play/stagePlay';
import {EggControls,WandControls} from '../hud/ContactPropControls';
import {useBodyState} from '../bodyState/store';
import {actorActions,ActorActivities,type ActivityEntry} from '../interaction/ActorActivities';
import {PoseHudControls} from '../pose/PoseHudControls';
import {bindRemoteEgg,useRemoteEgg} from '../play/remoteEgg';
import type {RoomActorStyles} from '../mmdRuntime/roomActorBackend';

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

export function BackpackWorldTools({styles}:{styles?:RoomActorStyles} = {}) {
  const id = useBackpack(s => s.selected), draft = useBackpack(s => s.draft);
  const entry = useBackpack(s => s.entries.find(e => e.id === id));
  const instance = useBackpack(s => id ? s.live[id] : null);
  const blocked = useHudWorldInput(s => s.blocked);
  const preview = useBodyState(s=>!!id&&s.draft?.assetId===id);
  const recovery = useMmdVrStore(s => s.assetLoad.running || s.physicsFatal);
  if (!entry || !instance || draft || (blocked&&!preview) || recovery) return null;
  return <SelectedTools key={`${entry.id}:${instance.runtimeId}`} entry={entry} instance={instance} blocked={blocked} preview={preview} styles={styles}/>;
}

function SelectedTools({ entry, instance, blocked, preview, styles }: { entry: BackpackEntry; instance: BackpackLive; blocked:boolean; preview:boolean; styles?:RoomActorStyles }) {
  const t = useLanguageStore(s => s.t);
  const transform = useMmdVrStore(s => (entry.kind === "model" ? s.models : s.objects).find(e => e.id === instance.runtimeId));
  const busy = useBackpack(s => s.busy), physicsBusy = useMmdVrStore(s => s.physicsBusy);
  const [page, setPage] = useState<'tools'|'arrange'|'motions'|'prop'|'wand'|'pose'|ActivityEntry>(entry.kind==='model'?'tools':'arrange');
  const [peek,setPeek]=useState(false);
  useLayoutEffect(()=>{if(blocked&&page==='body'&&preview)setPeek(true);else if(!preview)setPeek(false);},[blocked,page,preview]);
  const held=useStagePlay(s=>s.held?.toy),holding=!!held;
  const wearer=useRemoteEgg(s=>s.assetId);
  const carries = useStagePlay(s=>s.character?.assetId===entry.id);
  const characterToy=useStagePlay(s=>s.character?.toy),room=useMmdVrStore(s=>s.prefs.scenery);
  const eggPage=page==='prop'&&held==='remoteEgg',wandOut=held==='wand'||characterToy==='wand';
  const cues=page==='prop'&&carries&&isStoryRoom(room)&&characterToy===STORIES[room].toy;
  const group = useRef<THREE.Group>(null), last = useRef<BackpackLive["position"] | null>(null);
  useFrame(({ camera, gl }) => {
    const pos = instance.bounds?.center ?? instance.position;
    if (!group.current || (last.current && last.current.every((n, i) => n === pos[i]))) return;
    positionWorldTools(gl.xr.isPresenting ? gl.xr.getCamera() : camera, group.current, pos); last.current = [...pos];
  });
  const locked = busy || physicsBusy, actorLocked = locked || !instance.visible;
  const scale = transform?.scale ?? 1, rotation = transform?.rotationY ?? 0;
  if(blocked && !(page==='body'&&preview))return null;
  if(page==='pose'||page==='wardrobe'||page==='insert'||page==='milk'||page==='body'||page==='observe'){
    return <group ref={group} name="backpack-world-tools" scale={.86} pointerEventsOrder={1} pointerEventsType={{deny:['touch','grab']}}>
      {page==='pose'?<PoseHudControls assetId={entry.id} runtimeId={instance.runtimeId} onBack={()=>setPage('tools')}/>:
        <ActorActivities hud webgpu={isWebgpuStageSession()} entry={page} assetId={entry.id} runtimeId={instance.runtimeId} onBack={()=>setPage('tools')} suspended={blocked||peek} onPeek={()=>setPeek(true)}/>}
      {preview&&peek&&!blocked&&<HudButton position={[0,-.32,0]} size={[.78,.15]} variant="primary" label={t('bodyResume')} onPress={()=>setPeek(false)}/>}</group>;
  }
  const tallDetail=cues||eggPage||page==='wand'||page==='motions';
  const propRow = holding || carries || wandOut;
  const styleRow = page === 'tools' && entry.kind === 'model' && styles;
  const toolsHeight = (propRow ? 1.2 : .98) + (styleRow ? .32 : 0);
  return <group ref={group} name="backpack-world-tools" scale={0.86} pointerEventsOrder={1} pointerEventsType={{ deny: ["touch", "grab"] }}>
    <group position-y={page==='tools' ? .48-toolsHeight/2 : tallDetail ? -.10 : 0}><HudSheet size={[1.34, page==='tools' ? toolsHeight : tallDetail ? 1.20 : 1.0]} /></group>
    <HudLine position={[-0.16, 0.37, 0]} text={entry.file.name} width={0.93} role="title" />
    <HudButton position={[0.47, 0.37, 0]} label={t(page !== 'tools' && entry.kind==='model' ? "hudTools" : "hudDone")} size={[0.31, 0.13]} variant="quiet" onPress={() => {
      if (page !== 'tools' && entry.kind==='model') setPage('tools'); else useBackpack.getState().select(null);
    }} disabled={busy} />
    {page==='wand'?<WandControls live={instance} locked={locked||!instance.visible}/>:eggPage?<EggControls id={entry.id} locked={locked||!instance.visible}/>:page==='motions' ? <MotionPicker id={entry.id} locked={locked} /> : page==='prop' ? <CharacterPropTools id={entry.id} instance={instance} locked={locked}/> : page==='tools'?<>
      {actorActions.map(([id,key],i)=><HudButton key={id} position={[(i-.5)*.63,.115,0]} size={[.60,.16]} label={t(key)} variant={i===0?'primary':'button'} disabled={actorLocked} onPress={()=>setPage(id)}/>)}
      {([['wardrobe','actorWardrobe'],['pose','actorPose'],['observe','actorObservation']] as const).map(([id,key],i)=><HudButton key={id} position={[(i-1)*.418,-.105,0]} size={[.39,.16]} label={t(key)} disabled={actorLocked} onPress={()=>setPage(id)}/>)}
      {([['body','actorBodyState'],['motions','hudChangeMotion'],['arrange','watchArrange']] as const).map(([id,key],i)=><HudButton key={id} position={[(i-1)*.418,-.325,0]} size={[.39,.15]} variant="quiet" label={t(key)} disabled={id==='body'?actorLocked:locked} onPress={()=>setPage(id)}/>)}
      {(holding||carries)&&<HudButton position={[wandOut ? -.315 : 0,-.55,0]} size={[wandOut ? .59 : 1.22,.14]} label={t(held==='remoteEgg'?(wearer===entry.id?'eggControls':wearer?'eggTransfer':'eggWear'):carries?'propGrip':'propGive')} disabled={locked||(!instance.visible&&held==='remoteEgg')} onPress={()=>{if(held==='remoteEgg'&&wearer!==entry.id)bindRemoteEgg(entry.id);setPage('prop');}}/>}
      {wandOut&&<HudButton position={[(holding||carries) ? .315 : 0,-.55,0]} size={[(holding||carries) ? .59 : 1.22,.14]} label={t('wandResponse')} disabled={locked||!instance.visible} onPress={()=>setPage('wand')}/>}
      {styleRow&&<ActorStyleChoice styles={styleRow} file={entry.file} id={instance.runtimeId} y={propRow ? -.85 : -.635} locked={locked||!instance.visible}/>}
    </>:<>
      <HudLine position={[0, 0.225, 0]} width={1.24} role="muted" text={busy ? t("hudWorking") : `${t(instance.visible ? "hudOnStage" : "hudOnStageHidden")} · ${Math.round(rotation)}° · ${formatMmdVrModelScale(scale)}`} />
      <HudButton position={[-0.315, 0.06, 0]} label={t("hudMove")} size={[0.59, 0.15]} disabled={locked} onPress={() => useBackpack.getState().beginPlace(entry.id)} />
      <HudButton position={[.315,.06,0]} label={t('watchDetails')} size={[.59,.15]} disabled={locked} onPress={()=>useHudWorldInput.setState({inspect:instance.runtimeId})}/>
      <HudButton position={[-0.465, -0.145, 0]} label={t("hudTurnLeft")} size={[0.3, 0.14]} disabled={locked || !transform} onPress={() => useMmdVrStore.getState().requestModelRotation(instance.runtimeId, rotation - 15)} />
      <HudButton position={[-0.15, -0.145, 0]} label={t("hudTurnRight")} size={[0.3, 0.14]} disabled={locked || !transform} onPress={() => useMmdVrStore.getState().requestModelRotation(instance.runtimeId, rotation + 15)} />
      <HudButton position={[0.165, -0.145, 0]} label={t("hudSmaller")} size={[0.29, 0.14]} disabled={locked || !transform || previousMmdVrModelScale(scale) === scale} onPress={() => useMmdVrStore.getState().requestModelScale(instance.runtimeId, previousMmdVrModelScale(scale))} />
      <HudButton position={[0.475, -0.145, 0]} label={t("hudLarger")} size={[0.28, 0.14]} disabled={locked || !transform || nextMmdVrModelScale(scale) === scale} onPress={() => useMmdVrStore.getState().requestModelScale(instance.runtimeId, nextMmdVrModelScale(scale))} />
      <HudButton position={[0,-.365,0]} label={t('hudPutAway')} size={[1.24,.14]} disabled={locked} onPress={()=>useBackpack.getState().putAway(entry.id)} />
    </>}
    {cues&&isStoryRoom(room)&&(['left','right'] as const).map((side,i)=><HudButton key={side} position={[(i-.5)*.63,-.555,0]} size={[.59,.14]} disabled={locked||!instance.visible} label={t(STORIES[room][side])} onPress={()=>STORIES[room].cue(side)}/>)}
  </group>;
}

function ActorStyleChoice({styles,file,id,y,locked}:{styles:RoomActorStyles;file:File;id:string;y:number;locked:boolean}) {
  const t=useLanguageStore(s=>s.t);
  const state=useSyncExternalStore(styles.subscribe,()=>styles.read(id,file));
  const phase=state?.phase;
  const hint=phase==='unavailable'?'actorStyleNoMaps':phase==='failed'?'actorStyleFailed':phase==='loading'?'actorStyleLoading':null;
  return <group name="actor-style-choice" position-y={y}>
    <HudLine position={[0,.15,0]} width={1.22} role="muted" text={hint?`${t('actorStyle')} · ${t(hint)}`:t('actorStyle')}/>
    {(['mmd','endfield'] as const).map((mode,i)=><HudButton key={mode} position={[(i-.5)*.63,0,0]} size={[.59,.15]} variant="tab"
      label={t(mode==='mmd'?'actorStyleMmd':'actorStyleEndfield')} active={mode===state?.mode}
      disabled={locked||!state||(mode==='endfield'&&(phase==='unavailable'||phase==='failed'))}
      onPress={()=>styles.choose(id,file,mode==='endfield')}/>)}
  </group>;
}

function CharacterPropTools({id,instance,locked}:{id:string;instance:BackpackLive;locked:boolean}) {
  const t=useLanguageStore(s=>s.t),held=useStagePlay(s=>s.held),prop=useStagePlay(s=>s.character?.assetId===id?s.character:null);
  const room=useMmdVrStore(s=>s.prefs.scenery);
  const toy=held?.toy??prop?.toy, wrists=instance.wrists;
  const hint=!wrists?.left&&!wrists?.right?t('propNoWrist'):!instance.visible?t('propHidden'):!toy?t('propEquipFirst'):
    `${t(toyLabel(toy,room))} · ${prop?`${prop.tilt}° / ${prop.inset} cm`:t('propPickHand')}`;
  return <>
    <HudLine position={[0,.21,0]} text={hint} width={1.23} role="muted"/>
    {(['left','right'] as const).map((hand,i)=><HudButton key={hand} position={[(i-.5)*.63,.05,0]} size={[.59,.15]}
      label={t(hand==='left'?'propLeft':'propRight')} active={prop?.hand===hand} disabled={locked||!toy||!canGiveTo(instance,hand)||prop?.hand===hand}
      onPress={()=>useStagePlay.getState().give(id,hand)}/>)}
    {prop && <>
      {([['propLower',-15,0],['propRaise',15,0],['propCloser',0,-1],['propFarther',0,1]] as const).map(([label,a,d],i)=><HudButton key={label} position={[(i-1.5)*.315,-.15,0]} size={[.30,.14]} label={t(label)}
        disabled={locked||Math.abs(prop.tilt+a)>90||Math.abs(prop.inset+d)>5} onPress={()=>useStagePlay.getState().adjust(a,d)}/>)}
      <HudButton position={[-.315,-.365,0]} size={[.59,.14]} label={`${t('propTurn')} ${prop.turn}°`} onPress={()=>useStagePlay.getState().adjust(0,0,30)} disabled={locked}/>
      <HudButton position={[.315,-.365,0]} size={[.59,.14]} label={t('toyStow')} onPress={()=>useStagePlay.getState().stow()} disabled={locked}/>
    </>}
  </>;
}

function MotionPicker({ id, locked }: { id: string; locked: boolean }) {
  const t = useLanguageStore(s => s.t), entries = useBackpack(s => s.entries);
  const list = useMemo(() => entries.filter(e => e.kind === "motion"), [entries]);
  const [index, setIndex] = useState(0), page = Math.min(index, Math.max(0, list.length - 1));
  const entry = list[page];
  const binding = useBackpack(s => s.bindings[id]);
  return <>
    {(['body','face'] as const).map((kind,i)=>{
      const bound=binding?.[kind], name=list.find(e=>e.file===bound)?.path ?? bound?.name ?? t('hudMotionUnbound');
      return <group key={kind} position-y={.16-i*.175}>
        <HudLine position={[-.23,0,0]} width={.79} text={`${t(kind==='body'?'hudBodyMotion':'hudFaceMotion')} · ${name}`} />
        <HudButton position={[.405,0,0]} size={[.43,.14]} variant="quiet" label={t(kind==='body'?'hudClearBodyMotion':'hudClearFaceMotion')} disabled={locked||!bound}
          onPress={()=>useBackpack.getState().applyMotion(id,null,kind)} />
      </group>;
    })}
    {entry ? <>
    <HudLine position={[0, -.205, 0]} text={entry.path} width={1.24} />
    {(["body", "face"] as const).map((kind, i) => <HudButton key={kind} position={[(i - 0.5) * 0.63, -.365, 0]} size={[0.59, 0.15]}
      label={t(kind === "body" ? "hudApplyBody" : "hudApplyFace")} active={binding?.[kind] === entry.file} disabled={locked}
      onPress={() => useBackpack.getState().applyMotion(id, entry.file, kind)} />)}
    <PageControls page={page} count={list.length} onPage={setIndex} y={-.565} spread={0.41} />
    </> : <HudLine position={[0, -.27, 0]} text={t('hudNoMotion')} width={1.24} center />}
  </>;
}
