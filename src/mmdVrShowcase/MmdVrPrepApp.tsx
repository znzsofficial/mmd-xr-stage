import { PrepIcon } from "./prep/PrepIcon";
import classroomWindow from "./prep/classroom-window.webp";
import { useEffect, useMemo, useRef, useState, type ChangeEvent, type DragEvent } from "react";
import { useLanguageStore, type TranslationKey } from "../languageStore";
import { collectFilesFromDataTransfer, relativePath } from "../mmdImport/folderFiles";
import { useNotificationStore } from "../notificationStore";
import { getXrSystem } from "../xr";
import { MmdVrOverlay } from "./MmdVrOverlay";
import { clearBackpack, syncBackpackFiles, useBackpack } from "./backpack";
import { formatMmdVrProfileSummary, getMmdVrRenderProfile } from "./mmdVrQuality";
import { requestMmdVrEnter } from "./requestMmdVrEnter";
import { useMmdVrStore } from "./mmdVrStore";
import { SCENERY, sceneryIds, resolveScenery } from "./scenery/catalog";
import { ACCENT_CHROMA, ACCENT_COLORS, ACCENT_HUES, updateThemeSettings } from "../system/theme";
import { useThemeSettings } from "../system/useThemeSettings";
import { expandAssetFiles, AssetImportError, IMPORT_LIMITS, type ArchiveEncoding, type ImportProgress } from "../mmdImport/importArchive";
import { bindCompanion, mergeAssetFiles } from "../mmdImport/assetPaths";
import { inspectAssets, type ImportReport } from "../mmdImport/inspectAssets";
import { downloadPerformanceReport, useLastPerformanceReport } from "./performanceReport";

