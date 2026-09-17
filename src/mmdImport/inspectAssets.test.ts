import { describe, expect, it } from "vitest";
import { inspectAssets, readModelTextureReferences } from "./inspectAssets";
import { resolveCompanion, withAssetPath } from "./assetPaths";

function pmx(textures: string[]) {
  const parts: Uint8Array[] = [];
  const int = (value: number) => { const bytes = new Uint8Array(4); new DataView(bytes.buffer).setInt32(0, value, true); parts.push(bytes); };
  const text = (value: string) => { const bytes = new TextEncoder().encode(value); int(bytes.length); parts.push(bytes); };
  parts.push(new TextEncoder().encode("PMX "));
  const version = new Uint8Array(4); new DataView(version.buffer).setFloat32(0, 2, true); parts.push(version);
  parts.push(new Uint8Array([8, 1, 0, 1, 1, 1, 1, 1, 1]));
  for (let i = 0; i < 4; i++) text("");
  int(0); int(0); int(textures.length);
  textures.forEach(text);
  for (let i = 0; i < 6; i++) int(0);
  return withAssetPath(new File(parts as BlobPart[], "model.pmx"), "package/models/model.pmx");
}

describe("asset preflight", () => {
  it("reads actual PMX texture references including parent-relative paths", async () => {
    const model = pmx(["../textures/顔.png"]);
    expect(await readModelTextureReferences(model)).toEqual(["../textures/顔.png"]);
    const texture = withAssetPath(new File(["png"], "顔.png"), "package/textures/顔.png");
    expect((await inspectAssets([model, texture])).issues).toEqual([]);
    expect((await inspectAssets([model])).issues).toEqual([{ kind: "missing", file: "package/models/model.pmx", reference: "../textures/顔.png" }]);
  });

  it("reads PMD material textures without treating bundled toon textures as missing", async () => {
    const bytes = new Uint8Array(3 + 4 + 20 + 256 + 4 + 4 + 4 + 70 + 2 + 2 + 2);
    bytes.set(new TextEncoder().encode("Pmd"));
    const view = new DataView(bytes.buffer);
    view.setFloat32(3, 1, true);
    view.setUint32(3 + 4 + 20 + 256 + 8, 1, true);
    bytes.set(new TextEncoder().encode("face.png*env.sph"), 3 + 4 + 20 + 256 + 12 + 50);
    expect(await readModelTextureReferences(new File([bytes], "model.pmd"))).toEqual(["face.png", "env.sph"]);
  });

  it("reports ambiguous basename fallback instead of choosing an arbitrary texture", async () => {
    const model = pmx(["missing/face.png"]);
    const a = withAssetPath(new File(["a"], "face.png"), "package/a/face.png");
    const b = withAssetPath(new File(["b"], "face.png"), "package/b/face.png");
    expect(resolveCompanion(model, "missing/face.png", [model, a, b]).matches).toHaveLength(2);
    expect((await inspectAssets([model, a, b])).issues[0].kind).toBe("ambiguous");
  });

  it("checks glTF external buffers and images while keeping malformed models visible", async () => {
    const gltf = withAssetPath(new File([JSON.stringify({ buffers: [{ uri: "scene.bin" }], images: [{ uri: "data:image/png;base64,eA==" }] })], "scene.gltf"), "scene/scene.gltf");
    const report = await inspectAssets([gltf, new File(["broken"], "bad.pmx")]);
    expect(report).toMatchObject({ models: 1, objects: 1 });
    expect(report.issues.map((issue) => issue.kind)).toEqual(["invalid", "missing"]);
  });
});
