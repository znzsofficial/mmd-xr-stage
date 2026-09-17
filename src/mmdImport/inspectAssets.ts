import { listMmdModels, listMmdMotions, listMmdObjects, relativePath } from "./folderFiles";
import { resolveCompanion } from "./assetPaths";

export type ImportIssue = { kind: "missing" | "ambiguous" | "fallback" | "invalid"; file: string; reference: string };
export type ImportReport = { models: number; motions: number; objects: number; textures: number; issues: ImportIssue[] };

export async function readModelTextureReferences(file: File): Promise<string[]> {
  const { parsePmxSectionInventory, parsePmdSectionInventory } = await import("@yohawing/three-mmd-loader/parser");
  const bytes = new Uint8Array(await file.arrayBuffer());
  if (/\.pmx$/i.test(file.name)) {
    const inventory = parsePmxSectionInventory(bytes);
    const section = inventory.sections.find((section) => section.name === "textures")!;
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    const decoder = new TextDecoder(inventory.header.encoding === "utf-8" ? "utf-8" : "utf-16le");
    let offset = section.offset;
    return Array.from({ length: section.count }, () => {
      const length = view.getInt32(offset, true);
      offset += 4;
      if (length < 0 || offset + length > section.offset + section.byteLength) throw new Error("Invalid texture section");
      const path = decoder.decode(bytes.subarray(offset, offset + length));
      offset += length;
      return path;
    }).filter(Boolean);
  }
  const inventory = parsePmdSectionInventory(bytes);
  const section = inventory.sections.find((section) => section.name === "materials")!;
  const decode = (offset: number, size: number) => {
    const text = bytes.subarray(offset, offset + size);
    const end = text.indexOf(0);
    return new TextDecoder("shift-jis").decode(end < 0 ? text : text.subarray(0, end)).trim();
  };
  const paths = Array.from({ length: section.count }, (_, i) => decode(section.offset + i * 70 + 50, 20)).flatMap((path) => path.split("*"));
  const toon = inventory.sections.find((section) => section.name === "toonTextures");
  if (toon) paths.push(...Array.from({ length: toon.count }, (_, i) => decode(toon.offset + i * 100, 100)).filter((path) => !/^toon(?:0[1-9]|10)\.bmp$/i.test(path)));
  return [...new Set(paths.filter(Boolean))];
}

export async function inspectAssets(files: readonly File[], signal?: AbortSignal): Promise<ImportReport> {
  const models = listMmdModels(files);
  const objects = listMmdObjects(files);
  const issues: ImportIssue[] = [];
  for (const file of [...models, ...objects.filter((file) => /\.gltf$/i.test(file.name))]) {
    signal?.throwIfAborted();
    try {
      let references: string[];
      if (/\.gltf$/i.test(file.name)) {
        const json = JSON.parse(await file.text());
        references = [...(json.buffers ?? []), ...(json.images ?? [])].map((entry) => entry.uri).filter((uri): uri is string => typeof uri === "string" && !/^(data:|https?:)/i.test(uri))
          .map((uri) => { try { return decodeURIComponent(uri.split(/[?#]/)[0]); } catch { return uri; } });
      } else references = await readModelTextureReferences(file);
      signal?.throwIfAborted();
      for (const reference of references) {
        const { matches, fallback } = resolveCompanion(file, reference, files);
        if (matches.length === 0) issues.push({ kind: "missing", file: relativePath(file), reference });
        else if (matches.length > 1) issues.push({ kind: "ambiguous", file: relativePath(file), reference });
        else if (fallback) issues.push({ kind: "fallback", file: relativePath(file), reference });
      }
    } catch (error) {
      if (signal?.aborted) throw error;
      issues.push({ kind: "invalid", file: relativePath(file), reference: error instanceof Error ? error.message : String(error) });
    }
  }
  return { models: models.length, objects: objects.length, motions: listMmdMotions(files).length,
    textures: files.filter((file) => /\.(png|jpe?g|bmp|tga|webp|spa|sph)$/i.test(file.name)).length, issues };
}
