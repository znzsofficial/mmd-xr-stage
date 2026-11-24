import { useLanguageStore } from '../../languageStore';
import { minSceneViewDistance, MMD_VR_VIEW_DISTANCE_MAX } from '../settings/mmdVrAdjustments';
import { getMmdVrRenderProfile } from '../settings/mmdVrQuality';
import { useMmdVrStore } from '../mmdVrStore';
import { hasSceneryPeople } from '../scenery/catalog';
import { lightNames, sceneEffects } from '../settings/environmentDisplay';
import { LIGHT_ORDER } from '../settings/preferences';

export function ScreenEnvironmentSettings() {
  const t=useLanguageStore(s=>s.t),p=useMmdVrStore(s=>s.prefs),set=useMmdVrStore(s=>s.setPrefs);
  const profile=getMmdVrRenderProfile(p),min=minSceneViewDistance(p.scenery),distance=Math.max(min,p.viewDistance);
  return <details className="screen-stage-options screen-environment"><summary>{t('settingsEnvironment')}</summary>
    <label className="screen-env-field">{t('settingsLighting')}
      <select value={p.lightPreset} onChange={e=>{const light=LIGHT_ORDER.find(key=>key===e.target.value);if(light)set({lightPreset:light});}}>
        {LIGHT_ORDER.map(key=><option key={key} value={key}>{t(lightNames[key])}</option>)}
      </select></label>
    <label className="screen-env-field">{t('settingsMmdVrExposure')}<span aria-hidden="true">{p.exposure.toFixed(1)}</span>
      <input type="range" min={.7} max={1.3} step={.1} value={p.exposure} onChange={e=>set({exposure:e.target.valueAsNumber})}/></label>
    <label><input type="checkbox" checked={profile.shadows} onChange={e=>set({shadowsPref:e.target.checked?'on':'off'})}/>{t('settingsMmdVrShadows')}</label>
    {hasSceneryPeople(p.scenery)&&<label><input type="checkbox" checked={p.showSceneryPeople} onChange={e=>set({showSceneryPeople:e.target.checked})}/>{t('sceneryPeople')}</label>}
    <label><input type="checkbox" checked={p.balancedModelColor} onChange={e=>set({balancedModelColor:e.target.checked})}/>{t('modelColorBalanced')}</label>
    <details><summary>{t('settingsVisualDetails')}</summary>
      {sceneEffects(p,profile).map(({label,active,change})=><label key={label}><input type="checkbox" checked={active} onChange={()=>set(change)}/>{t(label)}</label>)}
      <label className="screen-env-field">{t('settingsMmdVrViewDistance')}<span aria-hidden="true">{distance} m</span>
        <input type="range" min={min} max={MMD_VR_VIEW_DISTANCE_MAX} value={distance} aria-valuetext={`${distance} m`} onChange={e=>set({viewDistance:e.target.valueAsNumber})}/></label>
    </details>
  </details>;
}
