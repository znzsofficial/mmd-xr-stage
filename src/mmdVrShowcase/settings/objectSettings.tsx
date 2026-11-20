import { useState } from 'react';
import { useLanguageStore } from '../../languageStore';
import { HudButton, HudLine } from '../components/PorcelainControls';
import { HudSlider, ValueLabel } from '../components/HudValues';
import { useMmdVrStore } from '../mmdVrStore';
import { normalizeMmdVrExposure } from './preferences';
import { getMmdVrRenderProfile, WALK_SPEED } from '../mmdVrQuality';
import { mmdVrViewDistanceToSlider, mmdVrSliderToViewDistance } from '../mmdVrAdjustments';
import { hasSceneryPeople, showSceneryGrid } from '../scenery/catalog';
import {hasStageLamps} from './stageLamps';

export const settingsSections = [['player','settingsPlayer'],['character','settingsCharacter'],['environment','settingsEnvironment']] as const;
export type SettingsSection = typeof settingsSections[number][0];
type Drag = { onDrag: (active:boolean)=>void };

export function PlayerSettings() {
  const t=useLanguageStore(s=>s.t), p=useMmdVrStore(s=>s.prefs), set=useMmdVrStore(s=>s.setPrefs);
  const free=p.movementMode==='free',tier=p.walkSpeedPref==='auto'?'normal':p.walkSpeedPref;
  const next={slow:'normal',normal:'fast',fast:'sprint',sprint:'slow'} as const;
  const labels={slow:'moveSlow',normal:'moveCruise',fast:'moveFast',sprint:'moveSprint'} as const;
  return <group name="settings:player">
    <HudLine position={[0,.48,0]} width={1.85} role="title" text={t('hudSelfTitle')}/>
    <HudButton position={[-.49,.23,0]} size={[.88,.17]} active={!free} label={t('moveNormal')} onPress={()=>set({movementMode:'normal'})}/>
    <HudButton position={[.49,.23,0]} size={[.88,.17]} active={free} label={t('moveFree')} onPress={()=>set({movementMode:'free'})}/>
    <HudLine position={[0,-.01,0]} width={1.85} role="muted" text={t(free?'moveFlyHint':'moveJumpHint')}/>
    <HudButton position={[-.49,-.28,0]} size={[.88,.16]} label={`${t(labels[tier])} · ${WALK_SPEED[tier]} m/s`} onPress={()=>set({walkSpeedPref:next[tier]})}/>
    <HudButton position={[.49,-.28,0]} size={[.88,.16]} label={`${t('settingsMmdVrSnapTurn')}: ${p.snapTurnDegrees}°`} onPress={()=>set({snapTurnDegrees:p.snapTurnDegrees===15?30:p.snapTurnDegrees===30?45:15})}/>
    <HudButton position={[-.49,-.50,0]} size={[.88,.15]} active={p.handTracking} label={t(p.handTracking?'settingsHandModelOn':'settingsHandModelOff')} onPress={()=>set({handTracking:!p.handTracking})}/>
    <HudButton position={[.49,-.50,0]} size={[.88,.15]} active={p.panelFollowUser} label={t(p.panelFollowUser?'settingsFaceMeOn':'settingsFaceMeOff')} onPress={()=>set({panelFollowUser:!p.panelFollowUser})}/>
    <HudButton position={[-.49,-.72,0]} size={[.88,.15]} label={t(p.physicsHapticLevel==='off'?'settingsMmdVrPhysicsHapticsOff':p.physicsHapticLevel==='low'?'settingsMmdVrPhysicsHapticsLow':'settingsMmdVrPhysicsHapticsNormal')} onPress={()=>useMmdVrStore.getState().cyclePhysicsHapticLevel()}/>
    <HudButton position={[.49,-.72,0]} size={[.88,.15]} variant="quiet" label={t('settingsMmdVrResetView')} onPress={()=>useMmdVrStore.getState().resetView()}/>
  </group>;
}