function OptionGroup<T extends string>({
  value,
  options,
  onChange,
}: {
  value: T;
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

type QuestPreset = "safe" | "balanced" | "clarity" | "custom";
type XrReadiness = "checking" | "ready" | "unverified" | "insecure" | "no-xr";

const ISSUE_LABEL = { missing: "importMissing", ambiguous: "importAmbiguous", invalid: "importInvalid", fallback: "importFallback" } as const;
const CATALOG_GROUPS = [
  { kind: "model", label: "mmdVrPrepModels" },
  { kind: "object", label: "mmdVrPrepObjects" },
  { kind: "motion", label: "mmdVrPrepMotions" },
] as const;

function getQuestPreset(prefs: ReturnType<typeof useMmdVrStore.getState>["prefs"]): QuestPreset {
  if (!prefs.advancedRenderOverrides) return "custom";
  if (prefs.dprPref !== "auto" || prefs.antialiasPref !== "auto") return "custom";
  if (prefs.renderQuality === "low" && prefs.frameRatePref === "72" && prefs.framebufferScalePref === "0.7" && prefs.foveationPref === "high" && prefs.shadowsPref === "off") return "safe";
  if (prefs.renderQuality === "balanced" && prefs.frameRatePref === "90" && prefs.framebufferScalePref === "0.85" && prefs.foveationPref === "medium" && prefs.shadowsPref === "off") return "balanced";
  if (prefs.renderQuality === "high" && prefs.frameRatePref === "90" && prefs.framebufferScalePref === "1" && prefs.foveationPref === "medium" && prefs.shadowsPref === "off") return "clarity";
  return "custom";
}

export function MmdVrPrepApp() {
  const t = useLanguageStore((state) => state.t);
  const language = useLanguageStore((state) => state.language);
  const themeSettings = useThemeSettings();
  const addNotification = useNotificationStore((state) => state.addNotification);
  const phase = useMmdVrStore((state) => state.phase);
  const assetLoad = useMmdVrStore((state) => state.assetLoad);
  const savedStage = useMmdVrStore((state) => state.savedStage);
  const files = useBackpack((state) => state.files);
  const entries = useBackpack((state) => state.entries);
  const layouts = useBackpack((state) => state.layouts);
  const bindings = useBackpack((state) => state.bindings);
  const errorMessage = useMmdVrStore((state) => state.errorMessage);
  const performanceReport = useLastPerformanceReport((state) => state.report);
  const prefs = useMmdVrStore((state) => state.prefs);
  const setPrefs = useMmdVrStore((state) => state.setPrefs);

  const folderInputRef = useRef<HTMLInputElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const repairInputRef = useRef<HTMLInputElement | null>(null);
  const repairTargetRef = useRef<{ file: File; reference: string } | null>(null);
  const importAbortRef = useRef<AbortController | null>(null);
  const importGenerationRef = useRef(0);

  const [importing, setImporting] = useState(false);
  const [importProgress, setImportProgress] = useState<ImportProgress | null>(null);
  const [importError, setImportError] = useState<{ key: TranslationKey; detail: string } | null>(null);
  const [conflicts, setConflicts] = useState<string[]>([]);
  const [encoding, setEncoding] = useState<ArchiveEncoding>("auto");
  const [report, setReport] = useState<ImportReport | null>(null);
  const [checkingAssets, setCheckingAssets] = useState(files.length > 0);
  const [readiness, setReadiness] = useState<XrReadiness>("checking");
  const [dragging, setDragging] = useState(false);

  const questPreset = getQuestPreset(prefs);
  const highLoadConfig = prefs.frameRatePref === "120"
    || (prefs.advancedRenderOverrides && prefs.framebufferScalePref === "1" && prefs.foveationPref === "off");

  function applyQuestPreset(preset: Exclude<QuestPreset, "custom">) {
    if (preset === "safe") {
      setPrefs({ renderQuality: "low", dprPref: "auto", frameRatePref: "72", antialiasPref: "auto", framebufferScalePref: "0.7", foveationPref: "high", shadowsPref: "off", advancedRenderOverrides: true });
      return;
    }
    if (preset === "balanced") {
      setPrefs({ renderQuality: "balanced", dprPref: "auto", frameRatePref: "90", antialiasPref: "auto", framebufferScalePref: "0.85", foveationPref: "medium", shadowsPref: "off", advancedRenderOverrides: true });
      return;
    }
    setPrefs({ renderQuality: "high", dprPref: "auto", frameRatePref: "90", antialiasPref: "auto", framebufferScalePref: "1", foveationPref: "medium", shadowsPref: "off", advancedRenderOverrides: true });
  }

  const catalog = useMemo(() => CATALOG_GROUPS.map(({ kind, label }) => ({
    label, items: entries.filter(entry => entry.kind === kind),
  })), [entries]);

  const inUse = useMemo(() => {
    const referenced = new Set<File>();
    for (const layout of [savedStage, ...Object.values(layouts)]) {
      for (const slot of layout?.assets ?? []) {
        if (slot.kind === "object") referenced.add(slot.objectFile);
        else {
          referenced.add(slot.modelFile);
          if (slot.bodyMotionFile) referenced.add(slot.bodyMotionFile);
          if (slot.faceMotionFile) referenced.add(slot.faceMotionFile);
        }
      }
    }
    for (const motion of Object.values(bindings)) {
      if (motion.body) referenced.add(motion.body);
      if (motion.face) referenced.add(motion.face);
    }
    return referenced;
  }, [savedStage, layouts, bindings]);

  useEffect(() => {
    const input = folderInputRef.current;
    if (!input) return;
    input.setAttribute("webkitdirectory", "");
    input.setAttribute("directory", "");
  }, []);

  useEffect(() => {
    if (!window.isSecureContext) {
      setReadiness("insecure");
      return;
    }
    const xr = getXrSystem();
    if (!xr) {
      setReadiness("no-xr");
      return;
    }
    let cancelled = false;
    xr.isSessionSupported("immersive-vr")
      .then((supported) => {
        if (!cancelled) setReadiness(supported ? "ready" : "unverified");
      })
      .catch(() => {
        if (!cancelled) setReadiness("unverified");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Keep original File identities for relative paths and explicit repair bindings.
  function publishFiles(next: File[]) {
    setReport(null);
    setCheckingAssets(next.length > 0);
    syncBackpackFiles(next);
  }

  function ingest(nextFiles: File[]) {
    const merged = mergeAssetFiles(useBackpack.getState().files, nextFiles);
    if (merged.files.length > IMPORT_LIMITS.entries || merged.files.reduce((sum, file) => sum + file.size, 0) > IMPORT_LIMITS.totalBytes) {
      throw new AssetImportError("limit", nextFiles[0]?.name ?? "");
    }
    if (merged.accepted.length) publishFiles(merged.files);
    setConflicts(merged.conflicts);
  }

  function removeImportedFile(target: File) {
    publishFiles(useBackpack.getState().files.filter((file) => file !== target));
  }

  function onFilesChange(event: ChangeEvent<HTMLInputElement>) {
    void importFiles(Promise.resolve(Array.from(event.target.files ?? [])));
    event.target.value = "";
  }

  async function onDrop(event: DragEvent<HTMLElement>) {
    event.preventDefault();
    setDragging(false);
    await importFiles(collectFilesFromDataTransfer(event.dataTransfer));
  }

  async function importFiles(pending: Promise<File[]>) {
    importAbortRef.current?.abort();
    const abort = new AbortController();
    importAbortRef.current = abort;
    const generation = ++importGenerationRef.current;
    setImporting(true);
    setImportProgress(null);
    setImportError(null);
    try {
      const incoming = await pending;
      abort.signal.throwIfAborted();
      const expanded = await expandAssetFiles(incoming, {
        signal: abort.signal,
        encoding,
        onProgress: (progress) => {
          if (generation === importGenerationRef.current) setImportProgress(progress);
        },
      });
      abort.signal.throwIfAborted();
      if (generation === importGenerationRef.current) ingest(expanded);
    } catch (error) {
      if (abort.signal.aborted || generation !== importGenerationRef.current) return;
      const keys = { path: "importBadPath", limit: "importTooLarge", encrypted: "importEncrypted", archive: "importFailed" } as const;
      setImportError({
        key: error instanceof AssetImportError ? keys[error.code] : "importFailed",
        detail: error instanceof AssetImportError ? `${error.file}: ${error.message}` : String(error),
      });
    } finally {
      if (generation === importGenerationRef.current) {
        setImporting(false);
        setImportProgress(null);
      }
    }
  }

  useEffect(() => () => {
    importAbortRef.current?.abort();
    importGenerationRef.current += 1;
  }, []);

  useEffect(() => {
    const abort = new AbortController();
    if (files.length) {
      void inspectAssets(files, abort.signal)
        .then((report) => {
          if (!abort.signal.aborted && files === useBackpack.getState().files) {
            setReport(report);
            setCheckingAssets(false);
          }
        })
        .catch((error) => {
          if (!abort.signal.aborted && files === useBackpack.getState().files) {
            setImportError({ key: "importFailed", detail: String(error) });
            setCheckingAssets(false);
          }
        });
    }
    return () => abort.abort();
  }, [files]);

  useEffect(() => {
    if (!report || files !== useBackpack.getState().files) return;
    // Keep backpack warnings short; the full per-reference list and repair UI live here.
    const warnings = new Map<string, string>();
    for (const issue of report.issues) {
      if (!warnings.has(issue.file)) warnings.set(issue.file, `${t(ISSUE_LABEL[issue.kind])}: ${issue.reference}`);
    }
    syncBackpackFiles(files, warnings);
  }, [files, report, t]);

  function clearImports() {
    importAbortRef.current?.abort();
    importGenerationRef.current += 1;
    clearBackpack();
    repairTargetRef.current = null;
    setCheckingAssets(false);
    setReport(null);
    setConflicts([]);
    setImportError(null);
    setImportProgress(null);
    setImporting(false);
    useMmdVrStore.setState({ savedStage: null, resumeStage: null });
  }

  function repairResource(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    const target = repairTargetRef.current;
    event.target.value = "";
    repairTargetRef.current = null;
    const current = useBackpack.getState().files;
    if (!file || !target || !current.includes(target.file)) return;
    if (
      file.size > IMPORT_LIMITS.fileBytes ||
      current.length >= IMPORT_LIMITS.entries ||
      current.reduce((n, f) => n + f.size, 0) + file.size > IMPORT_LIMITS.totalBytes
    ) {
      setImportError({ key: "importTooLarge", detail: file.name });
      return;
    }
    bindCompanion(target.file, target.reference, file);
    publishFiles([...current, file]);
  }

  function enterVr(resume = false) {
    void requestMmdVrEnter({ t, addNotification, assets: [], resume });
  }

  const entryDisabled = importing || checkingAssets || readiness === "insecure" || readiness === "no-xr" || phase === "entering" || phase === "active";
  const readinessClass =
    readiness === "insecure" || readiness === "no-xr"
      ? "is-error"
      : readiness === "unverified" || readiness === "checking"
        ? "is-pending"
        : "is-ready";

  const readinessMessage =
    readiness === "insecure"
      ? t("mmdVrPrepInsecureContext")
      : readiness === "no-xr"
        ? t("mmdVrPrepXrMissing")
        : readiness === "ready"
          ? t("mmdVrPrepReady")
          : t("mmdVrPrepReadyPending");

  return (
    <><div className="stage-app">
      <header className="stage-header">
        <div className="stage-brand">
          <div className="stage-brand-badge" aria-hidden="true">
            <PrepIcon name="studio" size={24} />
          </div>
          <div className="stage-brand-text">
            <span className="stage-brand-title">MMD XR Stage</span>
            <span className="stage-brand-sub">{t("mmdVrPrepSystem")}</span>
          </div>
        </div>

        <div className="stage-header-actions">
          <div className={`stage-env-badge ${readinessClass}`} title={readinessMessage}>
            <span className={`stage-env-dot ${phase === "entering" ? "is-busy" : ""}`} />
            <span className="stage-env-label">
              {phase === "entering" ? t("mmdVrPrepEntering") : readinessMessage}
            </span>
          </div>

          {(files.length > 0 || savedStage) && (
            <button
              type="button"
              className="stage-btn stage-btn-ghost stage-btn-sm"
              disabled={phase === "entering" || phase === "active"}
              onClick={clearImports}
            >
               <PrepIcon name="trash" size={15} />
              <span>{t("importClear")}</span>
            </button>
          )}
        </div>
      </header>

      <main className="stage-main">
        <div className="stage-intro">
          <div>
            <h1 className="stage-intro-title">{t("mmdVrPrepTitle")}</h1>
            <p className="stage-intro-lead">{t("mmdVrPrepLead")}</p>
          </div>
          <div className="stage-launch-actions">
            <div className="stage-launch-row">
              {savedStage && <button type="button" className="stage-btn stage-btn-secondary stage-btn-lg" disabled={entryDisabled} onClick={() => enterVr(true)}>
                <PrepIcon name="play" /><span>{t("stageContinue")}</span>
              </button>}
              <button type="button" className="stage-btn stage-btn-primary stage-btn-lg" disabled={entryDisabled} onClick={() => enterVr(false)}>
                <PrepIcon name="headset" size={21} /><span>{phase === "entering" ? t("settingsMmdVrEntering") : t("stageRestart")}</span><PrepIcon name="arrow" size={17} />
              </button>
            </div>
            {savedStage && <p className="stage-launch-note">{t("stageResumeHint")} ({Math.floor(savedStage.time / 60)}:{String(Math.floor(savedStage.time % 60)).padStart(2, "0")})</p>}
          </div>
        </div>

        <div className="stage-window">
          <img src={classroomWindow} width="1080" height="720" alt={t("prepWindowAlt")} fetchPriority="high" />
          <button type="button" className="stage-window-pick" aria-pressed={prefs.scenery === "classroom"} disabled={phase === "entering" || phase === "active"}
            onClick={() => setPrefs({ scenery: "classroom" })}>
            <PrepIcon name={prefs.scenery === "classroom" ? "check" : "window"} /><span>{t(prefs.scenery === "classroom" ? "prepWindowPicked" : "prepWindowPick")}</span>
          </button>
        </div>

        <div className="stage-workspace"><div className="stage-library">

          <section
            className={`stage-drop-zone ${dragging ? "is-dragging" : ""}`}
            onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
            onDragLeave={() => setDragging(false)}
            onDrop={(e) => void onDrop(e)}
          >
            <div className="stage-drop-body">
              <div className="stage-drop-icon">
                 <PrepIcon name="folder" size={27} />
              </div>
              <div className="stage-drop-meta">
                 <h2 className="stage-drop-title">{t("mmdVrPrepImport")}</h2>
                <p className="stage-drop-desc">{t("importHint")}</p>
              </div>
            </div>
            <div className="stage-drop-actions">
              <button
                type="button"
                className="stage-btn stage-btn-secondary"
                disabled={importing}
                onClick={() => folderInputRef.current?.click()}
              >
                 <PrepIcon name="folder" />
                <span>{t("mmdVrPrepChooseFolder")}</span>
              </button>
              <button
                type="button"
                className="stage-btn stage-btn-secondary"
                disabled={importing}
                onClick={() => fileInputRef.current?.click()}
              >
                 <PrepIcon name="archive" />
                <span>{t("importZip")}</span>
              </button>
               <label className="stage-encoding-picker">
                <span className="stage-picker-label">{t("importEncoding")}</span>
                <select
                  className="stage-select-sm"
                  value={encoding}
                  onChange={(e) => setEncoding(e.target.value as ArchiveEncoding)}
                  disabled={importing}
                >
                  <option value="auto">{t("importEncodingAuto")}</option>
                  <option value="shift-jis">Shift-JIS</option>
                  <option value="gbk">GBK</option>
                </select>
               </label>
            </div>
            <input ref={folderInputRef} hidden type="file" multiple onChange={onFilesChange} />
            <input ref={fileInputRef} hidden type="file" multiple onChange={onFilesChange} />
          </section>

          {importing && (
            <div className="stage-alert stage-alert-info" role="status" aria-live="polite">
               <PrepIcon name="refresh" className="stage-spin" />
              <span>
                {t("importExtracting")} {importProgress ? `(${importProgress.completed + 1}/${importProgress.total} · ${importProgress.archive}/${importProgress.file})` : "..."}
              </span>
              <button type="button" className="stage-btn stage-btn-ghost stage-btn-sm" onClick={() => importAbortRef.current?.abort()}>
                {t("importCancel")}
              </button>
            </div>
          )}

          {importError && (
            <div className="stage-alert stage-alert-danger" role="alert">
              <div className="stage-alert-title">
                 <PrepIcon name="alert" />
                <span>{t(importError.key)}</span>
              </div>
              <details className="stage-details-inline">
                <summary>{t("loadDetails")}</summary>
                <pre>{importError.detail}</pre>
              </details>
            </div>
          )}

          {conflicts.length > 0 && (
            <details className="stage-alert stage-alert-warning" open>
              <summary className="stage-alert-title">
                 <PrepIcon name="alert" />
                <span>{t("importConflicts")} ({conflicts.length})</span>
              </summary>
              <p className="stage-alert-sub">{t("importConflictHint")}</p>
              <ul className="stage-log-list">
                {conflicts.map((path, i) => (
                  <li key={`${path}:${i}`}>{path}</li>
                ))}
              </ul>
            </details>
          )}

          {checkingAssets && (
            <div className="stage-alert stage-alert-neutral" role="status">
               <PrepIcon name="search" />
              <span>{t("importChecking")}</span>
            </div>
          )}

          {report && (
            <details className="stage-report-box" open={report.issues.length > 0}>
              <summary className="stage-report-summary">
                <div className="stage-report-badge">
                   <PrepIcon name="check" size={16} />
                  <span>{t("importReport")}</span>
                </div>
                <div className="stage-report-stats">
                  <span>{report.models} {t("mmdVrPrepModelCount")}</span>
                  <span>·</span>
                  <span>{report.objects} {t("mmdVrPrepObjectCount")}</span>
                  <span>·</span>
                  <span>{report.motions} {t("mmdVrPrepMotionCount")}</span>
                  <span>·</span>
                  <span>{report.textures} {t("importTextures")}</span>
                </div>
                 <PrepIcon name="down" size={16} className="stage-arrow-icon" />
              </summary>
              <div className="stage-report-content">
                <p className="stage-report-hint">
                  {report.issues.length ? t("importIssuesHint") : t("importCheckPassed")}
                </p>
                {report.issues.length > 0 && (
                  <ul className="stage-issues-list">
                    {report.issues.map((issue, index) => (
                      <li key={index} className="stage-issue-item">
                        <div className="stage-issue-info">
                          <span className={`stage-issue-tag tag-${issue.kind}`}>
                            {t(ISSUE_LABEL[issue.kind])}
                          </span>
                          <span className="stage-issue-path">{issue.file}</span>
                          <code className="stage-issue-ref">{issue.reference}</code>
                        </div>
                        {(issue.kind === "missing" || issue.kind === "ambiguous") && (
                          <button
                            type="button"
                            className="stage-btn stage-btn-sm stage-btn-secondary"
                            disabled={importing}
                            onClick={() => {
                              const model = files.find((file) => relativePath(file) === issue.file);
                              if (!model) return;
                              repairTargetRef.current = { file: model, reference: issue.reference };
                              repairInputRef.current?.click();
                            }}
                          >
                             <PrepIcon name="link" size={15} />
                            <span>{t("importBindResource")}</span>
                          </button>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </details>
          )}
          <input ref={repairInputRef} type="file" hidden onChange={repairResource} />

          <section className="stage-section" aria-labelledby="backpack-heading">
             <div className="stage-library-heading"><PrepIcon name="bag" /><h2 className="stage-section-title" id="backpack-heading">{t("mmdVrPrepBackpack")}</h2><span className="stage-count-badge">{entries.length}</span></div>
            {entries.length === 0 ? (
              <p className="stage-section-sub">{t(files.length ? "mmdVrPrepNoCatalogFiles" : "mmdVrPrepEmptyBackpack")}</p>
            ) : catalog.map(({ label, items }) => items.length > 0 && (
              <details className="stage-catalog-group" key={label} open={items.length <= 6}>
                <summary className="stage-catalog-summary">{t(label)} <span className="stage-count-badge">{items.length}</span></summary>
                <ul className="stage-asset-grid" aria-label={t(label)}>
                  {items.map(({ file, path, id }) => (
                      <li key={id} className="stage-asset-tile">
                        <div className="stage-tile-info" title={path}>
                          <div className="stage-tile-name">{file.name}</div>
                          {path !== file.name && <div className="stage-tile-path">{path}</div>}
                        </div>
                        {inUse.has(file) ? <span className="stage-tile-in-use">{t("mmdVrPrepFileInUse")}</span> : <button type="button" className="stage-btn-icon stage-tile-remove"
                          aria-label={`${t("mmdVrPrepRemoveFile")}: ${path}`} onClick={() => removeImportedFile(file)}>
                           <PrepIcon name="trash" size={16} />
                        </button>}
                      </li>
                  ))}
                </ul>
              </details>
            ))}
          </section>

        </div><aside className="stage-settings" aria-label={t("mmdVrPrepRuntimeConfig")}>
           <label className="stage-field stage-first-room">
             <span className="stage-field-label"><PrepIcon name="window" />{t("sceneryPicker")}</span>
             <select className="stage-select" value={prefs.scenery} onChange={(event) => setPrefs({ scenery: resolveScenery(event.target.value) })}>
               {sceneryIds.map(id => <option key={id} value={id}>{t(SCENERY[id].label)}</option>)}
             </select>
           </label>
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
              <p className="stage-config-notice">{t("diagPrepHint")}</p>

              <div className="stage-form-row">
                <span className="stage-row-label">{t("settingsMmdVrQuestPreset")}</span>
                <OptionGroup
                  value={questPreset}
                  options={[
                    { id: "safe", label: t("settingsMmdVrPresetSafe") },
                    { id: "balanced", label: t("settingsMmdVrPresetBalanced") },
                    { id: "clarity", label: t("settingsMmdVrPresetClarity") },
                    { id: "custom", label: t("settingsMmdVrPresetCustom") },
                  ]}
                  onChange={(preset) => {
                    if (preset === "custom") setPrefs({ advancedRenderOverrides: false });
                    else applyQuestPreset(preset);
                  }}
                />
              </div>

              <div className="stage-form-row">
                <span className="stage-row-label">{t("settingsAccent")}</span>
                <div className="stage-swatch-list" role="group" aria-label={t("settingsAccent")}>
                  {ACCENT_COLORS.map((color) => {
                    const labelKey = `accent${color[0].toUpperCase()}${color.slice(1)}` as TranslationKey;
                    return (
                      <button
                        key={color}
                        type="button"
                        className={`stage-swatch-btn ${themeSettings.accentColor === color ? "is-active" : ""}`}
                        style={{ background: `oklch(0.62 ${ACCENT_CHROMA[color]} ${ACCENT_HUES[color]})` }}
                        aria-label={t(labelKey)}
                        aria-pressed={themeSettings.accentColor === color}
                        title={t(labelKey)}
                        onClick={() => updateThemeSettings({ accentColor: color })}
                      />
                    );
                  })}
                </div>
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
                      <div className="stage-form-row">
                        <span className="stage-row-label">{t("settingsVrDesktopFramebufferScale")}</span>
                        <OptionGroup
                          value={prefs.framebufferScalePref}
                          options={[
                            { id: "auto", label: t("settingsVrDesktopQualityAuto") },
                            { id: "0.7", label: "70%" },
                            { id: "0.85", label: "85%" },
                            { id: "1", label: "100%" },
                          ]}
                          onChange={(framebufferScalePref) => setPrefs({ framebufferScalePref, advancedRenderOverrides: true })}
                        />
                      </div>
                      <div className="stage-form-row">
                        <span className="stage-row-label">{t("settingsVrDesktopFoveation")}</span>
                        <OptionGroup
                          value={prefs.foveationPref}
                          options={[
                            { id: "high", label: t("settingsMmdVrFoveationPerformance") },
                            { id: "medium", label: t("settingsMmdVrFoveationBalanced") },
                            { id: "off", label: t("settingsMmdVrFoveationOff") },
                          ]}
                          onChange={(foveationPref) => setPrefs({ foveationPref, advancedRenderOverrides: true })}
                        />
                      </div>
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

                  <div className="stage-form-row">
                    <span className="stage-row-label">{t("settingsMmdVrWalkSpeed")}</span>
                    <OptionGroup
                      value={prefs.walkSpeedPref}
                      options={[
                        { id: "auto", label: t("settingsVrDesktopQualityAuto") },
                        { id: "slow", label: t("settingsMmdVrWalkSlow") },
                        { id: "normal", label: t("settingsMmdVrWalkNormal") },
                        { id: "fast", label: t("settingsMmdVrWalkFast") },
                      ]}
                      onChange={(walkSpeedPref) => setPrefs({ walkSpeedPref })}
                    />
                  </div>

                  <label className="stage-toggle-row">
                    <span>{t("settingsVrDesktopShowFps")}</span>
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
            </div>
           </details>
        </aside></div>
      </main>

      <footer className="stage-records">
        <div className="stage-launch-inner">
          {errorMessage && (
            <div className="stage-alert stage-alert-danger" role="alert">
              <div className="stage-alert-title">
                 <PrepIcon name="alert" />
                <span>{t("loadEnterFailed")}</span>
              </div>
              <p className="stage-alert-sub">{t("loadEnterRecovery")}</p>
              <details className="stage-details-inline">
                <summary>{t("loadDetails")}</summary>
                <pre>{errorMessage}</pre>
              </details>
            </div>
          )}

          {assetLoad.failures.length > 0 && (
            <div className="stage-alert stage-alert-warning">
              <div className="stage-alert-title">
                 <PrepIcon name="alert" />
                <span>{t("loadPartial")} ({assetLoad.failures.length})</span>
              </div>
              <p className="stage-alert-sub">{t("loadReenterHint")}</p>
              <details className="stage-details-inline">
                <summary>{t("loadDetails")}</summary>
                <ul className="stage-log-list">
                  {assetLoad.failures.map((failure) => (
                    <li key={failure.id}>
                      <strong>{failure.fileName}</strong>
                      <pre>{failure.message}</pre>
                    </li>
                  ))}
                </ul>
              </details>
            </div>
          )}

          {performanceReport && phase !== "active" && phase !== "entering" && <button type="button" className="stage-btn stage-btn-secondary" onClick={() => downloadPerformanceReport(performanceReport)}>{t("exportSessionPerformance")}</button>}
        </div>
      </footer>

     </div><MmdVrOverlay /></>
  );
}
