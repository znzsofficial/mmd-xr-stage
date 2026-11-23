import { createLocalPrefsStorage } from '../../shared/localPrefs';
import {
  normalizeImmersiveAntialias, normalizeImmersiveDpr, normalizeImmersiveFramebufferScale,
  normalizeImmersiveFoveation, normalizeImmersiveQuality, normalizeImmersiveToggle,
  type ImmersiveAntialiasPref, type ImmersiveDprPref, type ImmersiveFramebufferScalePref,
  type ImmersiveFoveationPref, type ImmersiveRenderQuality, type ImmersiveTogglePref,
} from '../../xr/qualityAxes';
import { normalizeMmdVrViewDistance } from '../mmdVrAdjustments';
import type { MmdVrHapticLevel } from '../mmdVrHaptics';
import { resolveScenery, type SceneryId } from '../scenery/catalog';

export type MmdVrRenderQuality = ImmersiveRenderQuality;
export type MmdVrDprPref = ImmersiveDprPref;
export type MmdVrAntialiasPref = ImmersiveAntialiasPref;
export type MmdVrTogglePref = ImmersiveTogglePref;
export type MmdVrFrameRatePref = 'auto' | '72' | '80' | '90' | '120';
export type MmdVrWalkSpeedPref = 'auto' | 'slow' | 'normal' | 'fast' | 'sprint';
export type MovementMode = 'normal' | 'free';
export const LIGHT_ORDER = ['stage', 'contrast', 'soft', 'daylight', 'warm', 'rim'] as const;
export type MmdVrLightPreset = typeof LIGHT_ORDER[number];
export type MmdVrShadowResolutionPref = 'auto' | 'low' | 'medium' | 'high';
export type MmdVrSnapTurnDegrees = 15 | 30 | 45;
export type MmdVrColliderFriction = 'low' | 'medium' | 'high';
export type MmdVrColliderRestitution = 'none' | 'low' | 'high';

export interface MmdVrPrefs {
  renderQuality: MmdVrRenderQuality;
  showFps: boolean;
  loop: boolean;
  dprPref: MmdVrDprPref;
  frameRatePref: MmdVrFrameRatePref;
  antialiasPref: MmdVrAntialiasPref;
  shadowsPref: MmdVrTogglePref;
  gridPref: MmdVrTogglePref;
  walkSpeedPref: MmdVrWalkSpeedPref;
  movementMode: MovementMode;
  planetAutoLanding: boolean;
  /** Calibration above the tracked floor, in metres. Never a motor position. */
  normalEyeOffset: number;
  lightPreset: MmdVrLightPreset;
  framebufferScalePref: ImmersiveFramebufferScalePref;
  foveationPref: ImmersiveFoveationPref;
  shadowResolutionPref: MmdVrShadowResolutionPref;
  viewDistance: number;
  snapTurnDegrees: MmdVrSnapTurnDegrees;
  exposure: number;
  stageSkyEnabled: boolean;
  showSceneryPeople: boolean;
  scenery: SceneryId;
  softHighlights: boolean;
  balancedModelColor: boolean;
  stageFogEnabled: boolean;
  stageRimLightEnabled: boolean;
  stageLightPoolEnabled: boolean;
  /** Visibility of tracked hand meshes, independent of menu rays and contact. */
  handTracking: boolean;
  advancedRenderOverrides: boolean;
  detailedPhysicsDiagnostics: boolean;
  panelFollowUser: boolean;
  physicsColliderRadius: number;
  physicsColliderFriction: MmdVrColliderFriction;
  physicsColliderRestitution: MmdVrColliderRestitution;
  physicsHapticLevel: MmdVrHapticLevel;
  actorPalmCloth: boolean;
  chestCompression: boolean;
}

export const MMD_VR_PREFS_KEY = 'neko-virt-os.mmd-vr-showcase.v2';
export const MMD_VR_PREFS_LEGACY_KEY = 'neko-virt-os.mmd-vr-showcase.v1';

export function normalizeMmdVrFrameRate(value: unknown): MmdVrFrameRatePref {
  if (value === '72' || value === '80' || value === '90' || value === '120') return value;
  if (value === 'low') return '72';
  if (value === 'mid') return '90';
  if (value === 'high') return '120';
  return 'auto';
}

export function normalizeMmdVrSnapTurnDegrees(value: unknown): MmdVrSnapTurnDegrees {
  return value === 15 || value === 45 ? value : 30;
}

