import type { MmdVrModelSlot } from "./mmdVrAssets";
import type { MmdRuntimeHandle, MmdModelTransform } from "./mmdRuntime/mmdRuntime";
import { applySavedModel, type SavedModel } from "./stageSnapshot";

/** Owns one model across texture retries; successful unrelated models stay intact. */
export function createModelLoadTask(runtime: MmdRuntimeHandle, slot: MmdVrModelSlot, options: {
  transform: Partial<MmdModelTransform>;
  saved?: SavedModel;
  physicsEnabled: () => boolean;
  isStale: () => boolean;
}) {
  let modelId: string | null = null;
  let restore = options.saved;
  return {
    async load() {
      if (modelId) {
        const old = runtime.exportProjectModels().find((entry) => entry.id === modelId);
        if (old) restore = { file: old.modelFile, transform: old.transform, visible: old.visible,
          materialVisible: old.materialVisible, materialOverrides: old.materialOverrides };
        runtime.removeModel(modelId);
        modelId = null;
      }
      const report = await runtime.addModel(slot.modelFile, slot.companionFiles, {
        physics: options.physicsEnabled(), transform: restore?.transform ?? options.transform,
      });
      modelId = report.modelId;
      if (options.isStale()) {
        runtime.removeModel(modelId);
        modelId = null;
        return;
      }
      if (restore) applySavedModel(runtime, modelId, restore);
      return [...new Set([...report.missingTextures, ...report.textureWarnings])];
    },
    loadMotion(file: File, phase: "body" | "face") {
      if (!modelId) return Promise.reject(new Error("Model not loaded"));
      return runtime.loadMotion(file, phase, modelId);
    },
  };
}
