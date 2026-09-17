import { normalizeAssetPath, withAssetPath } from "./assetPaths";

export type ArchiveEncoding = "auto" | "shift-jis" | "gbk";
export type ImportProgress = { archive: string; file: string; completed: number; total: number };
export const IMPORT_LIMITS = { entries: 4096, fileBytes: 256 * 1024 * 1024, totalBytes: 512 * 1024 * 1024 };

export class AssetImportError extends Error {
  constructor(readonly code: "path" | "limit" | "encrypted" | "archive", readonly file: string, detail = "") {
    super(detail || code);
    this.name = "AssetImportError";
  }
}

export async function expandAssetFiles(input: readonly File[], options: {
  signal?: AbortSignal;
  encoding?: ArchiveEncoding;
  onProgress?: (progress: ImportProgress) => void;
  limits?: typeof IMPORT_LIMITS;
} = {}): Promise<File[]> {
  const limits = options.limits ?? IMPORT_LIMITS;
  const files: File[] = [];
  let count = 0;
  let bytes = 0;
  const check = (size: number, file: string) => {
    if (++count > limits.entries || size > limits.fileBytes || bytes + size > limits.totalBytes) throw new AssetImportError("limit", file);
  };
  for (const file of input) {
    options.signal?.throwIfAborted();
    if (!/\.zip$/i.test(file.name)) {
      check(file.size, file.name);
      bytes += file.size;
      files.push(file);
      continue;
    }
    if (file.size > limits.totalBytes) throw new AssetImportError("limit", file.name);
    const { ZipReader, BlobReader, ERR_UNSAFE_FILENAME } = await import("@zip.js/zip.js");
    const reader = new ZipReader(new BlobReader(file), {
      filenameEncoding: options.encoding === "auto" ? undefined : options.encoding,
    });
    try {
      const entries = [];
      for await (const entry of reader.getEntriesGenerator()) {
        options.signal?.throwIfAborted();
        if (entries.length >= limits.entries) throw new AssetImportError("limit", file.name);
        entries.push(entry);
      }
      let completed = 0;
      const total = entries.filter((entry) => !entry.directory).length;
      for (const entry of entries) {
        options.signal?.throwIfAborted();
        if (entry.directory) continue;
        const path = normalizeAssetPath(entry.filename);
        if (!path || entry.filename.replaceAll("\\", "/").split("/").includes("..")) throw new AssetImportError("path", entry.filename);
        if (path.startsWith("__MACOSX/") || path.endsWith(".DS_Store")) continue;
        if (entry.encrypted) throw new AssetImportError("encrypted", entry.filename);
        check(entry.uncompressedSize, entry.filename);
        options.onProgress?.({ archive: file.name, file: path, completed, total });
        let entryBytes = 0;
        const chunks: BlobPart[] = [];
        await entry.getData(new WritableStream<Uint8Array>({ write(chunk) {
          entryBytes += chunk.byteLength;
          bytes += chunk.byteLength;
          if (entryBytes > limits.fileBytes || bytes > limits.totalBytes) throw new AssetImportError("limit", entry.filename);
          chunks.push(new Uint8Array(chunk));
        } }), { signal: options.signal, checkSignature: true, useWebWorkers: false });
        const extracted = new File(chunks, path.split("/").at(-1)!, { lastModified: file.lastModified });
        files.push(withAssetPath(extracted, `${file.name}/${path}`, file.name));
        completed += 1;
      }
    } catch (error) {
      if (error instanceof AssetImportError || options.signal?.aborted) throw error;
      if (error instanceof Error && error.message === ERR_UNSAFE_FILENAME) throw new AssetImportError("path", file.name, error.message);
      throw new AssetImportError("archive", file.name, error instanceof Error ? error.message : String(error));
    } finally { await reader.close(); }
  }
  return files;
}
