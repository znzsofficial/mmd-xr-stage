import {useLanguageStore} from '../../languageStore';
import {useMmdVrStore} from '../mmdVrStore';
import {getMmdVrRenderProfile,formatMmdVrProfileSummary} from '../mmdVrQuality';
import {questPresets,currentQuestPreset} from '../settings/questPresets';
import {PrepIcon} from './PrepIcon';
function OptionGroup<T extends string>({
  value,
  options,
  onChange,
}: {
  value: T | undefined;
  options: readonly { id: T; label: string }[];
  onChange: (value: T) => void;
}) {
  return (
    <div className="stage-seg-control">
      {options.map((option) => (
        <button
          key={option.id}
          type="button"
          className={value === option.id ? "is-active" : ""}
          aria-pressed={value === option.id}
          onClick={() => onChange(option.id)}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

export function DeviceSettings(){
  const t=useLanguageStore(s=>s.t),language=useLanguageStore(s=>s.language),prefs=useMmdVrStore(s=>s.prefs),setPrefs=useMmdVrStore(s=>s.setPrefs);
  const questPreset=currentQuestPreset(prefs);
  const highLoadConfig=prefs.frameRatePref==='120'||(prefs.advancedRenderOverrides&&prefs.framebufferScalePref==='1'&&prefs.foveationPref==='off');
  return (
           <details className="stage-config-card">
            <summary className="stage-config-summary">
              <div className="stage-config-summary-left">
                <div className="stage-config-icon">
                   <PrepIcon name="tune" size={20} />
                </div>
                <div>
                   <span className="stage-section-title">{t("mmdVrPrepRuntimeConfig")}</span>
                  <span className="stage-config-preview">{formatMmdVrProfileSummary(getMmdVrRenderProfile(prefs), language)}</span>
                </div>
              </div>
               <PrepIcon name="down" className="stage-arrow-icon" />
            </summary>

            <div className="stage-config-body">
               <p className="stage-config-notice">{t("settingsRequestHint")}</p>

              <div className="stage-form-row">
                <span className="stage-row-label">{t("settingsMmdVrQuestPreset")}{questPreset==='custom'?` · ${t("settingsMmdVrPresetCustom")}`:''}</span>
                <OptionGroup
                  value={questPreset==='custom'?undefined:questPreset}
                  options={[
                    { id: "safe", label: t("settingsMmdVrPresetSafe") },
                    { id: "balanced", label: t("settingsMmdVrPresetBalanced") },
                    { id: "clarity", label: t("settingsMmdVrPresetClarity") },
                  ]}
                  onChange={preset=>setPrefs(questPresets[preset])}
                />
              </div>

              <details className="stage-sub-details">
                <summary className="stage-sub-summary">
                   <PrepIcon name="tune" size={16} />
                  <span>{t("settingsMmdVrAdvancedConfig")}</span>
                   <PrepIcon name="down" size={14} className="stage-sub-arrow" />
                </summary>
                <div className="stage-sub-content">
                  <div className="stage-form-row">
                    <span className="stage-row-label">{t("settingsVrDesktopQuality")}</span>
                    <OptionGroup
                      value={prefs.renderQuality}
                      options={[
                        { id: "high", label: t("settingsVrDesktopQualityHigh") },
                        { id: "balanced", label: t("settingsVrDesktopQualityBalanced") },
                        { id: "low", label: t("settingsVrDesktopQualityLow") },
                      ]}
                      onChange={(renderQuality) => setPrefs({ renderQuality })}
                    />
                  </div>

                  <div className="stage-form-row">
                    <span className="stage-row-label">{t("settingsVrDesktopDpr")}</span>
                    <OptionGroup
                      value={prefs.dprPref}
                      options={[
                        { id: "auto", label: t("settingsVrDesktopQualityAuto") },
                        { id: "1", label: "1×" },
                        { id: "1.25", label: "1.25×" },
                        { id: "1.5", label: "1.5×" },
                      ]}
                      onChange={(dprPref) => setPrefs({ dprPref })}
                    />
                  </div>

                  <div className="stage-form-row">
                    <span className="stage-row-label">{t("settingsVrDesktopFrameRate")}</span>
                    <OptionGroup
                      value={prefs.frameRatePref}
                      options={[
                        { id: "auto", label: t("settingsVrDesktopQualityAuto") },
                        { id: "72", label: "72 Hz" },
                        { id: "80", label: "80 Hz" },
                        { id: "90", label: "90 Hz" },
                        { id: "120", label: "120 Hz" },
                      ]}
                      onChange={(frameRatePref) => setPrefs({ frameRatePref })}
                    />
                  </div>

                  <details className="stage-exp-box">
                    <summary className="stage-exp-summary">
                       <PrepIcon name="tune" size={15} />
                      <span>{t("settingsMmdVrExperimentalRendering")}</span>
                    </summary>
                    <div className="stage-exp-body">
                      <label className="stage-toggle-row">
                        <span>{t("settingsMmdVrEnableRenderOverrides")}</span>
                        <input
                          type="checkbox"
                          checked={prefs.advancedRenderOverrides}
                          onChange={(e) => setPrefs({ advancedRenderOverrides: e.target.checked })}
                        />
                      </label>
                      {prefs.advancedRenderOverrides&&<><div className="stage-form-row">
                        <span className="stage-row-label">{t("settingsVrDesktopFramebufferScale")}</span>
                        <OptionGroup
                          value={prefs.framebufferScalePref}
                          options={[
                            { id: "auto", label: t("settingsVrDesktopQualityAuto") },
                            { id: "0.7", label: "70%" },
                            { id: "0.85", label: "85%" },
                            { id: "1", label: "100%" },
                          ]}
                           onChange={(framebufferScalePref) => setPrefs({ framebufferScalePref })}
                        />
                      </div>
                      <div className="stage-form-row">
                        <span className="stage-row-label">{t("settingsVrDesktopFoveation")}</span>
                        <OptionGroup
                          value={prefs.foveationPref}
                          options={[
                            { id: "auto", label: t("settingsVrDesktopQualityAuto") },
                             { id: "high", label: t("settingsMmdVrFoveationPerformance") },
                            { id: "medium", label: t("settingsMmdVrFoveationBalanced") },
                            { id: "off", label: t("settingsMmdVrFoveationOff") },
                          ]}
                          onChange={(foveationPref) => setPrefs({ foveationPref })}
                        />
                      </div></>}
                    </div>
                  </details>

                  <div className="stage-form-row">
                    <span className="stage-row-label">{t("settingsVrDesktopAntialias")}</span>
                    <OptionGroup
                      value={prefs.antialiasPref}
                      options={[
                        { id: "auto", label: t("settingsVrDesktopQualityAuto") },
                        { id: "on", label: t("settingsVrDesktopAaOn") },
                        { id: "off", label: t("settingsVrDesktopAaOff") },
                      ]}
                      onChange={(antialiasPref) => setPrefs({ antialiasPref })}
                    />
                  </div>

                  <div className="stage-form-row">
                    <span className="stage-row-label">{t("settingsMmdVrShadows")}</span>
                    <OptionGroup
                      value={prefs.shadowsPref}
                      options={[
                        { id: "auto", label: t("settingsVrDesktopQualityAuto") },
                        { id: "on", label: t("settingsVrDesktopAaOn") },
                        { id: "off", label: t("settingsVrDesktopAaOff") },
                      ]}
                      onChange={(shadowsPref) => setPrefs({ shadowsPref })}
                    />
                  </div>

                  <div className="stage-form-row">
                    <span className="stage-row-label">{t("settingsMmdVrShadowResolution")}</span>
                    <OptionGroup
                      value={prefs.shadowResolutionPref}
                      options={[
                        { id: "auto", label: t("settingsVrDesktopQualityAuto") },
                        { id: "low", label: "512" },
                        { id: "medium", label: "1024" },
                        { id: "high", label: "2048" },
                      ]}
                      onChange={(shadowResolutionPref) => setPrefs({ shadowResolutionPref })}
                    />
                  </div>

                  <div className="stage-form-row">
                    <span className="stage-row-label">{t("settingsMmdVrGrid")}</span>
                    <OptionGroup
                      value={prefs.gridPref}
                      options={[
                        { id: "auto", label: t("settingsVrDesktopQualityAuto") },
                        { id: "on", label: t("settingsVrDesktopAaOn") },
                        { id: "off", label: t("settingsVrDesktopAaOff") },
                      ]}
                      onChange={(gridPref) => setPrefs({ gridPref })}
                    />
                  </div>

                  <label className="stage-toggle-row">
                     <span>{t("settingsPanelFps")}</span>
                    <input
                      type="checkbox"
                      checked={prefs.showFps}
                      onChange={(e) => setPrefs({ showFps: e.target.checked })}
                    />
                  </label>

                  <label className="stage-toggle-row">
                    <span>{t("settingsMmdVrDetailedPhysicsDiagnostics")}</span>
                    <input
                      type="checkbox"
                      checked={prefs.detailedPhysicsDiagnostics}
                      onChange={(e) => setPrefs({ detailedPhysicsDiagnostics: e.target.checked })}
                    />
                  </label>

                  {highLoadConfig && (
                    <div className="stage-alert stage-alert-warning">
                       <PrepIcon name="alert" size={16} />
                      <span>{t("settingsMmdVrHighLoadWarning")}</span>
                    </div>
                  )}
                  <p className="stage-hint-text">{t("settingsVrDesktopQualityHint")}</p>
                </div>
               </details>
               <details className="stage-sub-details"><summary className="stage-sub-summary"><span>{t('watchExperiments')}</span><PrepIcon name="down" size={14} className="stage-sub-arrow"/></summary>
                 <div className="stage-sub-content"><label className="stage-toggle-row"><span>{t('actorPalmCloth')}</span>
                    <input type="checkbox" checked={prefs.actorPalmCloth} onChange={e=>setPrefs({actorPalmCloth:e.target.checked})}/></label>
                    <p>{t('settingsContactLab')}</p>
                    <label className="stage-field">{t('settingsMmdVrPhysicsRadius')}<select className="stage-select" value={prefs.physicsColliderRadius} onChange={e=>setPrefs({physicsColliderRadius:Number(e.target.value)})}>{[.04,.08,.12,.16].map(r=><option key={r} value={r}>{r*100} cm</option>)}</select></label>
                    <div className="stage-form-row" role="group" aria-label={t('settingsMmdVrPhysicsColliderFriction')}><span className="stage-row-label">{t('settingsMmdVrPhysicsColliderFriction')}</span><OptionGroup value={prefs.physicsColliderFriction} options={[{id:'low',label:t('settingsMmdVrPhysicsColliderFrictionLow')},{id:'medium',label:t('settingsMmdVrPhysicsColliderFrictionMedium')},{id:'high',label:t('settingsMmdVrPhysicsColliderFrictionHigh')}]} onChange={physicsColliderFriction=>setPrefs({physicsColliderFriction})}/></div>
                    <div className="stage-form-row" role="group" aria-label={t('settingsMmdVrPhysicsColliderRestitution')}><span className="stage-row-label">{t('settingsMmdVrPhysicsColliderRestitution')}</span><OptionGroup value={prefs.physicsColliderRestitution} options={[{id:'none',label:t('settingsMmdVrPhysicsColliderRestitutionNone')},{id:'low',label:t('settingsMmdVrPhysicsColliderRestitutionLow')},{id:'high',label:t('settingsMmdVrPhysicsColliderRestitutionHigh')}]} onChange={physicsColliderRestitution=>setPrefs({physicsColliderRestitution})}/></div>
                  </div>
               </details>
             </div>
           </details>
  );
}
