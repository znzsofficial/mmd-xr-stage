import { GLTFLoader } from "three-stdlib";
import { LoadingManager } from "three";
import { createCompanionIndex } from "../../../mmdImport/assetPaths";

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
  readonly resourceError: Error | null;
  revoke: () => void;
};

/**
 * Creates a GLTFLoader for a single environment object.
 * - `.glb`: self-contained, loaded straight from a blob URL.
 * - `.gltf`: external buffers/textures are resolved against same-directory
 *   companion files through a URL modifier.
 * The caller releases request URLs once loadAsync settles. Decoded textures,
 * buffers and the page's original Files have separate lifetimes.
 */
export function createMmdVrGltfLoader(file: File, companions: readonly File[]): MmdVrGltfLoaderHandle {
  const urlsByFile = new Map<File, string>();
  function makeUrl(source: File) {
    const existing = urlsByFile.get(source);
    if (existing) return existing;
    const url = URL.createObjectURL(source);
    urlsByFile.set(source, url);
    return url;
  }

  const url = makeUrl(file);
  let resolve: ReturnType<typeof createCompanionIndex> | undefined;
  let resourceError: Error | null = null;

  const loader = new GLTFLoader(new LoadingManager());
  loader.setResourcePath("./");
  loader.manager.setURLModifier((requested) => {
    if (/^(blob:|data:|https?:|\/\/)/i.test(requested)) return requested;
    // A self-contained GLB never needs a second index of the backpack.
    resolve ??= createCompanionIndex([file, ...companions]);
    let reference = normalizeGltfResourcePath(requested);
    try { reference = decodeURIComponent(reference); } catch { /* Retain literal malformed escapes. */ }
    const { matches } = resolve(file, reference);
    if (matches.length === 1) return makeUrl(matches[0]);
    // GLTFLoader tolerates a rejected image and returns a plain material. Do
    // not report that as a successful placement or fetch a local name by HTTP.
    resourceError ??= new Error(`${matches.length ? 'Ambiguous' : 'Missing'} glTF resource: ${reference}`);
    throw resourceError;
  });
  loader.manager.onError = requested => {
    const source = [...urlsByFile].find(([, url]) => url === requested)?.[0];
    resourceError ??= new Error(`Failed to load glTF resource: ${source?.name ?? (/^(?:blob|data):/i.test(requested) ? file.name : requested)}`);
  };
  return {
    loader,
    url,
    get resourceError() { return resourceError; },
    revoke: () => {
      loader.manager.setURLModifier(); // detach resolver and do not mint URLs for late requests
      for (const url of urlsByFile.values()) URL.revokeObjectURL(url);
      urlsByFile.clear(); resolve = undefined;
    },
  };
}
