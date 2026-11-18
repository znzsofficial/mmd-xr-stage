import { GLTFLoader } from "three-stdlib";
import { LoadingManager } from "three";
import { createCompanionIndex } from "../mmdImport/assetPaths";

/**
 * Best-effort normalization of a resource URL requested by GLTFLoader.
 * glTF JSON may reference "model.bin", "./textures/a.png" or data/http URIs.
 * Blob/data/http URIs are absolute and passed through untouched.
 */
export function normalizeGltfResourcePath(requested: string): string {
  if (requested.startsWith("blob:") || requested.startsWith("data:") || /^[a-z][a-z0-9+.-]*:\/\//i.test(requested)) {
    return requested;
  }
  return requested.split(/[?#]/)[0].replace(/^\.\//, "");
}

/**
 * Maps glTF-referenced relative paths to prebuilt blob URLs (companion files).
 * Returns the original URL when nothing matches so loaders fail with a clear error.
 */
export function createGltfResourceMapper(
  files: readonly { path: string; url: string }[],
): (requested: string) => string {
  const byPath = new Map(files.map((file) => [file.path, file.url]));
  return (requested) => {
    const key = normalizeGltfResourcePath(requested);
    const direct = key && byPath.get(key);
    if (direct) return direct;
    if (key) {
      for (const [path, url] of byPath) {
        if (path.endsWith(`/${key}`)) return url;
      }
    }
    return requested;
  };
}

export type MmdVrGltfLoaderHandle = {
  loader: GLTFLoader;
  url: string;
  revoke: () => void;
};

/**
 * Creates a GLTFLoader for a single environment object.
 * - `.glb`: self-contained, loaded straight from a blob URL.
 * - `.gltf`: external buffers/textures are resolved against same-directory
 *   companion files through a URL modifier.
 * Caller owns the returned object URL and must call `revoke()` on removal.
 */
export function createMmdVrGltfLoader(file: File, companions: readonly File[]): MmdVrGltfLoaderHandle {
  const urls: string[] = [];
  const urlsByFile = new Map<File, string>();
  function makeUrl(source: File) {
    const existing = urlsByFile.get(source);
    if (existing) return existing;
    const url = URL.createObjectURL(source);
    urls.push(url);
    urlsByFile.set(source, url);
    return url;
  }

  const url = makeUrl(file);
  const resolve = createCompanionIndex([file, ...companions]);

  const loader = new GLTFLoader(new LoadingManager());
  loader.setResourcePath("./");
  if (companions.length) {
    loader.manager.setURLModifier((requested) => {
      if (/^(blob:|data:|https?:)/i.test(requested)) return requested;
      let reference = normalizeGltfResourcePath(requested);
      try { reference = decodeURIComponent(reference); } catch { /* Retain literal malformed escapes. */ }
      const { matches } = resolve(file, reference);
      return matches.length === 1 ? makeUrl(matches[0]) : requested;
    });
  }
  return {
    loader,
    url,
    revoke: () => {
      for (const url of urls) URL.revokeObjectURL(url);
      urls.length = 0; urlsByFile.clear();
    },
  };
}
