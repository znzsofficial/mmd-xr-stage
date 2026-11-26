import {DeviceSettings} from './DeviceSettings';
import { PrepIcon } from "./PrepIcon";
import classroomWindow from "./classroom-window.webp";
import { useEffect, useMemo, useRef, useState, type ChangeEvent, type DragEvent } from "react";
import { useLanguageStore, type TranslationKey } from "../../languageStore";
import { collectFilesFromDataTransfer, relativePath } from "../../mmdImport/folderFiles";
import { getXrSystem } from "../../xr";
import { MmdVrOverlay } from "../MmdVrOverlay";
import { MusicPicker } from '../music/MusicPicker';
import { useStageMusic } from '../music/stageMusic';
import { enterScreen } from '../screen/enterScreen';
import { clearBackpack, syncBackpackFiles, useBackpack } from "../backpack/store";
import { requestMmdVrEnter } from "../xr/requestMmdVrEnter";
import { useMmdVrStore } from "../mmdVrStore";
import { resolveScenery } from "../scenery/catalog";
import { SceneryOptions } from '../scenery/SceneryOptions';
import { expandAssetFiles, AssetImportError, IMPORT_LIMITS, type ArchiveEncoding, type ImportProgress } from "../../mmdImport/importArchive";
import { bindCompanion, mergeAssetFiles } from "../../mmdImport/assetPaths";
import { inspectAssets, type ImportReport } from "../../mmdImport/inspectAssets";
import { downloadPerformanceReport, samePagePair, useLastPerformanceReport } from "../diagnostics/performanceReport";
import {usesFloorBackend,type LoadFloorBackend} from '../xr/floorBackend';
import {useFloorBackend} from './useFloorBackend';
import {stageHudVars} from '../pelvic/palette';

type XrReadiness = "checking" | "ready" | "unverified" | "insecure" | "no-xr";

const ISSUE_LABEL = { missing: "importMissing", ambiguous: "importAmbiguous", invalid: "importInvalid", fallback: "importFallback" } as const;
const CATALOG_GROUPS = [
  { kind: "model", label: "mmdVrPrepModels" },
  { kind: "object", label: "mmdVrPrepObjects" },
  { kind: "motion", label: "mmdVrPrepMotions" },
] as const;

export function MmdVrPrepApp({showOverlay=true,loadFloorBackend}:{showOverlay?:boolean;loadFloorBackend?:LoadFloorBackend} = {}) {
  const t = useLanguageStore((state) => state.t);
  const phase = useMmdVrStore((state) => state.phase);
  const screenFailed = useMmdVrStore(state=>state.presentation==='screen'&&state.phase==='error');
  const assetLoad = useMmdVrStore((state) => state.assetLoad);
  const savedStage = useMmdVrStore((state) => state.savedStage);
  const files = useBackpack((state) => state.files);
  const entries = useBackpack((state) => state.entries);
  const layouts = useBackpack((state) => state.layouts);
  const bindings = useBackpack((state) => state.bindings);
  const errorMessage = useMmdVrStore((state) => state.errorMessage);
  const performanceReport = useLastPerformanceReport((state) => state.report);
  const comparison=loadFloorBackend && samePagePair();
  const [floorRenderer,setFloorRenderer]=useState<'webgpu'|'webgl'>('webgpu');
  const prefs = useMmdVrStore((state) => state.prefs);
  const floor=useFloorBackend(prefs.scenery==='floor'?loadFloorBackend:undefined);
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
    useStageMusic.getState().select(null);
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

  const candidate=(resume=false)=>floorRenderer==='webgpu'&&floor.enabled&&usesFloorBackend(prefs.scenery,resume,savedStage?.scenery);
  function enterVr(resume = false) {
    if(floor.phase)return;
    if(candidate(resume)){floor.enter(resume);return;}
    void requestMmdVrEnter({ t, assets: [], resume });
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
    <><div className="stage-app" inert={floor.phase!==null}>
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
              {phase === "entering" ? t("mmdVrPrepEntering") : readinessMessage}{candidate() ? ' · WebGPU' : ''}
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
             {screenFailed&&errorMessage&&<p role="alert">{t('screenWebgl')} <small>{errorMessage}</small></p>}
             {prefs.scenery==='floor'&&floor.failed&&<p role="alert">{t('floorWebglFallback')} <small>{floor.failed}</small></p>}
          </div>
          <div className="stage-launch-actions">
            <div className="stage-launch-row">
              <button type="button" className="stage-btn stage-btn-secondary stage-btn-lg" disabled={importing || checkingAssets || phase === 'entering' || phase === 'active'} onClick={enterScreen}>
                <PrepIcon name="screen"/><span>{t('screenWatch')}</span>
              </button>
              {savedStage && <button type="button" className="stage-btn stage-btn-secondary stage-btn-lg" data-xr-backend={candidate(true)?'webgpu':'webgl'} disabled={entryDisabled||(candidate(true)&&floor.loading)} onClick={() => enterVr(true)}>
                <PrepIcon name="play" /><span>{t("stageContinue")}</span>
              </button>}
              <button type="button" className="stage-btn stage-btn-primary stage-btn-lg" data-xr-backend={candidate()?'webgpu':'webgl'} disabled={entryDisabled||(candidate()&&floor.loading)} onClick={() => enterVr(false)}>
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
                 <SceneryOptions current={prefs.scenery} offerFloor={!!loadFloorBackend}/>
             </select>
           </label>
            {loadFloorBackend && prefs.scenery==='floor' && <label className="stage-field">
              <span className="stage-field-label">{t('floorXrRenderer')}</span>
              <select className="stage-select" data-floor-renderer value={floor.failed?'webgl':floorRenderer} disabled={!!floor.failed||phase==='entering'||phase==='active'} onChange={e=>setFloorRenderer(e.target.value==='webgpu'?'webgpu':'webgl')}>
                <option value="webgpu">WebGPU</option><option value="webgl">WebGL</option>
              </select>
            </label>}
            <MusicPicker disabled={phase === 'entering' || phase === 'active'} />
           <DeviceSettings/>
        </aside></div>
      </main>

      <footer className="stage-records">
        <div className="stage-launch-inner">
           {errorMessage && !screenFailed && (
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

          {performanceReport && phase !== "active" && phase !== "entering" && <button type="button" className="stage-btn stage-btn-secondary" data-performance-export onClick={() => downloadPerformanceReport(performanceReport,comparison)}>{comparison?t('exportBackendComparison'):`${t('exportSessionPerformance')} · ${performanceReport.backend==='webgpu'?'WebGPU':'WebGL'}`}</button>}
        </div>
      </footer>

    </div>{showOverlay && <MmdVrOverlay xrHost={floor.phase!==null &&
      <div role="dialog" aria-modal="true" aria-label={t('settingsMmdVrShowcase')} className="xr-stage-overlay" style={stageHudVars} data-xr-host="webgpu" data-phase={floor.phase}>
        <div className="xr-stage-hud"><button type="button" className="xr-stage-exit" onClick={floor.stop}>{t('settingsVrDesktopExit')}</button></div>
      </div>}/>}</>
  );
}
