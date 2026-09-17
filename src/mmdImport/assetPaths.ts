import { relativePath } from "./folderFiles";

const packageRoots = new WeakMap<File, string>();
const companionBindings = new WeakMap<File, Map<string, File>>();

const referenceKey = (value: string) => value.replaceAll("\\", "/").normalize("NFC").toLowerCase();

export function bindCompanion(model: File, reference: string, file: File) {
  let bindings = companionBindings.get(model);
  if (!bindings) companionBindings.set(model, bindings = new Map());
  bindings.set(referenceKey(reference), file);
}

export function normalizeAssetPath(path: string): string | null {
  const normalized = path.replaceAll("\\", "/").normalize("NFC");
  if (/^(?:\/|[a-z]+:)/i.test(normalized) || /[\x00-\x1f]/.test(normalized)) return null;
  const parts: string[] = [];
  for (const part of normalized.split("/")) {
    if (!part || part === ".") continue;
    if (part === "..") {
      if (!parts.length) return null;
      parts.pop();
    } else parts.push(part);
  }
  return parts.join("/");
}

export function withAssetPath(file: File, path: string, root?: string) {
  Object.defineProperty(file, "webkitRelativePath", { value: path, configurable: true });
  if (root) packageRoots.set(file, root);
  return file;
}

export function resolveCompanion(model: File, reference: string, files: readonly File[]) {
  const bound = companionBindings.get(model)?.get(referenceKey(reference));
  if (bound && files.includes(bound)) return { matches: [bound], fallback: false };
  const directory = relativePath(model).split("/").slice(0, -1).join("/");
  const root = packageRoots.get(model);
  const unique = [...new Set(files)];
  const candidates = root ? unique.filter((file) => packageRoots.get(file) === root) : unique;
  const target = normalizeAssetPath(`${directory ? `${directory}/` : ""}${reference}`)?.toLowerCase();
  if (!target || (root && !target.startsWith(`${root.toLowerCase()}/`))) return { matches: [] as File[], fallback: false };
  const exact = candidates.filter((file) => normalizeAssetPath(relativePath(file))?.toLowerCase() === target);
  if (exact.length) return { matches: exact, fallback: false };
  // Loose files may supplement an exact archive-relative path, never another ZIP.
  if (root) {
    const supplements = unique.filter((file) => !packageRoots.has(file) && normalizeAssetPath(relativePath(file))?.toLowerCase() === target);
    if (supplements.length) return { matches: supplements, fallback: false };
  }
  const basename = reference.replaceAll("\\", "/").split("/").at(-1)?.toLowerCase();
  return { matches: candidates.filter((file) => file.name.toLowerCase() === basename), fallback: true };
}

export function mergeAssetFiles(previous: readonly File[], incoming: readonly File[]) {
  const files = [...previous];
  const accepted: File[] = [];
  const paths = new Map(files.map((file) => [normalizeAssetPath(relativePath(file))?.toLowerCase(), file]));
  const conflicts: string[] = [];
  for (const file of incoming) {
    const path = normalizeAssetPath(relativePath(file));
    if (!path) { conflicts.push(relativePath(file)); continue; }
    const key = path.toLowerCase();
    if (paths.has(key)) {
      if (paths.get(key) !== file) conflicts.push(path);
      continue;
    }
    paths.set(key, file);
    files.push(file);
    accepted.push(file);
  }
  return { files, conflicts, accepted };
}
