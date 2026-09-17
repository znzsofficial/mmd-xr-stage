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
    <div className="mmd-vr-prep-options">
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
  const [importing, setImporting] = useState(false);
  const [importProgress, setImportProgress] = useState<ImportProgress | null>(null);
  const [importError, setImportError] = useState<{ key: TranslationKey; detail: string } | null>(null);
  const [conflicts, setConflicts] = useState<string[]>([]);
  const [encoding, setEncoding] = useState<ArchiveEncoding>("auto");
  const [report, setReport] = useState<ImportReport | null>(null);
  const [checkingAssets, setCheckingAssets] = useState(false);
  const importGenerationRef = useRef(0);
  const [files, setFiles] = useState<File[]>([]);
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
    // Accumulate across multiple folder picks / drops instead of replacing.
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

  function repairResource(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    const target = repairTargetRef.current;
    event.target.value = "";
    repairTargetRef.current = null;
    if (!file || !target || !filesRef.current.includes(target.file)) return;
    if (file.size > IMPORT_LIMITS.fileBytes || filesRef.current.length >= IMPORT_LIMITS.entries || filesRef.current.reduce((n, f) => n + f.size, 0) + file.size > IMPORT_LIMITS.totalBytes) {
      setImportError({ key: "importTooLarge", detail: file.name });
      return;
    }
    // Keep an explicit binding rather than guessing which ZIP a loose file belongs to.
    bindCompanion(target.file, target.reference, file);
    filesRef.current = [...filesRef.current, file];
    setFiles(filesRef.current);
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
      const expanded = await expandAssetFiles(incoming, { signal: abort.signal, encoding,
        onProgress: (progress) => { if (generation === importGenerationRef.current) setImportProgress(progress); } });
      abort.signal.throwIfAborted();
      if (generation === importGenerationRef.current) ingest(expanded);
    } catch (error) {
      if (abort.signal.aborted || generation !== importGenerationRef.current) return;
      const keys = { path: "importBadPath", limit: "importTooLarge", encrypted: "importEncrypted", archive: "importFailed" } as const;
      setImportError({ key: error instanceof AssetImportError ? keys[error.code] : "importFailed",
        detail: error instanceof AssetImportError ? `${error.file}: ${error.message}` : String(error) });
    } finally {
      if (generation === importGenerationRef.current) { setImporting(false); setImportProgress(null); }
    }
  }

  useEffect(() => () => { importAbortRef.current?.abort(); importGenerationRef.current += 1; }, []);

  useEffect(() => {
    const abort = new AbortController();
    setCheckingAssets(files.length > 0);
    setReport(null);
    if (files.length) void inspectAssets(files, abort.signal).then((report) => {
      if (!abort.signal.aborted) { setReport(report); setCheckingAssets(false); }
    }).catch((error) => {
      if (!abort.signal.aborted) { setImportError({ key: "importFailed", detail: String(error) }); setCheckingAssets(false); }
    });
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

  return (
    <main className="mmd-vr-prep-shell">
      <header className="mmd-vr-prep-nav">
        <div className="mmd-vr-prep-system-id">
          <span className="mmd-vr-prep-system-dot" />
          <span>MMD XR Stage</span>
          <span className="mmd-vr-prep-system-divider">/</span>
          <span>{t("mmdVrPrepSystem")}</span>
        </div>
      </header>

      <section className="mmd-vr-prep-layout">
        <div className="mmd-vr-prep-intro">
          <div className="mmd-vr-prep-brandmark" aria-hidden="true">
            <Icon icon="boxicons:vr-headset" width={30} height={30} />
          </div>
          <span className="mmd-vr-prep-kicker">{t("mmdVrPrepEyebrow")}</span>
          <h1>{t("mmdVrPrepTitle")}</h1>
          <p>{t("mmdVrPrepLead")}</p>
          <div className="mmd-vr-prep-status-card">
            <div className="mmd-vr-prep-status-head">
              <span>{t("mmdVrPrepStatusLabel")}</span>
              <Icon icon="solar:shield-check-bold-duotone" width={18} height={18} />
            </div>
            <div className={`mmd-vr-prep-signal${readiness === "insecure" || readiness === "no-xr" ? " is-error" : readiness === "unverified" || readiness === "checking" ? " is-pending" : ""}`}>
              <span className={phase === "entering" ? "is-busy" : ""} />
              {phase === "entering"
                ? t("mmdVrPrepEntering")
                : readiness === "insecure"
                  ? t("mmdVrPrepInsecureContext")
                  : readiness === "no-xr"
                    ? t("mmdVrPrepXrMissing")
                    : readiness === "ready"
                      ? t("mmdVrPrepReady")
                      : t("mmdVrPrepReadyPending")}
            </div>
            <div className="mmd-vr-prep-steps">
              <span className={files.length ? "is-complete" : "is-current"}><b>1</b>{t("mmdVrPrepStepImport")}</span>
              <span className={selectedModels.length || selectedObjects.length ? "is-current" : ""}><b>2</b>{t("mmdVrPrepStepSelect")}</span>
              <span className="is-last"><b>3</b>{t("mmdVrPrepStepConfigure")}</span>
            </div>
          </div>
          <div className="mmd-vr-prep-asset-summary">
            <span>{t("mmdVrPrepAssetLabel")}</span>
            <div>
              <strong><Icon icon="solar:user-bold-duotone" width={16} height={16} />{selectedModels.length}<small>{t("mmdVrPrepModelCount")}</small></strong>
              <strong><Icon icon="solar:box-bold-duotone" width={16} height={16} />{selectedObjects.length}<small>{t("mmdVrPrepObjectCount")}</small></strong>
              <strong><Icon icon="solar:playlist-2-bold-duotone" width={16} height={16} />{selectedMotionCount}<small>{t("mmdVrPrepMotionCount")}</small></strong>
            </div>
          </div>
        </div>

        <div className="mmd-vr-prep-workbench">
          <section
            className={`mmd-vr-prep-drop${dragging ? " is-dragging" : ""}`}
            onDragOver={(event) => {
              event.preventDefault();
              setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={(event) => void onDrop(event)}
          >
            <div className="mmd-vr-prep-drop-icon">
              <Icon icon="solar:folder-with-files-bold-duotone" width={30} height={30} />
            </div>
            <div>
              <div className="mmd-vr-prep-section-eyebrow">01 / {t("mmdVrPrepSectionAssets")}</div>
              <strong>{t("mmdVrPrepImport")}</strong>
              <p>{t("importHint")}</p>
            </div>
            <div className="mmd-import-actions">
              <button type="button" className="button-primary" disabled={importing} onClick={() => folderInputRef.current?.click()}>
                {t("mmdVrPrepChooseFolder")}
              </button>
              <button type="button" className="button-primary" disabled={importing} onClick={() => fileInputRef.current?.click()}>{t("importZip")}</button>
            </div>
            <input ref={folderInputRef} hidden type="file" multiple onChange={onFilesChange} />
            <input ref={fileInputRef} hidden type="file" multiple onChange={onFilesChange} />
          </section>

          <label className="mmd-import-encoding">{t("importEncoding")}
            <select value={encoding} onChange={(event) => setEncoding(event.target.value as ArchiveEncoding)} disabled={importing}>
              <option value="auto">{t("importEncodingAuto")}</option><option value="shift-jis">Shift-JIS</option><option value="gbk">GBK</option>
            </select>
          </label>
          {files.length > 0 ? <button type="button" className="button-primary" disabled={phase === "entering" || phase === "active"} onClick={clearImports}>{t("importClear")}</button> : null}
          {importing ? <div className="mmd-import-report" role="status" aria-live="polite">
            <p>{t("importExtracting")} {importProgress ? `${importProgress.completed + 1}/${importProgress.total} · ${importProgress.archive}/${importProgress.file}` : ""}</p>
            <button type="button" onClick={() => importAbortRef.current?.abort()}>{t("importCancel")}</button>
          </div> : null}
          {importError ? <section className="mmd-import-report" role="alert"><p>{t(importError.key)}</p><details><summary>{t("loadDetails")}</summary><pre>{importError.detail}</pre></details></section> : null}
          {conflicts.length > 0 ? <details className="mmd-import-report" open><summary>{t("importConflicts")} ({conflicts.length})</summary><p>{t("importConflictHint")}</p><ul>{conflicts.map((path, i) => <li key={`${path}:${i}`}>{path}</li>)}</ul></details> : null}
          {checkingAssets ? <p role="status">{t("importChecking")}</p> : null}
          {report ? <details className="mmd-import-report" open={report.issues.length > 0}>
            <summary>{t("importReport")} · {report.models} {t("mmdVrPrepModelCount")} · {report.objects} {t("mmdVrPrepObjectCount")} · {report.motions} {t("mmdVrPrepMotionCount")} · {report.textures} {t("importTextures")}</summary>
            <p>{report.issues.length ? t("importIssuesHint") : t("importCheckPassed")}</p>
            <ul>{report.issues.map((issue, index) => <li key={index}><strong>{t(({ missing: "importMissing", ambiguous: "importAmbiguous", invalid: "importInvalid", fallback: "importFallback" } as const)[issue.kind])}</strong> · {issue.file}<pre>{issue.reference}</pre>
              {issue.kind === "missing" || issue.kind === "ambiguous" ? <button type="button" disabled={importing} onClick={() => {
                const model = files.find((file) => relativePath(file) === issue.file);
                if (!model) return;
                repairTargetRef.current = { file: model, reference: issue.reference };
                repairInputRef.current?.click();
              }}>{t("importBindResource")}</button> : null}
            </li>)}</ul>
          </details> : null}
          <input ref={repairInputRef} type="file" hidden onChange={repairResource} />

          <section className="mmd-vr-prep-section">
            <div className="mmd-vr-prep-section-head">
              <div>
                <div className="mmd-vr-prep-section-eyebrow">02 / {t("mmdVrPrepSectionCharacters")}</div>
                <strong>{t("mmdVrPrepModels")}</strong>
                <span>{t("mmdVrPrepModelLimit").replace("{count}", String(MMD_VR_MAX_MODELS))}</span>
              </div>
              <b>{selectedModels.length}/{MMD_VR_MAX_MODELS}</b>
            </div>
            {models.length ? (
              <div className="mmd-vr-prep-models">
                {models.map((model, index) => {
                  const path = relativePath(model);
                  const selected = selectedPaths.includes(path);
                  return (
                    <div key={path} className={selected ? "mmd-vr-prep-model is-selected" : "mmd-vr-prep-model"}>
                      <span>{String(index + 1).padStart(2, "0")}</span>
                      <button type="button" className="mmd-vr-prep-model-info" onClick={() => toggleModel(path)}>
                        <strong>{model.name}</strong>
                        <small>{path}</small>
                      </button>
                      <Icon icon={selected ? "solar:check-circle-bold" : "solar:add-circle-linear"} width={20} height={20} />
                      <button type="button" className="mmd-vr-prep-icon-btn mmd-vr-prep-remove" aria-label={t("mmdVrPrepRemoveFile")} onClick={() => removeImportedFile(path)}>
                        <Icon icon="solar:trash-bin-trash-linear" width={18} height={18} />
                      </button>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="mmd-vr-prep-empty">{files.length ? t("mmdVrPrepNoModels") : t("mmdVrPrepAwaiting")}</div>
            )}
          </section>

          <section className="mmd-vr-prep-section">
            <div className="mmd-vr-prep-section-head">
              <div>
                <div className="mmd-vr-prep-section-eyebrow">03 / {t("mmdVrPrepSectionEnvironment")}</div>
                <strong>{t("mmdVrPrepObjects")}</strong>
                <span>{t("mmdVrPrepObjectLimit").replace("{count}", String(MMD_VR_MAX_OBJECTS))}</span>
              </div>
              <b>{selectedObjects.length}/{MMD_VR_MAX_OBJECTS}</b>
            </div>
            {objects.length ? (
              <div className="mmd-vr-prep-models">
                {objects.map((object, index) => {
                  const path = relativePath(object);
                  const selected = selectedObjectPaths.includes(path);
                  return (
                    <div key={path} className={selected ? "mmd-vr-prep-model is-selected" : "mmd-vr-prep-model"}>
                      <span>{String(index + 1).padStart(2, "0")}</span>
                      <button type="button" className="mmd-vr-prep-model-info" onClick={() => toggleObject(path)}>
                        <strong>{object.name}</strong>
                        <small>{path}</small>
                      </button>
                      <Icon icon={selected ? "solar:check-circle-bold" : "solar:add-circle-linear"} width={20} height={20} />
                      <button type="button" className="mmd-vr-prep-icon-btn mmd-vr-prep-remove" aria-label={t("mmdVrPrepRemoveFile")} onClick={() => removeImportedFile(path)}>
                        <Icon icon="solar:trash-bin-trash-linear" width={18} height={18} />
                      </button>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="mmd-vr-prep-empty">{files.length ? t("mmdVrPrepNoObjects") : t("mmdVrPrepAwaiting")}</div>
            )}
          </section>

          <section className="mmd-vr-prep-motion-grid">
            <div className="mmd-vr-prep-motion-heading">
              <div className="mmd-vr-prep-section-eyebrow">04 / {t("mmdVrPrepSectionPlayback")}</div>
              <strong>{t("mmdVrPrepMotionHint")}</strong>
            </div>
            <label>
              <span>{t("mmdVrPrepBodyMotion")}</span>
              <select value={bodyMotionPath} onChange={(event) => setBodyMotionPath(event.target.value)}>
                <option value="">{t("mmdVrPrepNoMotion")}</option>
                {motions.map((motion) => <option key={relativePath(motion)} value={relativePath(motion)}>{motion.name}</option>)}
              </select>
            </label>
            <label>
              <span>{t("mmdVrPrepFaceMotion")}</span>
              <select value={faceMotionPath} onChange={(event) => setFaceMotionPath(event.target.value)}>
                <option value="">{t("mmdVrPrepNoMotion")}</option>
                {motions.map((motion) => <option key={relativePath(motion)} value={relativePath(motion)}>{motion.name}</option>)}
              </select>
            </label>
          </section>

          <details className="mmd-vr-prep-config" open>
            <summary>
              <div>
                <strong>{t("mmdVrPrepRuntimeConfig")}</strong>
                <span>{formatMmdVrProfileSummary(getMmdVrRenderProfile(prefs), language)}</span>
              </div>
              <Icon icon="solar:alt-arrow-down-linear" width={18} height={18} />
            </summary>
            <div className="mmd-vr-prep-config-body">
              <p>{t("diagPrepHint")}</p>
              <div className="mmd-vr-prep-config-row">
                <span>{t("settingsMmdVrQuestPreset")}</span>
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
              <div className="mmd-vr-prep-config-row">
                <span>{t("settingsAccent")}</span>
                <div className="mmd-vr-theme-swatches" role="group" aria-label={t("settingsAccent")}>
                  {ACCENT_COLORS.map((color) => {
                    const labelKey = `accent${color[0].toUpperCase()}${color.slice(1)}` as TranslationKey;
                    return (
                      <button
                        key={color}
                        type="button"
                        className={themeSettings.accentColor === color ? "is-active" : ""}
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
              <details className="mmd-vr-prep-advanced">
                <summary>{t("settingsMmdVrAdvancedConfig")}</summary>
                <div className="mmd-vr-prep-config-row">
                  <span>{t("settingsVrDesktopQuality")}</span>
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
                <div className="mmd-vr-prep-config-row">
                  <span>{t("settingsVrDesktopDpr")}</span>
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
                <div className="mmd-vr-prep-config-row">
                  <span>{t("settingsVrDesktopFrameRate")}</span>
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
                <details className="mmd-vr-prep-advanced">
                  <summary>{t("settingsMmdVrExperimentalRendering")}</summary>
                  <label className="mmd-vr-prep-toggle">
                    <span>{t("settingsMmdVrEnableRenderOverrides")}</span>
                    <input type="checkbox" checked={prefs.advancedRenderOverrides} onChange={(event) => setPrefs({ advancedRenderOverrides: event.target.checked })} />
                  </label>
                  <div className="mmd-vr-prep-config-row">
                    <span>{t("settingsVrDesktopFramebufferScale")}</span>
                    <OptionGroup
                      value={prefs.framebufferScalePref}
                      options={[{ id: "auto", label: t("settingsVrDesktopQualityAuto") }, { id: "0.7", label: "70%" }, { id: "0.85", label: "85%" }, { id: "1", label: "100%" }]}
                      onChange={(framebufferScalePref) => setPrefs({ framebufferScalePref, advancedRenderOverrides: true })}
                    />
                  </div>
                  <div className="mmd-vr-prep-config-row">
                    <span>{t("settingsVrDesktopFoveation")}</span>
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
                </details>
                <div className="mmd-vr-prep-config-row">
                  <span>{t("settingsVrDesktopAntialias")}</span>
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
                <div className="mmd-vr-prep-config-row">
                  <span>{t("settingsMmdVrShadows")}</span>
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
                <div className="mmd-vr-prep-config-row">
                  <span>{t("settingsMmdVrShadowResolution")}</span>
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
                <div className="mmd-vr-prep-config-row">
                  <span>{t("settingsMmdVrGrid")}</span>
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
                <div className="mmd-vr-prep-config-row">
                  <span>{t("settingsMmdVrWalkSpeed")}</span>
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
                <label className="mmd-vr-prep-toggle">
                  <span>{t("settingsVrDesktopShowFps")}</span>
                  <input
                    type="checkbox"
                    checked={prefs.showFps}
                    onChange={(event) => setPrefs({ showFps: event.target.checked })}
                  />
                </label>
                <label className="mmd-vr-prep-toggle">
                  <span>{t("settingsMmdVrDetailedPhysicsDiagnostics")}</span>
                  <input type="checkbox" checked={prefs.detailedPhysicsDiagnostics} onChange={(event) => setPrefs({ detailedPhysicsDiagnostics: event.target.checked })} />
                </label>
                {highLoadConfig ? <p className="mmd-vr-prep-warning">{t("settingsMmdVrHighLoadWarning")}</p> : null}
                <p>{t("settingsVrDesktopQualityHint")}</p>
              </details>
            </div>
          </details>

           {errorMessage ? <section className="mmd-vr-prep-error" role="alert">
             <p>{t("loadEnterFailed")}</p>
             <p>{t("loadEnterRecovery")}</p>
             <details><summary>{t("loadDetails")}</summary><pre>{errorMessage}</pre></details>
           </section> : null}
           {assetLoad.failures.length > 0 ? <details className="mmd-load-report">
             <summary>{t("loadDetails")} ({assetLoad.failures.length})</summary>
             <p>{t("loadReenterHint")}</p>
             <ul>{assetLoad.failures.map((failure) => <li key={failure.id}><strong>{failure.fileName}</strong><pre>{failure.message}</pre></li>)}</ul>
           </details> : null}
          <p className="mmd-vr-prep-enter-hint"><Icon icon="solar:info-circle-linear" width={16} height={16} />{t("mmdVrPrepEnterHint")}</p>
          {savedStage && savedStage.assets.length > 0 ? <section className="mmd-import-report">
            <p>{t("stageResumeHint")} · {Math.floor(savedStage.time / 60)}:{String(Math.floor(savedStage.time % 60)).padStart(2, "0")}</p>
            <button type="button" className="mmd-vr-prep-enter" disabled={importing || readiness === "insecure" || readiness === "no-xr" || phase === "entering" || phase === "active"} onClick={() => enterVr(true)}>{t("stageContinue")}</button>
          </section> : null}
          <button
            type="button"
            className="mmd-vr-prep-enter"
             disabled={importing || checkingAssets || (!selectedModels.length && !selectedObjects.length) || readiness === "insecure" || readiness === "no-xr" || phase === "entering" || phase === "active"}
            onClick={() => enterVr(false)}
          >
            <Icon icon="boxicons:vr-headset-filled" width={22} height={22} />
            <span>{phase === "entering" ? t("settingsMmdVrEntering") : savedStage ? t("stageRestart") : t("settingsMmdVrEnter")}</span>
            <Icon icon="solar:arrow-right-linear" width={20} height={20} />
          </button>
        </div>
      </section>
      <MmdVrOverlay />
    </main>
  );
}
