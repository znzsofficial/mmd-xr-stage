import type { MmdVrModelSlot } from "./mmdVrAssets";
import type { MmdRuntimeHandle, MmdModelTransform } from "./mmdRuntime/mmdRuntime";
import { applySavedModel, type SavedModel } from "./stageSnapshot";

/** Owns one model across texture retries; successful unrelated models stay intact. */
export function createModelLoadTask(runtime: MmdRuntimeHandle, slot: MmdVrModelSlot, options: {
  transform: Partial<MmdModelTransform>;
  saved?: SavedModel;
  companions?: () => readonly File[];
  physicsEnabled: () => boolean;
  isStale: () => boolean;
}) {
  let modelId: string | null = null;
  let restore = options.saved;
  return {
    get modelId() { return modelId; },
    async load() {
      if (options.isStale()) return;
      if (modelId) {
        const old = runtime.exportProjectModels().find((entry) => entry.id === modelId);
        if (old) restore = { file: old.modelFile, transform: old.transform, visible: old.visible,
          materialVisible: old.materialVisible, materialOverrides: old.materialOverrides };
      }
      const report = await runtime.addModel(slot.modelFile, options.companions?.() ?? slot.companionFiles, {
        physics: options.physicsEnabled(), transform: restore?.transform ?? options.transform, isStale: options.isStale,
      });
      try {
        if (options.isStale()) throw new DOMException("Stage changed", "AbortError");
        if (restore) applySavedModel(runtime, report.modelId, restore);
      } catch (error) {
        runtime.removeModel(report.modelId);
        throw error;
      }
      // Commit replacement only after the repaired copy has loaded and restored.
      if (modelId) runtime.removeModel(modelId);
      modelId = report.modelId;
      return [...new Set([...report.missingTextures, ...report.textureWarnings])];
    },
    loadMotion(file: File, phase: "body" | "face") {
      if (!modelId) return Promise.reject(new Error("Model not loaded"));
      return runtime.loadMotion(file, phase, modelId, options.isStale);
    },
  };
}
