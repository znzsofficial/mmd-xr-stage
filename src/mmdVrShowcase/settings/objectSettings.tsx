import { useState } from 'react';
import { useLanguageStore } from '../../languageStore';
import { HudButton, HudLine } from '../components/PorcelainControls';
import { HudSlider, ValueLabel } from '../components/HudValues';
import { useMmdVrStore } from '../mmdVrStore';
import { normalizeMmdVrExposure } from './preferences';
import { getMmdVrRenderProfile, WALK_SPEED } from '../mmdVrQuality';
import { minSceneViewDistance, mmdVrViewDistanceToSlider, mmdVrSliderToViewDistance } from '../mmdVrAdjustments';
import { hasSceneryPeople } from '../scenery/catalog';
import { lightNames, sceneEffects } from './environmentDisplay';

export const settingsSections = [['player','settingsPlayer'],['character','settingsCharacter'],['environment','settingsEnvironment']] as const;
export type SettingsSection = typeof settingsSections[number][0];
type Drag = { onDrag: (active:boolean)=>void };

export function PlayerSettings() {
  const t=useLanguageStore(s=>s.t), p=useMmdVrStore(s=>s.prefs), set=useMmdVrStore(s=>s.setPrefs);
  const free=p.movementMode==='free',tier=p.walkSpeedPref==='auto'?'normal':p.walkSpeedPref;
  const [handsPanel,showHandsPanel]=useState(false);
  const next={slow:'normal',normal:'fast',fast:'sprint',sprint:'slow'} as const;
  const labels={slow:'moveSlow',normal:'moveCruise',fast:'moveFast',sprint:'moveSprint'} as const;
  if(handsPanel)return <group name="settings:hands-panel">
    <HudLine position={[-.48,.54,0]} width={.89} role="title" text={t('settingsHandsPanel')}/>
    <HudButton position={[.49,.54,0]} size={[.88,.16]} variant="quiet" label={t('settingsBackPlayer')} onPress={()=>showHandsPanel(false)}/>
    <HudButton position={[-.49,.23,0]} size={[.88,.18]} active={p.handTracking} label={t(p.handTracking?'settingsHandModelOn':'settingsHandModelOff')} onPress={()=>set({handTracking:!p.handTracking})}/>
    <HudButton position={[.49,.23,0]} size={[.88,.18]} label={t(p.physicsHapticLevel==='off'?'settingsMmdVrPhysicsHapticsOff':p.physicsHapticLevel==='low'?'settingsMmdVrPhysicsHapticsLow':'settingsMmdVrPhysicsHapticsNormal')} onPress={()=>useMmdVrStore.getState().cyclePhysicsHapticLevel()}/>
    <HudButton position={[-.49,-.02,0]} size={[.88,.18]} active={p.panelFollowUser} label={t(p.panelFollowUser?'settingsFaceMeOn':'settingsFaceMeOff')} onPress={()=>set({panelFollowUser:!p.panelFollowUser})}/>
  </group>;
  return <group name="settings:player">
    <HudLine position={[0,.58,0]} width={1.85} role="title" text={t('hudSelfTitle')}/>
    <HudButton position={[-.49,.38,0]} size={[.88,.17]} active={!free} label={t('moveNormal')} onPress={()=>set({movementMode:'normal'})}/>
    <HudButton position={[.49,.38,0]} size={[.88,.17]} active={free} label={t('moveFree')} onPress={()=>set({movementMode:'free'})}/>
    <HudLine position={[0,.18,0]} width={1.85} role="muted" text={t(free?'moveFlyHint':p.scenery==='glassPlanet'?'planetJumpHint':'moveJumpHint')}/>
    <HudButton position={[-.49,-.06,0]} size={[.88,.17]} label={`${t(labels[tier])} · ${WALK_SPEED[tier]} m/s`} onPress={()=>set({walkSpeedPref:next[tier]})}/>
    <HudButton position={[.49,-.06,0]} size={[.88,.17]} label={`${t('settingsMmdVrSnapTurn')}: ${p.snapTurnDegrees}°`} onPress={()=>set({snapTurnDegrees:p.snapTurnDegrees===15?30:p.snapTurnDegrees===30?45:15})}/>
    {!free&&<><HudLine position={[-.56,-.31,0]} width={.75} text={`${t('settingsEyeOffset')}  ${p.normalEyeOffset>0?'+':''}${Math.round(p.normalEyeOffset*100)} cm`}/>
      <HudButton position={[.02,-.31,0]} size={[.35,.15]} label="−10 cm" disabled={p.normalEyeOffset<=-.8} onPress={()=>set({normalEyeOffset:p.normalEyeOffset-.1})}/>
      <HudButton position={[.40,-.31,0]} size={[.35,.15]} label="+10 cm" disabled={p.normalEyeOffset>=.8} onPress={()=>set({normalEyeOffset:p.normalEyeOffset+.1})}/>
      <HudButton position={[.76,-.31,0]} size={[.31,.15]} variant="quiet" label={t('settingsMmdVrValueReset')} disabled={p.normalEyeOffset===0} onPress={()=>set({normalEyeOffset:0})}/></>}
    <HudButton position={[-.49,-.61,0]} size={[.88,.17]} variant="quiet" label={t('settingsHandsPanel')} onPress={()=>showHandsPanel(true)}/>
    <HudButton position={[.49,-.61,0]} size={[.88,.17]} variant="quiet" label={t('settingsMmdVrResetView')} onPress={()=>useMmdVrStore.getState().resetView()}/>
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

export function EnvironmentSettings({onDrag,diagnostics}:Drag&{diagnostics:()=>void}) {
  const t=useLanguageStore(s=>s.t),p=useMmdVrStore(s=>s.prefs),set=useMmdVrStore(s=>s.setPrefs),profile=getMmdVrRenderProfile(p);
  const [details,showDetails]=useState(false),min=minSceneViewDistance(p.scenery),distance=Math.max(min,p.viewDistance);
  if(details)return <group name="settings:visual-details">
    <HudLine position={[-.48,.54,0]} width={.89} role="title" text={t('settingsVisualDetails')}/>
    <HudButton position={[.49,.54,0]} size={[.88,.16]} variant="quiet" label={t('settingsBackEnvironment')} onPress={()=>showDetails(false)}/>
    {sceneEffects(p,profile).map(({label,active,change},i)=><HudButton key={label} position={[i%2 ? .49 : -.49,.24-Math.floor(i/2)*.24,0]} size={[.88,.17]}
      label={`${t(label)} · ${t(active?'diagOn':'diagOff')}`} active={active} onPress={()=>set(change)}/>)}
    <ValueLabel position={[-.65,-.57,0]} label={t('settingsMmdVrViewDistance')} value={`${distance} m`}/>
    <HudSlider position={[.07,-.57,0]} width={.72} value={mmdVrViewDistanceToSlider(p.viewDistance,min)} onInteractionChange={onDrag} onChange={v=>set({viewDistance:mmdVrSliderToViewDistance(v,min)})}/>
    <HudButton position={[.73,-.57,0]} size={[.4,.15]} variant="quiet" label={t('settingsMmdVrValueReset')} disabled={distance===Math.max(min,40)} onPress={()=>set({viewDistance:40})}/>
  </group>;
  return <group name="settings:environment">
    <HudLine position={[0,.55,0]} width={1.85} role="title" text={t('hudGraphicsTitle')}/>
    <HudButton position={[-.49,.28,0]} size={[.88,.18]} label={`${t('settingsLighting')} · ${t(lightNames[p.lightPreset])}`} onPress={()=>useMmdVrStore.getState().cycleLightPreset()}/>
    <HudButton position={[.49,.28,0]} size={[.88,.18]} label={`${t('settingsMmdVrShadows')} · ${t(profile.shadows?'diagOn':'diagOff')}`} active={profile.shadows} onPress={()=>set({shadowsPref:profile.shadows?'off':'on'})}/>
    <ValueLabel position={[-.65,0,0]} label={t('settingsMmdVrExposure')} value={p.exposure.toFixed(1)}/>
    <HudSlider position={[.07,0,0]} width={.72} value={(p.exposure-.7)/.6} onInteractionChange={onDrag} onChange={v=>set({exposure:normalizeMmdVrExposure(.7+.6*v)})}/>
    <HudButton position={[.73,0,0]} size={[.4,.15]} variant="quiet" label={t('settingsMmdVrValueReset')} disabled={p.exposure===1} onPress={()=>set({exposure:1})}/>
    {hasSceneryPeople(p.scenery)&&<HudButton position={[-.49,-.27,0]} size={[.88,.17]} active={p.showSceneryPeople} label={t(p.showSceneryPeople?'sceneryPeopleOn':'sceneryPeopleOff')} onPress={()=>set({showSceneryPeople:!p.showSceneryPeople})}/>}
    <HudButton position={[-.49,-.61,0]} size={[.88,.17]} variant="quiet" label={t('settingsVisualDetails')} onPress={()=>showDetails(true)}/>
    <HudButton position={[.49,-.61,0]} size={[.88,.17]} variant="quiet" label={t('hudDiagnostics')} onPress={diagnostics}/>
  </group>;
}
