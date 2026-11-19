import { useState } from 'react';
import { useLanguageStore } from '../../languageStore';
import { HudButton, HudLine } from '../components/PorcelainControls';
import { HudSlider, ValueLabel } from '../components/HudValues';
import { useMmdVrStore, normalizeMmdVrExposure } from '../mmdVrStore';
import { getMmdVrRenderProfile } from '../mmdVrQuality';
import { mmdVrViewDistanceToSlider, mmdVrSliderToViewDistance, mmdVrHeightOffsetToSlider, mmdVrSliderToHeightOffset } from '../mmdVrAdjustments';
import { showSceneryGrid } from '../scenery/catalog';
import {hasStageLamps} from './stageLamps';

export const settingsSections = [['player','settingsPlayer'],['character','settingsCharacter'],['environment','settingsEnvironment']] as const;
export type SettingsSection = typeof settingsSections[number][0];
type Drag = { onDrag: (active:boolean)=>void };

export function PlayerSettings({onDrag}:Drag) {
  const t=useLanguageStore(s=>s.t), p=useMmdVrStore(s=>s.prefs), set=useMmdVrStore(s=>s.setPrefs);
  const [wide,setWide]=useState(Math.abs(p.heightOffset)>1);
  const [centre,setCentre]=useState(0);
  const speed=getMmdVrRenderProfile(p).walkSpeed;
  return <group name="settings:player">
    <HudLine position={[0,.48,0]} width={1.85} role="title" text={t('hudSelfTitle')}/>
    <ValueLabel position={[-.61,.22,0]} size={[.66,.14]} label={t('settingsEyeOffset')} value={`${p.heightOffset.toFixed(2)} m`}/>
    <HudSlider position={[.03,.22,0]} width={.55} value={wide?mmdVrHeightOffsetToSlider(p.heightOffset):(p.heightOffset-centre+1)/2} onInteractionChange={onDrag} onChange={v=>set({heightOffset:wide?mmdVrSliderToHeightOffset(v):centre+2*v-1})}/>
    <HudButton position={[.56,.22,0]} label="−" size={[.22,.15]} onPress={()=>set({heightOffset:p.heightOffset-.01})}/>
    <HudButton position={[.84,.22,0]} label="+" size={[.22,.15]} onPress={()=>set({heightOffset:p.heightOffset+.01})}/>
    <HudButton position={[-.49,-.01,0]} size={[.88,.15]} variant="quiet" active={wide} label={t(wide?'settingsFineHeight':'settingsWideHeight')} onPress={()=>{if(wide)setCentre(p.heightOffset);setWide(!wide);}}/>
    <HudButton position={[.49,-.01,0]} size={[.88,.15]} variant="quiet" label={t('settingsResetHeight')} onPress={()=>{setCentre(0);set({heightOffset:0});}}/>
    <HudButton position={[-.49,-.28,0]} size={[.88,.16]} label={`${t('settingsMmdVrWalkSpeed')}: ${speed.toFixed(2)} m/s`} onPress={()=>set({walkSpeedPref:p.walkSpeedPref==='slow'?'normal':p.walkSpeedPref==='fast'?'slow':'fast'})}/>
    <HudButton position={[.49,-.28,0]} size={[.88,.16]} label={`${t('settingsMmdVrSnapTurn')}: ${p.snapTurnDegrees}°`} onPress={()=>set({snapTurnDegrees:p.snapTurnDegrees===15?30:p.snapTurnDegrees===30?45:15})}/>
    <HudButton position={[-.49,-.50,0]} size={[.88,.15]} active={p.handTracking} label={t(p.handTracking?'settingsHandModelOn':'settingsHandModelOff')} onPress={()=>set({handTracking:!p.handTracking})}/>
    <HudButton position={[.49,-.50,0]} size={[.88,.15]} active={p.panelFollowUser} label={t(p.panelFollowUser?'settingsFaceMeOn':'settingsFaceMeOff')} onPress={()=>set({panelFollowUser:!p.panelFollowUser})}/>
    <HudButton position={[-.49,-.72,0]} size={[.88,.15]} label={t(p.physicsHapticLevel==='off'?'settingsMmdVrPhysicsHapticsOff':p.physicsHapticLevel==='low'?'settingsMmdVrPhysicsHapticsLow':'settingsMmdVrPhysicsHapticsNormal')} onPress={()=>useMmdVrStore.getState().cyclePhysicsHapticLevel()}/>
    <HudButton position={[.49,-.72,0]} size={[.88,.15]} variant="quiet" label={t('settingsMmdVrResetView')} onPress={()=>useMmdVrStore.getState().resetView()}/>
  </group>;
}

