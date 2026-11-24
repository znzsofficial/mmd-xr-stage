import type { TranslationKey } from '../../languageStore';
import type { MmdVrRenderProfile } from './mmdVrQuality';
import { showSceneryGrid } from '../scenery/catalog';
import type { MmdVrLightPreset, MmdVrPrefs } from './preferences';
import { hasStageLamps } from './stageLamps';

export const lightNames = {
  stage:'settingsMmdVrLightStage', contrast:'settingsMmdVrLightContrast', soft:'settingsMmdVrLightSoft',
  daylight:'settingsMmdVrLightDaylight', warm:'settingsMmdVrLightWarm', rim:'settingsMmdVrLightRim',
} as const satisfies Record<MmdVrLightPreset,TranslationKey>;

type Effect = {label:TranslationKey; active:boolean; change:Partial<MmdVrPrefs>};

/** StageEnvironment mounts a sky in every room and allows a manual grid everywhere. */
export function sceneEffects(p:MmdVrPrefs,profile:MmdVrRenderProfile):Effect[] {
  const grid=showSceneryGrid(p.scenery,profile.showGrid,p.gridPref==='on');
  const effects:Effect[]=[{label:'settingsSky',active:p.stageSkyEnabled,change:{stageSkyEnabled:!p.stageSkyEnabled}}];
  if(p.scenery!=='glassPlanet')effects.push({label:'settingsFog',active:p.stageFogEnabled,change:{stageFogEnabled:!p.stageFogEnabled}});
  effects.push({label:'settingsMmdVrGrid',active:grid,change:{gridPref:grid?'off':'on'}},
    {label:'hudSoftHighlights',active:p.softHighlights,change:{softHighlights:!p.softHighlights}});
  if(hasStageLamps(p.scenery))effects.push(
    {label:'settingsRimLight',active:p.stageRimLightEnabled,change:{stageRimLightEnabled:!p.stageRimLightEnabled}},
    {label:'settingsFloorGlow',active:p.stageLightPoolEnabled,change:{stageLightPoolEnabled:!p.stageLightPoolEnabled}});
  return effects;
}
