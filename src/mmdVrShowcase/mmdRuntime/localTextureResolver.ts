import type { TextureResolver } from "@yohawing/three-mmd-loader";
import { createCompanionIndex } from "../../mmdImport/assetPaths";

export function createLocalTextureResolver(modelFile: File, companionFiles: readonly File[] = []): TextureResolver {
  const files = companionFiles.length ? companionFiles : [modelFile];
  let resolve = createCompanionIndex(files), count = files.length;
  return { async resolve(path) {
    if (count !== files.length) { resolve = createCompanionIndex(files); count = files.length; }
    const { matches } = resolve(modelFile, path);
    return matches.length === 1 ? matches[0] : undefined;
  } };
}
