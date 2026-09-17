import type { TranslationKey } from "../languageStore";
import type { AssetLoadPhase, AssetLoadProgress } from "./mmdAssetLoadQueue";

const labels: Record<AssetLoadPhase, TranslationKey> = {
  model: "loadModel", body: "loadBody", face: "loadFace", object: "loadObject",
};

export function formatAssetProgress(progress: AssetLoadProgress, t: (key: TranslationKey) => string) {
  return progress.running && progress.phase
    ? `${t(labels[progress.phase])} · ${progress.completed + 1}/${progress.total}`
    : progress.failures.length ? `${t("loadPartial")} (${progress.failures.length})` : t("loadComplete");
}

/** Every character remains accessible through pages, including long paths. */
export function paginateLoadDetails(text: string, columns = 40, rows = 5) {
  const lines = text.split("\n").flatMap((line) => {
    const chars = Array.from(line);
    if (!chars.length) return [""];
    return Array.from({ length: Math.ceil(chars.length / columns) }, (_, index) => chars.slice(index * columns, (index + 1) * columns).join(""));
  });
  return Array.from({ length: Math.max(1, Math.ceil(lines.length / rows)) }, (_, index) => lines.slice(index * rows, (index + 1) * rows));
}
