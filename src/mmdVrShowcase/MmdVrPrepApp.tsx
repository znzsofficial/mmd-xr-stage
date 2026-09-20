import { Icon } from "@iconify-icon/react";
import { useEffect, useMemo, useRef, useState, type ChangeEvent, type DragEvent } from "react";
import { useLanguageStore, type TranslationKey } from "../languageStore";
import {
  collectFilesFromDataTransfer,
  listMmdModels,
  listMmdMotions,
  listMmdObjects,
  relativePath,
} from "../mmdImport/folderFiles";
import { useNotificationStore } from "../notificationStore";
import { getXrSystem } from "../xr";
import { MmdVrOverlay } from "./MmdVrOverlay";
import { MMD_VR_MAX_MODELS, MMD_VR_MAX_OBJECTS, type MmdVrAssetSlot } from "./mmdVrAssets";
import { formatMmdVrProfileSummary, getMmdVrRenderProfile } from "./mmdVrQuality";
import { requestMmdVrEnter } from "./requestMmdVrEnter";
import { useMmdVrStore } from "./mmdVrStore";
import { ACCENT_CHROMA, ACCENT_COLORS, ACCENT_HUES, updateThemeSettings } from "../system/theme";
import { useThemeSettings } from "../system/useThemeSettings";
import { expandAssetFiles, AssetImportError, IMPORT_LIMITS, type ArchiveEncoding, type ImportProgress } from "../mmdImport/importArchive";
import { bindCompanion, mergeAssetFiles } from "../mmdImport/assetPaths";
import { inspectAssets, type ImportReport } from "../mmdImport/inspectAssets";

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
  const errorMessage = useMmdVrStore((state) => state.errorMessage);
  const prefs = useMmdVrStore((state) => state.prefs);
  const setPrefs = useMmdVrStore((state) => state.setPrefs);

  const folderInputRef = useRef<HTMLInputElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const repairInputRef = useRef<HTMLInputElement | null>(null);
  const repairTargetRef = useRef<{ file: File; reference: string } | null>(null);
  const importAbortRef = useRef<AbortController | null>(null);
  const filesRef = useRef<File[]>([]);
  const importGenerationRef = useRef(0);

  const [files, setFiles] = useState<File[]>([]);
  const [importing, setImporting] = useState(false);
  const [importProgress, setImportProgress] = useState<ImportProgress | null>(null);
  const [importError, setImportError] = useState<{ key: TranslationKey; detail: string } | null>(null);
  const [conflicts, setConflicts] = useState<string[]>([]);
  const [encoding, setEncoding] = useState<ArchiveEncoding>("auto");
  const [report, setReport] = useState<ImportReport | null>(null);
  const [checkingAssets, setCheckingAssets] = useState(false);
  const [readiness, setReadiness] = useState<XrReadiness>("checking");
  const [selectedPaths, setSelectedPaths] = useState<string[]>([]);
  const [selectedObjectPaths, setSelectedObjectPaths] = useState<string[]>([]);
  const [bodyMotionPath, setBodyMotionPath] = useState("");
  const [faceMotionPath, setFaceMotionPath] = useState("");
  const [dragging, setDragging] = useState(false);

  const questPreset = getQuestPreset(prefs);
  const highLoadConfig = prefs.frameRatePref === "120"
    || (prefs.advancedRenderOverrides && prefs.framebufferScalePref === "1" && prefs.foveationPref === "off");
  const selectedMotionCount = Number(Boolean(bodyMotionPath)) + Number(Boolean(faceMotionPath));

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

  const models = useMemo(() => listMmdModels(files), [files]);
  const motions = useMemo(() => listMmdMotions(files), [files]);
  const objects = useMemo(() => listMmdObjects(files), [files]);
  const selectedModels = useMemo(
    () => models.filter((model) => selectedPaths.includes(relativePath(model))).slice(0, MMD_VR_MAX_MODELS),
    [models, selectedPaths],
  );
  const selectedObjects = useMemo(
    () => objects.filter((object) => selectedObjectPaths.includes(relativePath(object))).slice(0, MMD_VR_MAX_OBJECTS),
    [objects, selectedObjectPaths],
  );

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

  function ingest(nextFiles: File[]) {
    const merged = mergeAssetFiles(filesRef.current, nextFiles);
    if (merged.files.length > IMPORT_LIMITS.entries || merged.files.reduce((sum, file) => sum + file.size, 0) > IMPORT_LIMITS.totalBytes) {
      throw new AssetImportError("limit", nextFiles[0]?.name ?? "");
    }
    filesRef.current = merged.files;
    setFiles(merged.files);
    setConflicts(merged.conflicts);
    setSelectedPaths((prevSel) => {
      const remaining = MMD_VR_MAX_MODELS - prevSel.length;
      if (remaining <= 0) return prevSel;
      const additions = listMmdModels(merged.accepted)
        .map(relativePath)
        .filter((path) => !prevSel.includes(path))
        .slice(0, remaining);
      return [...prevSel, ...additions];
    });
    setSelectedObjectPaths((prevSel) => {
      const remaining = MMD_VR_MAX_OBJECTS - prevSel.length;
      if (remaining <= 0) return prevSel;
      const additions = listMmdObjects(merged.accepted)
        .map(relativePath)
        .filter((path) => !prevSel.includes(path))
        .slice(0, remaining);
      return [...prevSel, ...additions];
    });
  }

  function removeImportedFile(path: string) {
    filesRef.current = filesRef.current.filter((file) => relativePath(file) !== path);
    setFiles(filesRef.current);
    setSelectedPaths((prev) => prev.filter((item) => item !== path));
    setSelectedObjectPaths((prev) => prev.filter((item) => item !== path));
    setBodyMotionPath((prev) => (prev === path ? "" : prev));
    setFaceMotionPath((prev) => (prev === path ? "" : prev));
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
    setCheckingAssets(files.length > 0);
    setReport(null);
    if (files.length) {
      void inspectAssets(files, abort.signal)
        .then((report) => {
          if (!abort.signal.aborted) {
            setReport(report);
            setCheckingAssets(false);
          }
        })
        .catch((error) => {
          if (!abort.signal.aborted) {
            setImportError({ key: "importFailed", detail: String(error) });
            setCheckingAssets(false);
          }
        });
    }
    return () => abort.abort();
  }, [files]);

  function clearImports() {
    importAbortRef.current?.abort();
    importGenerationRef.current += 1;
    filesRef.current = [];
    setFiles([]);
    setSelectedPaths([]);
    setSelectedObjectPaths([]);
    setBodyMotionPath("");
    setFaceMotionPath("");
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
    if (!file || !target || !filesRef.current.includes(target.file)) return;
    if (
      file.size > IMPORT_LIMITS.fileBytes ||
      filesRef.current.length >= IMPORT_LIMITS.entries ||
      filesRef.current.reduce((n, f) => n + f.size, 0) + file.size > IMPORT_LIMITS.totalBytes
    ) {
      setImportError({ key: "importTooLarge", detail: file.name });
      return;
    }
    bindCompanion(target.file, target.reference, file);
    filesRef.current = [...filesRef.current, file];
    setFiles(filesRef.current);
  }

  function toggleModel(path: string) {
    setSelectedPaths((current) => {
      if (current.includes(path)) return current.filter((item) => item !== path);
      if (current.length >= MMD_VR_MAX_MODELS) return current;
      return [...current, path];
    });
  }

  function toggleObject(path: string) {
    setSelectedObjectPaths((current) => {
      if (current.includes(path)) return current.filter((item) => item !== path);
      if (current.length >= MMD_VR_MAX_OBJECTS) return current;
      return [...current, path];
    });
  }

  function enterVr(resume = false) {
    const bodyMotion = motions.find((file) => relativePath(file) === bodyMotionPath) ?? null;
    const faceMotion = motions.find((file) => relativePath(file) === faceMotionPath) ?? null;
    const assets: MmdVrAssetSlot[] = [
      ...selectedModels.map((modelFile) => ({
        kind: "model" as const,
        modelFile,
        companionFiles: [...files],
        bodyMotionFile: bodyMotion,
        faceMotionFile: faceMotion,
      })),
      ...selectedObjects.map((objectFile) => ({
        kind: "object" as const,
        objectFile,
        companionFiles: [...files],
      })),
    ];
    void requestMmdVrEnter({ t, addNotification, assets, resume });
  }

  const hasReadyContent = Boolean(selectedModels.length || selectedObjects.length);
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
    <div className="stage-app">
      <header className="stage-header">
        <div className="stage-brand">
          <div className="stage-brand-badge" aria-hidden="true">
            <Icon icon="solar:videocamera-record-bold-duotone" width={18} height={18} />
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

          {files.length > 0 && (
            <button
              type="button"
              className="stage-btn stage-btn-ghost stage-btn-sm"
              disabled={phase === "entering" || phase === "active"}
              onClick={clearImports}
            >
              <Icon icon="solar:trash-bin-trash-linear" width={15} height={15} />
              <span>{t("importClear")}</span>
            </button>
          )}
        </div>
      </header>

      <main className="stage-main">
        <div className="stage-intro">
          <h1 className="stage-intro-title">{t("mmdVrPrepTitle")}</h1>
          <p className="stage-intro-lead">{t("mmdVrPrepLead")}</p>
        </div>

          <section
            className={`stage-drop-zone ${dragging ? "is-dragging" : ""}`}
            onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
            onDragLeave={() => setDragging(false)}
            onDrop={(e) => void onDrop(e)}
          >
            <div className="stage-drop-body">
              <div className="stage-drop-icon">
                <Icon icon="solar:folder-with-files-bold-duotone" width={32} height={32} />
              </div>
              <div className="stage-drop-meta">
                <h3 className="stage-drop-title">{t("mmdVrPrepImport")}</h3>
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
                <Icon icon="solar:folder-open-linear" width={18} height={18} />
                <span>{t("mmdVrPrepChooseFolder")}</span>
              </button>
              <button
                type="button"
                className="stage-btn stage-btn-secondary"
                disabled={importing}
                onClick={() => fileInputRef.current?.click()}
              >
                <Icon icon="solar:archive-linear" width={18} height={18} />
                <span>{t("importZip")}</span>
              </button>
              <div className="stage-encoding-picker">
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
              </div>
            </div>
            <input ref={folderInputRef} hidden type="file" multiple onChange={onFilesChange} />
            <input ref={fileInputRef} hidden type="file" multiple onChange={onFilesChange} />
          </section>

          {importing && (
            <div className="stage-alert stage-alert-info" role="status" aria-live="polite">
              <Icon icon="solar:refresh-circle-linear" width={18} height={18} className="stage-spin" />
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
                <Icon icon="solar:danger-triangle-bold" width={18} height={18} />
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
                <Icon icon="solar:shield-warning-bold" width={18} height={18} />
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
              <Icon icon="solar:magnifer-linear" width={18} height={18} className="stage-spin" />
              <span>{t("importChecking")}</span>
            </div>
          )}

          {report && (
            <details className="stage-report-box" open={report.issues.length > 0}>
              <summary className="stage-report-summary">
                <div className="stage-report-badge">
                  <Icon icon="solar:clipboard-check-linear" width={16} height={16} />
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
                <Icon icon="solar:alt-arrow-down-linear" width={16} height={16} className="stage-arrow-icon" />
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
                            {t(({ missing: "importMissing", ambiguous: "importAmbiguous", invalid: "importInvalid", fallback: "importFallback" } as const)[issue.kind])}
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
                            <Icon icon="solar:link-minimalistic-2-linear" width={14} height={14} />
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

          <section className="stage-section">
            <div className="stage-section-header">
              <div>
                <h3 className="stage-section-title">{t("mmdVrPrepModels")}</h3>
                <span className="stage-section-sub">{t("mmdVrPrepModelLimit").replace("{count}", String(MMD_VR_MAX_MODELS))}</span>
              </div>
              <span className="stage-count-badge">{selectedModels.length}/{MMD_VR_MAX_MODELS}</span>
            </div>
            {models.length ? (
              <div className="stage-asset-grid">
                {models.map((model, index) => {
                  const path = relativePath(model);
                  const selected = selectedPaths.includes(path);
                  return (
                    <div key={path} className={`stage-asset-tile ${selected ? "is-selected" : ""}`}>
                      <div className="stage-tile-index">{String(index + 1).padStart(2, "0")}</div>
                      <button type="button" className="stage-tile-btn" onClick={() => toggleModel(path)}>
                        <div className="stage-tile-name">{model.name}</div>
                        <div className="stage-tile-path">{path}</div>
                      </button>
                      <div className="stage-tile-check" aria-hidden="true" onClick={() => toggleModel(path)}>
                        <Icon icon={selected ? "solar:check-circle-bold" : "solar:add-circle-linear"} width={20} height={20} />
                      </div>
                      <button
                        type="button"
                        className="stage-btn-icon stage-tile-remove"
                        aria-label={t("mmdVrPrepRemoveFile")}
                        onClick={() => removeImportedFile(path)}
                      >
                        <Icon icon="solar:trash-bin-trash-linear" width={16} height={16} />
                      </button>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="stage-empty-placeholder">
                <Icon icon="solar:user-broken" width={28} height={28} />
                <span>{files.length ? t("mmdVrPrepNoModels") : t("mmdVrPrepAwaiting")}</span>
              </div>
            )}
          </section>

          <section className="stage-section">
            <div className="stage-section-header">
              <div>
                <h3 className="stage-section-title">{t("mmdVrPrepObjects")}</h3>
                <span className="stage-section-sub">{t("mmdVrPrepObjectLimit").replace("{count}", String(MMD_VR_MAX_OBJECTS))}</span>
              </div>
              <span className="stage-count-badge">{selectedObjects.length}/{MMD_VR_MAX_OBJECTS}</span>
            </div>
            {objects.length ? (
              <div className="stage-asset-grid">
                {objects.map((object, index) => {
                  const path = relativePath(object);
                  const selected = selectedObjectPaths.includes(path);
                  return (
                    <div key={path} className={`stage-asset-tile ${selected ? "is-selected" : ""}`}>
                      <div className="stage-tile-index">{String(index + 1).padStart(2, "0")}</div>
                      <button type="button" className="stage-tile-btn" onClick={() => toggleObject(path)}>
                        <div className="stage-tile-name">{object.name}</div>
                        <div className="stage-tile-path">{path}</div>
                      </button>
                      <div className="stage-tile-check" aria-hidden="true" onClick={() => toggleObject(path)}>
                        <Icon icon={selected ? "solar:check-circle-bold" : "solar:add-circle-linear"} width={20} height={20} />
                      </div>
                      <button
                        type="button"
                        className="stage-btn-icon stage-tile-remove"
                        aria-label={t("mmdVrPrepRemoveFile")}
                        onClick={() => removeImportedFile(path)}
                      >
                        <Icon icon="solar:trash-bin-trash-linear" width={16} height={16} />
                      </button>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="stage-empty-placeholder">
                <Icon icon="solar:box-broken" width={28} height={28} />
                <span>{files.length ? t("mmdVrPrepNoObjects") : t("mmdVrPrepAwaiting")}</span>
              </div>
            )}
          </section>

          <section className="stage-section">
            <div className="stage-section-header">
              <div>
                <h3 className="stage-section-title">{t("mmdVrPrepMotionHint")}</h3>
              </div>
            </div>
            <div className="stage-motion-controls">
              <label className="stage-field">
                <span className="stage-field-label">{t("mmdVrPrepBodyMotion")}</span>
                <select className="stage-select" value={bodyMotionPath} onChange={(e) => setBodyMotionPath(e.target.value)}>
                  <option value="">{t("mmdVrPrepNoMotion")}</option>
                  {motions.map((motion) => (
                    <option key={relativePath(motion)} value={relativePath(motion)}>
                      {motion.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="stage-field">
                <span className="stage-field-label">{t("mmdVrPrepFaceMotion")}</span>
                <select className="stage-select" value={faceMotionPath} onChange={(e) => setFaceMotionPath(e.target.value)}>
                  <option value="">{t("mmdVrPrepNoMotion")}</option>
                  {motions.map((motion) => (
                    <option key={relativePath(motion)} value={relativePath(motion)}>
                      {motion.name}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          </section>

          <details className="stage-config-card" open>
            <summary className="stage-config-summary">
              <div className="stage-config-summary-left">
                <div className="stage-config-icon">
                  <Icon icon="solar:tuning-square-2-bold-duotone" width={20} height={20} />
                </div>
                <div>
                  <h3 className="stage-section-title">{t("mmdVrPrepRuntimeConfig")}</h3>
                  <span className="stage-config-preview">{formatMmdVrProfileSummary(getMmdVrRenderProfile(prefs), language)}</span>
                </div>
              </div>
              <Icon icon="solar:alt-arrow-down-linear" width={18} height={18} className="stage-arrow-icon" />
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
                  <Icon icon="solar:settings-minimalistic-linear" width={16} height={16} />
                  <span>{t("settingsMmdVrAdvancedConfig")}</span>
                  <Icon icon="solar:alt-arrow-down-linear" width={14} height={14} className="stage-sub-arrow" />
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
                      <Icon icon="solar:tuning-4-linear" width={15} height={15} />
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
                      <Icon icon="solar:shield-warning-bold" width={16} height={16} />
                      <span>{t("settingsMmdVrHighLoadWarning")}</span>
                    </div>
                  )}
                  <p className="stage-hint-text">{t("settingsVrDesktopQualityHint")}</p>
                </div>
              </details>
            </div>
          </details>
      </main>

      <footer className="stage-launch-bar">
        <div className="stage-launch-inner">
          {errorMessage && (
            <div className="stage-alert stage-alert-danger" role="alert">
              <div className="stage-alert-title">
                <Icon icon="solar:danger-triangle-bold" width={18} height={18} />
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
                <Icon icon="solar:shield-warning-bold" width={18} height={18} />
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

          {savedStage && savedStage.assets.length > 0 && (
            <p className="stage-launch-note">
              {t("stageResumeHint")} ({Math.floor(savedStage.time / 60)}:{String(Math.floor(savedStage.time % 60)).padStart(2, "0")})
            </p>
          )}

          <div className="stage-launch-row">
            {savedStage && savedStage.assets.length > 0 && (
              <button
                type="button"
                className="stage-btn stage-btn-secondary stage-btn-lg"
                disabled={importing || readiness === "insecure" || readiness === "no-xr" || phase === "entering" || phase === "active"}
                onClick={() => enterVr(true)}
              >
                <Icon icon="solar:play-circle-bold" width={20} height={20} />
                <span>{t("stageContinue")}</span>
              </button>
            )}
            <button
              type="button"
              className="stage-btn stage-btn-primary stage-btn-lg"
              disabled={importing || checkingAssets || !hasReadyContent || readiness === "insecure" || readiness === "no-xr" || phase === "entering" || phase === "active"}
              onClick={() => enterVr(false)}
            >
              <Icon icon="boxicons:vr-headset-filled" width={22} height={22} />
              <span>{phase === "entering" ? t("settingsMmdVrEntering") : savedStage ? t("stageRestart") : t("settingsMmdVrEnter")}</span>
              <Icon icon="solar:arrow-right-linear" width={18} height={18} />
            </button>
          </div>
          <p className="stage-launch-hint">{t("mmdVrPrepEnterHint")}</p>
        </div>
      </footer>

      <MmdVrOverlay />
    </div>
  );
}
