import { describe, expect, it } from "vitest";
import { createGltfResourceMapper, normalizeGltfResourcePath } from "./mmdVrGltf";

describe("normalizeGltfResourcePath", () => {
  it("strips leading ./", () => {
    expect(normalizeGltfResourcePath("./model.bin")).toBe("model.bin");
  });

  it("keeps plain relative and nested paths", () => {
    expect(normalizeGltfResourcePath("model.bin")).toBe("model.bin");
    expect(normalizeGltfResourcePath("textures/diff.png")).toBe("textures/diff.png");
  });

  it("drops query/hash suffixes", () => {
    expect(normalizeGltfResourcePath("model.bin?v=2")).toBe("model.bin");
    expect(normalizeGltfResourcePath("t.png#x")).toBe("t.png");
  });

  it("keeps data and http URIs intact", () => {
    expect(normalizeGltfResourcePath("data:application/octet-stream;base64,AA==")).toBe("data:application/octet-stream;base64,AA==");
    expect(normalizeGltfResourcePath("https://example.com/a.bin")).toBe("https://example.com/a.bin");
  });
});

describe("createGltfResourceMapper", () => {
  const files = [
    { path: "scene/model.gltf", url: "blob:primary" },
    { path: "scene/model.bin", url: "blob:bin" },
    { path: "scene/textures/diff.png", url: "blob:diff" },
  ];

  it("resolves exact relative paths", () => {
    const mapper = createGltfResourceMapper(files);
    expect(mapper("model.bin")).toBe("blob:bin");
    expect(mapper("textures/diff.png")).toBe("blob:diff");
  });

  it("passes through unmatched and absolute URIs", () => {
    const mapper = createGltfResourceMapper(files);
    expect(mapper("missing.bin")).toBe("missing.bin");
    expect(mapper("blob:http://localhost:5173/uuid")).toBe("blob:http://localhost:5173/uuid");
    expect(mapper("data:application/octet-stream;base64,AA==")).toBe("data:application/octet-stream;base64,AA==");
    expect(mapper("https://example.com/other.bin")).toBe("https://example.com/other.bin");
  });
});