export function normalizeMmdVrExposure(value: unknown): number {
  const exposure = typeof value === 'number' && Number.isFinite(value) ? value : 1;
  return Math.round(Math.min(1.3, Math.max(0.7, exposure)) * 10) / 10;
}

// A fresh visit, a persisted record and a typed update all use this schema.
// Enumerate the fields: unknown keys from retired features must not be saved.
export function normalizeMmdVrPrefs(parsed: Partial<MmdVrPrefs> & {liveHouseEnabled?: boolean} = {}): MmdVrPrefs {
  const lightPreset = LIGHT_ORDER.find(p => p === parsed.lightPreset) ?? 'stage';
  const { walkSpeedPref: walk, shadowResolutionPref: shadow, physicsColliderRadius: radius,
    physicsColliderFriction: friction, physicsColliderRestitution: restitution, physicsHapticLevel: haptics } = parsed;
  return {
    renderQuality: normalizeImmersiveQuality(parsed.renderQuality),
    showFps: Boolean(parsed.showFps),
    loop: parsed.loop !== false,
    dprPref: normalizeImmersiveDpr(parsed.dprPref),
    frameRatePref: normalizeMmdVrFrameRate(parsed.frameRatePref),
    antialiasPref: normalizeImmersiveAntialias(parsed.antialiasPref),
    shadowsPref: normalizeImmersiveToggle(parsed.shadowsPref),
    gridPref: normalizeImmersiveToggle(parsed.gridPref),
    walkSpeedPref: walk === 'fast' || walk === 'normal' || walk === 'slow' || walk === 'sprint' ? walk : 'auto',
    movementMode: parsed.movementMode === 'free' ? 'free' : 'normal',
    planetAutoLanding: parsed.planetAutoLanding === true,
    normalEyeOffset: typeof parsed.normalEyeOffset==='number' && Number.isFinite(parsed.normalEyeOffset)
      ? Math.round(Math.max(-.8,Math.min(.8,parsed.normalEyeOffset))*10)/10 : 0,
    lightPreset,
    framebufferScalePref: normalizeImmersiveFramebufferScale(parsed.framebufferScalePref),
    foveationPref: normalizeImmersiveFoveation(parsed.foveationPref),
    shadowResolutionPref: shadow === 'low' || shadow === 'medium' || shadow === 'high' ? shadow : 'auto',
    viewDistance: normalizeMmdVrViewDistance(parsed.viewDistance),
    snapTurnDegrees: normalizeMmdVrSnapTurnDegrees(parsed.snapTurnDegrees),
    exposure: normalizeMmdVrExposure(parsed.exposure),
    stageSkyEnabled: parsed.stageSkyEnabled !== false,
    showSceneryPeople: parsed.showSceneryPeople === true,
    scenery: resolveScenery(parsed.scenery, parsed.liveHouseEnabled),
    softHighlights: parsed.softHighlights === true,
    balancedModelColor: parsed.balancedModelColor !== false,
    stageFogEnabled: parsed.stageFogEnabled !== false,
    // Before these flags existed, a non-stage preset implied both effects.
    stageRimLightEnabled: typeof parsed.stageRimLightEnabled === 'boolean' ? parsed.stageRimLightEnabled : lightPreset !== 'stage',
    stageLightPoolEnabled: typeof parsed.stageLightPoolEnabled === 'boolean' ? parsed.stageLightPoolEnabled : lightPreset !== 'stage',
    handTracking: parsed.handTracking !== false,
    advancedRenderOverrides: Boolean(parsed.advancedRenderOverrides),
    detailedPhysicsDiagnostics: Boolean(parsed.detailedPhysicsDiagnostics),
    panelFollowUser: parsed.panelFollowUser !== false,
    physicsColliderRadius: radius === .04 || radius === .12 || radius === .16 ? radius : .08,
    physicsColliderFriction: friction === 'low' || friction === 'high' ? friction : 'medium',
    physicsColliderRestitution: restitution === 'low' || restitution === 'high' ? restitution : 'none',
    physicsHapticLevel: haptics === 'off' || haptics === 'normal' ? haptics : 'low',
    actorPalmCloth: parsed.actorPalmCloth === true,
    chestCompression: parsed.chestCompression !== false,
  };
}

export const prefsStorage = createLocalPrefsStorage<MmdVrPrefs>({
  key: MMD_VR_PREFS_KEY,
  legacyKey: MMD_VR_PREFS_LEGACY_KEY,
  defaults: normalizeMmdVrPrefs,
  normalize: normalizeMmdVrPrefs,
});