export function CharacterSettings({locked}:{locked:boolean}) {
  const t=useLanguageStore(s=>s.t), physics=useMmdVrStore(s=>s.physicsEnabled), contact=useMmdVrStore(s=>s.physicsControllerCollisions), count=useMmdVrStore(s=>s.modelCount);
  const p=useMmdVrStore(s=>s.prefs),set=useMmdVrStore(s=>s.setPrefs),[tuning,showTuning]=useState(false);
  if(tuning)return <group name="settings:contact-detail">
    <HudLine position={[0,.49,0]} width={1.85} role="title" text={t('contactDetails')}/>
    <HudLine position={[0,.29,0]} width={1.85} role="muted" text={t(physics?'contactDisableFirst':'contactNextPhysics')}/>
    <HudButton position={[-.49,.04,0]} size={[.88,.16]} disabled={locked||physics} label={`${t('settingsMmdVrPhysicsRadius')}: ${Math.round(p.physicsColliderRadius*100)} cm`} onPress={()=>useMmdVrStore.getState().cyclePhysicsColliderRadius()}/>
    <HudButton position={[.49,.04,0]} size={[.88,.16]} disabled={locked||physics} label={t(p.physicsColliderFriction==='low'?'settingsMmdVrPhysicsColliderFrictionLow':p.physicsColliderFriction==='high'?'settingsMmdVrPhysicsColliderFrictionHigh':'contactNormalFriction')} onPress={()=>useMmdVrStore.getState().cyclePhysicsColliderFriction()}/>
    <HudButton position={[-.49,-.18,0]} size={[.88,.16]} disabled={locked||physics} label={t(p.physicsColliderRestitution==='none'?'settingsMmdVrPhysicsColliderRestitutionNone':p.physicsColliderRestitution==='low'?'settingsMmdVrPhysicsColliderRestitutionLow':'settingsMmdVrPhysicsColliderRestitutionHigh')} onPress={()=>useMmdVrStore.getState().cyclePhysicsColliderRestitution()}/>
    <HudButton position={[.49,-.18,0]} size={[.88,.16]} disabled={locked||physics} active={p.actorPalmCloth} label={t('actorPalmShort')} onPress={()=>set({actorPalmCloth:!p.actorPalmCloth})}/>
    <HudButton position={[-.49,-.48,0]} size={[.88,.15]} variant="quiet" label={t('hudDone')} onPress={()=>showTuning(false)}/>
  </group>;
  return <group name="settings:character">
    <HudLine position={[0,.54,0]} width={1.85} role="title" text={t('dancePose')}/>
    <HudButton position={[0,.31,0]} size={[1.85,.18]} label={t(p.chestCompression?'chestPressureOn':'chestPressureOff')} active={p.chestCompression} disabled={locked} onPress={()=>set({chestCompression:!p.chestCompression})}/>
    <group position-y={-.18}>
    <HudButton position={[-.49,.18,0]} size={[.88,.18]} label={t(physics?'settingsMmdVrPhysicsOn':'settingsMmdVrPhysicsOff')} disabled={locked||!count} active={physics} onPress={()=>useMmdVrStore.getState().setPhysicsEnabled(!physics)}/>
    <HudButton position={[.49,.18,0]} size={[.88,.18]} label={t(contact?'settingsMmdVrPhysicsCollisionOn':'settingsMmdVrPhysicsCollisionOff')} disabled={locked||!physics||!count} active={contact&&physics} onPress={()=>useMmdVrStore.getState().setPhysicsControllerCollisions(!contact)}/>
    <HudLine position={[0,-.09,0]} width={1.85} text={t(count?'settingsCharacterHint':'settingsPlaceFirst')} role="muted"/>
    <HudButton position={[-.49,-.44,0]} size={[.88,.15]} label={t('settingsMmdVrPhysicsReset')} disabled={locked||!physics||!count} variant="quiet" onPress={()=>useMmdVrStore.getState().requestPhysicsReset()}/>
    <HudButton position={[.49,-.44,0]} size={[.88,.15]} label={t('contactDetails')} variant="quiet" onPress={()=>showTuning(true)}/></group>
  </group>;
}

const lightNames={stage:'settingsMmdVrLightStage',soft:'settingsMmdVrLightSoft',contrast:'settingsMmdVrLightContrast',daylight:'settingsMmdVrLightDaylight',warm:'settingsMmdVrLightWarm',rim:'settingsMmdVrLightRim'} as const;
export function EnvironmentSettings({onDrag,diagnostics}:Drag&{diagnostics:()=>void}) {
  const t=useLanguageStore(s=>s.t),p=useMmdVrStore(s=>s.prefs),set=useMmdVrStore(s=>s.setPrefs),profile=getMmdVrRenderProfile(p);
  const grid=showSceneryGrid(p.scenery,profile.showGrid,p.gridPref==='on',false);
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
    <HudButton position={[0,-.75,0]} size={[.88,.14]} variant="quiet" label={t('hudDiagnostics')} onPress={diagnostics}/>
  </group>;
}
