/** Recursively collect files from a dropped directory without loading MMD runtime code. */
export async function collectFilesFromDataTransfer(dataTransfer: DataTransfer): Promise<File[]> {
  const items = Array.from(dataTransfer.items ?? []);
  if (!items.length) return Array.from(dataTransfer.files ?? []);
  const files: File[] = [];

  async function walk(entry: FileSystemEntry | null): Promise<void> {
    if (!entry) return;
    if (entry.isFile) {
      const file = await new Promise<File | null>((resolve) => {
        (entry as FileSystemFileEntry).file(resolve, () => resolve(null));
      });
      if (!file) return;
      const withPath = new File([file], file.name, { type: file.type, lastModified: file.lastModified });
      Object.defineProperty(withPath, "webkitRelativePath", { value: entry.fullPath.replace(/^\//, "") });
      files.push(withPath);
      return;
    }
    const reader = (entry as FileSystemDirectoryEntry).createReader();
    const readBatch = () => new Promise<FileSystemEntry[]>((resolve, reject) => reader.readEntries(resolve, reject));
    for (let batch = await readBatch(); batch.length; batch = await readBatch()) {
      for (const child of batch) await walk(child);
    }
  }

  for (const item of items) {
    const entry = item.webkitGetAsEntry?.() ?? null;
    if (entry) await walk(entry);
    else {
      const file = item.getAsFile();
      if (file) files.push(file);
    }
  }
  return files.length ? files : Array.from(dataTransfer.files ?? []);
}

export function relativePath(file: File) {
  return ((file as File & { webkitRelativePath?: string }).webkitRelativePath || file.name).replaceAll("\\", "/");
}

export function relativeDir(file: File) {
  const path = relativePath(file);
  const slash = path.lastIndexOf("/");
  return slash < 0 ? "" : path.slice(0, slash);
}

export function listMmdModels(files: readonly File[]) {
  return files.filter((file) => /\.(pmx|pmd)$/i.test(file.name)).sort((a, b) => relativePath(a).localeCompare(relativePath(b), "zh"));
}

export function listMmdObjects(files: readonly File[]) {
  return files.filter((file) => /\.(gltf|glb)$/i.test(file.name)).sort((a, b) => relativePath(a).localeCompare(relativePath(b), "zh"));
}

export function listMmdMotions(files: readonly File[]) {
  return files.filter((file) => /\.(vmd|vpd)$/i.test(file.name)).sort((a, b) => relativePath(a).localeCompare(relativePath(b), "zh"));
}

export function companionsForModel(model: File, files: readonly File[]) {
  const dir = relativeDir(model);
  if (!dir) return files.length ? [...files] : [model];
  const prefix = `${dir}/`;
  const matches = files.filter((file) => relativePath(file).startsWith(prefix));
  return matches.length > 1 ? matches : files.length ? [...files] : [model];
}

/** Same-dir companion grouping for glTF/GLB objects (bin / textures). */
export function companionsForObject(object: File, files: readonly File[]) {
  return companionsForModel(object, files);
}