export function CharacterSettings({locked}:{locked:boolean}) {
  const t=useLanguageStore(s=>s.t), physics=useMmdVrStore(s=>s.physicsEnabled), count=useMmdVrStore(s=>s.modelCount);
  const p=useMmdVrStore(s=>s.prefs),set=useMmdVrStore(s=>s.setPrefs),[tuning,showTuning]=useState(false);
  const physicsSwitch=(y:number)=><HudButton position={[-.49,y,0]} size={[.88,.18]} label={t(physics?'settingsMmdVrPhysicsOn':'settingsMmdVrPhysicsOff')} disabled={locked||!count} active={physics} onPress={()=>useMmdVrStore.getState().setPhysicsEnabled(!physics)}/>;
  if(tuning)return <group name="settings:contact-detail">
    <HudLine position={[0,.54,0]} width={1.85} role="title" text={t('playerTouch')}/>
    <HudButton position={[-.49,.32,0]} size={[.88,.16]} disabled={locked||physics} label={`${t('settingsMmdVrPhysicsRadius')}: ${Math.round(p.physicsColliderRadius*100)} cm`} onPress={()=>useMmdVrStore.getState().cyclePhysicsColliderRadius()}/>
    <HudButton position={[.49,.32,0]} size={[.88,.16]} disabled={locked||physics} label={t(p.physicsColliderFriction==='low'?'touchFrictionLow':p.physicsColliderFriction==='high'?'touchFrictionHigh':'contactNormalFriction')} onPress={()=>useMmdVrStore.getState().cyclePhysicsColliderFriction()}/>
    <HudButton position={[-.49,.11,0]} size={[.88,.16]} disabled={locked||physics} label={t(p.physicsColliderRestitution==='none'?'touchBounceNone':p.physicsColliderRestitution==='low'?'touchBounceLow':'touchBounceHigh')} onPress={()=>useMmdVrStore.getState().cyclePhysicsColliderRestitution()}/>
    <HudLine position={[0,-.11,0]} width={1.85} role="title" text={t('missingPalmContact')}/>
    <HudButton position={[0,-.31,0]} size={[1.85,.16]} disabled={locked||physics} active={p.actorPalmCloth} label={t(p.actorPalmCloth?'actorPalmOn':'actorPalmOff')} onPress={()=>set({actorPalmCloth:!p.actorPalmCloth})}/>
    <HudLine position={[0,-.53,0]} width={1.85} role="muted" text={t(physics?'contactDisableFirst':'contactNextPhysics')}/>
    {physicsSwitch(-.73)}
    <HudButton position={[.49,-.73,0]} size={[.88,.18]} variant="quiet" label={t('hudDone')} onPress={()=>showTuning(false)}/>
  </group>;
  return <group name="settings:character">
    <HudLine position={[0,.54,0]} width={1.85} role="title" text={t('characterPhysics')}/>
    {physicsSwitch(.32)}
    <HudButton position={[.49,.32,0]} size={[.88,.18]} label={t('settingsMmdVrPhysicsReset')} disabled={locked||!physics||!count} variant="quiet" onPress={()=>useMmdVrStore.getState().requestPhysicsReset()}/>
    <HudButton position={[-.49,.09,0]} size={[.88,.18]} label={t('contactDetails')} variant="quiet" onPress={()=>showTuning(true)}/>
    <HudButton position={[.49,.09,0]} size={[.88,.18]} active={p.balancedModelColor} label={t(p.balancedModelColor?'modelColorBalanced':'modelColorBright')} onPress={()=>set({balancedModelColor:!p.balancedModelColor})}/>
    <HudLine position={[0,-.10,0]} width={1.85} text={t(count?'touchWithPhysics':'settingsPlaceFirst')} role="muted"/>
    <HudLine position={[0,-.30,0]} width={1.85} role="title" text={t('actorTouch')}/>
    <HudButton position={[0,-.50,0]} size={[1.85,.18]} label={t(p.chestCompression?'chestPressureOn':'chestPressureOff')} active={p.chestCompression} disabled={locked} onPress={()=>set({chestCompression:!p.chestCompression})}/>
    <HudLine position={[0,-.70,0]} width={1.85} role="muted" text={t('chestNoPhysics')}/>
  </group>;
}

