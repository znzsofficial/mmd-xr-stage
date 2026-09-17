import { describe, expect, it } from "vitest";
import { BlobWriter, TextReader, ZipWriter } from "@zip.js/zip.js";
import { expandAssetFiles, IMPORT_LIMITS } from "./importArchive";
import { relativePath } from "./folderFiles";
import { bindCompanion, mergeAssetFiles, resolveCompanion, withAssetPath } from "./assetPaths";

async function archive(name: string, entries: [string, string][], password?: string) {
  const writer = new ZipWriter(new BlobWriter(), { useWebWorkers: false });
  for (const [path, text] of entries) await writer.add(path, new TextReader(text), password ? { password } : {});
  return new File([await writer.close()], name);
}

describe("ZIP import", () => {
  it("preserves Unicode paths and keeps packages with identical texture names isolated", async () => {
    const first = await archive("舞台.zip", [["角色/model.pmx", "pmx"], ["角色/贴图/脸.png", "first"]]);
    const second = await archive("other.zip", [["角色/model.pmx", "pmx"], ["角色/贴图/脸.png", "second"]]);
    const files = await expandAssetFiles([first, second]);
    expect(files.map(relativePath)).toContain("舞台.zip/角色/贴图/脸.png");
    const model = files.find((file) => relativePath(file) === "舞台.zip/角色/model.pmx")!;
    const result = resolveCompanion(model, "贴图\\脸.png", files);
    expect(result.fallback).toBe(false);
    expect(await result.matches[0].text()).toBe("first");
    expect(await resolveCompanion(model, "wrong/脸.png", files).matches[0].text()).toBe("first");
    expect(resolveCompanion(model, "../../other.zip/角色/贴图/脸.png", files).matches).toHaveLength(0);
  });

  it("reports duplicate normalized paths and keeps the existing File object", () => {
    const old = withAssetPath(new File(["old"], "face.png"), "model/face.png");
    const next = withAssetPath(new File(["new"], "FACE.png"), "model/FACE.png");
    const merged = mergeAssetFiles([old], [next]);
    expect(merged.files).toEqual([old]);
    expect(merged.conflicts).toEqual(["model/FACE.png"]);
    expect(merged.accepted).toEqual([]);
  });

  it("accepts an exact loose supplement and an explicit binding without crossing ZIP boundaries", async () => {
    const zip = await archive("model.zip", [["model/model.pmx", "pmx"]]);
    const [model] = await expandAssetFiles([zip]);
    const exact = withAssetPath(new File(["texture"], "face.png"), "model.zip/model/face.png");
    expect(resolveCompanion(model, "face.png", [model, exact]).matches).toEqual([exact]);
    const other = withAssetPath(new File(["other"], "face.png"), "other.zip/face.png", "other.zip");
    expect(resolveCompanion(model, "face.png", [model, other]).matches).toEqual([]);
    const loose = new File(["chosen"], "replacement.png");
    bindCompanion(model, "textures/face.png", loose);
    expect(resolveCompanion(model, "textures\\face.png", [model, loose, other]).matches).toEqual([loose]);
    expect(resolveCompanion(model, "textures/face.png", [model, other]).matches).toEqual([]);
  });

  it("rejects traversal entries before extracting content", async () => {
    const zip = await archive("bad.zip", [["../escape.pmx", "x"]]);
    await expect(expandAssetFiles([zip])).rejects.toMatchObject({ code: "path" });
  });

  it("enforces file size, cumulative size and entry count budgets", async () => {
    const zip = await archive("large.zip", [["first.pmx", "123456"], ["second.pmx", "123456"]]);
    await expect(expandAssetFiles([zip], { limits: { ...IMPORT_LIMITS, fileBytes: 4 } })).rejects.toMatchObject({ code: "limit" });
    await expect(expandAssetFiles([zip], { limits: { ...IMPORT_LIMITS, entries: 1 } })).rejects.toMatchObject({ code: "limit" });
    const raw = [new File(["1234"], "a.pmx"), new File(["5678"], "b.pmx")];
    await expect(expandAssetFiles(raw, { limits: { ...IMPORT_LIMITS, totalBytes: 6 } })).rejects.toMatchObject({ code: "limit" });
  });

  it("rejects encrypted and truncated ZIPs with actionable categories", async () => {
    await expect(expandAssetFiles([await archive("secret.zip", [["a.pmx", "x"]], "password")])).rejects.toMatchObject({ code: "encrypted" });
    await expect(expandAssetFiles([new File(["not a zip"], "bad.zip")])).rejects.toMatchObject({ code: "archive" });
  });

  it("aborts without committing a partially extracted batch", async () => {
    const zip = await archive("models.zip", [["a.pmx", "first"], ["b.pmx", "second"]]);
    const abort = new AbortController();
    await expect(expandAssetFiles([zip], { signal: abort.signal, onProgress: () => abort.abort() })).rejects.toMatchObject({ name: "AbortError" });
  });
});
