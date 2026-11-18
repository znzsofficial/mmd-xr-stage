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

export function createCompanionIndex(files: readonly File[]) {
  const members = new Set(files);
  const byPath = new Map<string, File[]>(), byName = new Map<string, File[]>();
  function add(map: Map<string, File[]>, key: string, f: File) {
    const list = map.get(key); if (list) list.push(f); else map.set(key, [f]);
  }
  for (const f of members) {
    const path = normalizeAssetPath(relativePath(f));
    if (path) add(byPath, path.toLowerCase(), f);
    add(byName, f.name.toLowerCase(), f);
  }
  return (model: File, reference: string) => {
    const bound = companionBindings.get(model)?.get(referenceKey(reference));
    if (bound && members.has(bound)) return { matches: [bound], fallback: false };
    const directory = relativePath(model).split("/").slice(0, -1).join("/");
    const root = packageRoots.get(model);
    const target = normalizeAssetPath(`${directory ? `${directory}/` : ""}${reference}`)?.toLowerCase();
    if (!target || (root && !target.startsWith(`${root.toLowerCase()}/`))) return { matches: [], fallback: false };
    const exact = byPath.get(target) ?? [];
    const samePackage = (f: File) => !root || packageRoots.get(f) === root;
    const local = exact.filter(samePackage);
    if (local.length) return { matches: local, fallback: false };
    const loose = exact.filter(f => !packageRoots.has(f));
    if (loose.length) return { matches: loose, fallback: false };
    const basename = reference.replaceAll("\\", "/").split("/").at(-1)!.toLowerCase();
    return { matches: (byName.get(basename) ?? []).filter(samePackage), fallback: true };
  };
}

export function resolveCompanion(model: File, reference: string, files: readonly File[]) {
  return createCompanionIndex(files)(model, reference);
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