const lightNames={stage:'settingsMmdVrLightStage',soft:'settingsMmdVrLightSoft',contrast:'settingsMmdVrLightContrast',daylight:'settingsMmdVrLightDaylight',warm:'settingsMmdVrLightWarm',rim:'settingsMmdVrLightRim'} as const;
export function EnvironmentSettings({onDrag,diagnostics}:Drag&{diagnostics:()=>void}) {
  const t=useLanguageStore(s=>s.t),p=useMmdVrStore(s=>s.prefs),set=useMmdVrStore(s=>s.setPrefs),profile=getMmdVrRenderProfile(p);
  const grid=showSceneryGrid(p.scenery,profile.showGrid,p.gridPref==='on');
  return <group name="settings:environment">
    <HudLine position={[0,.55,0]} width={1.85} role="title" text={t('hudGraphicsTitle')}/>
    <HudButton position={[-.63,.30,0]} size={[.58,.16]} label={t('settingsMmdVrShadows')} active={profile.shadows} onPress={()=>set({shadowsPref:profile.shadows?'off':'on'})}/>
    <HudButton position={[0,.30,0]} size={[.58,.16]} label={t('settingsMmdVrGrid')} active={grid} onPress={()=>set({gridPref:grid?'off':'on'})}/>
    <HudButton position={[.63,.30,0]} size={[.58,.16]} label={t('hudSoftHighlights')} active={p.softHighlights} onPress={()=>set({softHighlights:!p.softHighlights})}/>
    <HudButton position={[-.63,.08,0]} size={[.58,.15]} label={t(lightNames[p.lightPreset])} onPress={()=>useMmdVrStore.getState().cycleLightPreset()}/>
    <HudButton position={[0,.08,0]} size={[.58,.15]} label={t(p.stageSkyEnabled?'settingsMmdVrSkyOn':'settingsMmdVrSkyOff')} active={p.stageSkyEnabled} onPress={()=>set({stageSkyEnabled:!p.stageSkyEnabled})}/>
    <HudButton position={[.63,.08,0]} size={[.58,.15]} label={t(p.stageFogEnabled?'settingsMmdVrFogOn':'settingsMmdVrFogOff')} active={p.stageFogEnabled} onPress={()=>set({stageFogEnabled:!p.stageFogEnabled})}/>
    {hasStageLamps(p.scenery)&&<><HudButton position={[-.49,-.13,0]} size={[.88,.14]} label={t(p.stageRimLightEnabled?'settingsMmdVrRimLightOn':'settingsMmdVrRimLightOff')} active={p.stageRimLightEnabled} onPress={()=>set({stageRimLightEnabled:!p.stageRimLightEnabled})}/>
      <HudButton position={[.49,-.13,0]} size={[.88,.14]} label={t(p.stageLightPoolEnabled?'settingsMmdVrLightPoolOn':'settingsMmdVrLightPoolOff')} active={p.stageLightPoolEnabled} onPress={()=>set({stageLightPoolEnabled:!p.stageLightPoolEnabled})}/></>}
    <ValueLabel position={[-.65,-.34,0]} label={t('settingsMmdVrExposure')} value={p.exposure.toFixed(1)}/>
    <HudSlider position={[.07,-.34,0]} width={.72} value={(p.exposure-.7)/.6} onInteractionChange={onDrag} onChange={v=>set({exposure:normalizeMmdVrExposure(.7+.6*v)})}/>
    <HudButton position={[.73,-.34,0]} size={[.4,.14]} label={t('settingsMmdVrValueReset')} onPress={()=>set({exposure:1})}/>
    <ValueLabel position={[-.65,-.54,0]} label={t('settingsMmdVrViewDistance')} value={`${p.viewDistance} m`}/>
    <HudSlider position={[.07,-.54,0]} width={.72} value={mmdVrViewDistanceToSlider(p.viewDistance)} onInteractionChange={onDrag} onChange={v=>set({viewDistance:mmdVrSliderToViewDistance(v)})}/>
    <HudButton position={[.73,-.54,0]} size={[.4,.14]} label={t('settingsMmdVrValueReset')} onPress={()=>set({viewDistance:40})}/>
    {hasSceneryPeople(p.scenery)&&<HudButton position={[-.49,-.75,0]} size={[.88,.16]} active={p.showSceneryPeople} label={t(p.showSceneryPeople?'sceneryPeopleOn':'sceneryPeopleOff')} onPress={()=>set({showSceneryPeople:!p.showSceneryPeople})}/>}
    <HudButton position={[hasSceneryPeople(p.scenery)?.49:0,-.75,0]} size={[.88,.16]} variant="quiet" label={t('hudDiagnostics')} onPress={diagnostics}/>
  </group>;
}
