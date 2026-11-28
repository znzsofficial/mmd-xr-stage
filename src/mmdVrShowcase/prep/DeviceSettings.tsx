import {useId} from 'react';
import {useLanguageStore} from '../../languageStore';
import {useMmdVrStore} from '../mmdVrStore';
import {getMmdVrRenderProfile} from '../settings/mmdVrQuality';
import {currentQuestPreset,questPresets} from '../settings/questPresets';
import {PrepIcon} from './PrepIcon';

const presets = [
  ['safe','prepQualitySmooth','prepQualitySmoothHint'],
  ['balanced','settingsMmdVrPresetBalanced','prepQualityBalancedHint'],
  ['clarity','settingsMmdVrPresetClarity','prepQualityClarityHint'],
] as const;

function Setting<T extends string>({label,value,options,onChange,disabled}: {
  label:string; value:T; options:readonly (readonly [T,string])[];
  onChange:(value:T)=>void; disabled?:boolean;
}) {
  return <label className="stage-quality-setting">
    <span>{label}</span>
    <select className="stage-select" value={value} disabled={disabled} onChange={event=>{
      const option=options.find(([id])=>id===event.target.value);
      if(option) onChange(option[0]);
    }}>
      {options.map(([id,name])=><option key={id} value={id}>{name}</option>)}
    </select>
  </label>;
}

export function DeviceSettings({disabled=false}:{disabled?:boolean}) {
  const t=useLanguageStore(s=>s.t),prefs=useMmdVrStore(s=>s.prefs),setPrefs=useMmdVrStore(s=>s.setPrefs);
  const title=useId(),selected=currentQuestPreset(prefs),profile=getMmdVrRenderProfile(prefs);
  const follow=t('settingsVrDesktopQualityAuto'),device=t('prepQualityDeviceDefault');
  const loadWarning=prefs.frameRatePref==='120'||(prefs.advancedRenderOverrides&&prefs.framebufferScalePref==='1'&&prefs.foveationPref==='off');
  return <section className="stage-quality" aria-labelledby={title}>
    <header className="stage-quality-heading">
      <h2 id={title} className="stage-section-title">{t('prepQualityTitle')}</h2>
      {selected==='custom'&&<span className="stage-quality-custom">{t('settingsMmdVrPresetCustom')}</span>}
    </header>
    <fieldset className="stage-quality-fields" disabled={disabled}>
      <div className="stage-quality-presets" role="group" aria-label={t('settingsMmdVrQuestPreset')}>
        {presets.map(([id,name,hint])=>{
          const preset=questPresets[id];
          return <button key={id} type="button" aria-pressed={selected===id} onClick={()=>setPrefs(preset)}>
            <span className="stage-quality-name">{t(name)}</span>
            <span className="stage-quality-values">{preset.frameRatePref} Hz · {Math.round(Number(preset.framebufferScalePref)*100)}%</span>
            <span className="stage-quality-hint">{t(hint)}</span>
          </button>;
        })}
      </div>
      <Setting label={t('prepQualityRefresh')} value={prefs.frameRatePref}
        options={[["auto",device],["72","72 Hz"],["80","80 Hz"],["90","90 Hz"],["120","120 Hz"]]}
        onChange={frameRatePref=>setPrefs({frameRatePref})}/>
      <p className="stage-quality-note" aria-live="polite">{prefs.advancedRenderOverrides
        ? `${t('prepQualityResolution')} ${Math.round(profile.framebufferScale*100)}% · ${t('settingsVrDesktopFoveation')} ${t(profile.foveation===0?'settingsMmdVrFoveationOff':profile.foveation===1?'settingsMmdVrFoveationPerformance':profile.foveation===.5?'settingsMmdVrFoveationBalanced':'prepQualityPeripheralLight')}`
        : t('prepQualityAutomaticImage')}</p>
      <p className="stage-quality-note">{t('prepQualityRequestHint')}</p>
      {loadWarning&&<p className="stage-quality-warning">{t('settingsMmdVrHighLoadWarning')}</p>}
      <details className="stage-quality-details">
        <summary>{t('prepQualityFineTune')}<PrepIcon name="down" size={15}/></summary>
        <div className="stage-quality-options">
          <label className="stage-quality-check">
            <span>{t('prepQualityOverride')}</span>
            <input type="checkbox" checked={prefs.advancedRenderOverrides}
              onChange={event=>setPrefs({advancedRenderOverrides:event.target.checked})}/>
          </label>
          <Setting label={t('prepQualityResolution')} value={prefs.framebufferScalePref} disabled={!prefs.advancedRenderOverrides}
            options={[["auto",follow],["0.7","70%"],["0.85","85%"],["1","100%"]]}
            onChange={framebufferScalePref=>setPrefs({framebufferScalePref})}/>
          <Setting label={t('settingsVrDesktopFoveation')} value={prefs.foveationPref} disabled={!prefs.advancedRenderOverrides}
            options={[["auto",follow],["high",t('settingsMmdVrFoveationPerformance')],["medium",t('settingsMmdVrFoveationBalanced')],["off",t('settingsMmdVrFoveationOff')]]}
            onChange={foveationPref=>setPrefs({foveationPref})}/>
          <p className="stage-quality-note">{t('prepQualityPeripheralHint')}</p>
          <Setting label={t('prepQualityBase')} value={prefs.renderQuality}
            options={[["low",t('settingsVrDesktopQualityLow')],["balanced",t('settingsVrDesktopQualityBalanced')],["high",t('settingsVrDesktopQualityHigh')]]}
            onChange={renderQuality=>setPrefs({renderQuality})}/>
          <Setting label={t('prepQualityPixelRatio')} value={prefs.dprPref}
            options={[["auto",follow],["1","1×"],["1.25","1.25×"],["1.5","1.5×"]]}
            onChange={dprPref=>setPrefs({dprPref})}/>
          <Setting label={t('settingsVrDesktopAntialias')} value={prefs.antialiasPref}
            options={[["auto",follow],["on",t('settingsVrDesktopAaOn')],["off",t('settingsVrDesktopAaOff')]]}
            onChange={antialiasPref=>setPrefs({antialiasPref})}/>
          <Setting label={t('settingsMmdVrShadowResolution')} value={prefs.shadowResolutionPref}
            options={[["auto",follow],["low","512"],["medium","1024"],["high","2048"]]}
            onChange={shadowResolutionPref=>setPrefs({shadowResolutionPref})}/>
        </div>
      </details>
    </fieldset>
  </section>;
}
