import { beforeEach, describe, expect, it } from "vitest";
import {
  MMD_VR_MAX_MODELS,
  MMD_VR_MAX_OBJECTS,
  beginMmdVrAssetSession,
  endMmdVrAssetSession,
  getMmdVrSessionAssets,
} from "./sessionAssets";

function fakeFile(name: string) {
  return new File([name], name, { type: "application/octet-stream" });
}

function fakeModelSlot(name: string, bodyMotion?: string) {
  return {
    kind: "model" as const,
    modelFile: fakeFile(name),
    companionFiles: [fakeFile(name)],
    bodyMotionFile: bodyMotion ? fakeFile(bodyMotion) : null,
  };
}

function fakeObjectSlot(name: string) {
  return {
    kind: "object" as const,
    objectFile: fakeFile(name),
    companionFiles: [fakeFile(name)],
  };
}

describe("mmdVrAssets", () => {
  beforeEach(() => {
    endMmdVrAssetSession();
  });

  it("caps models and objects independently and keeps models first", () => {
    const models = Array.from({ length: MMD_VR_MAX_MODELS + 1 }, (_, i) => fakeModelSlot(`m${i}.pmx`));
    const objects = Array.from({ length: MMD_VR_MAX_OBJECTS + 1 }, (_, i) => fakeObjectSlot(`o${i}.glb`));
    beginMmdVrAssetSession([...objects, ...models]);
    const session = getMmdVrSessionAssets();
    expect(session.map((slot) => (slot.kind === "model" ? slot.modelFile.name : slot.objectFile.name))).toEqual([
      "m0.pmx", "m1.pmx", "m2.pmx", "o0.glb", "o1.glb", "o2.glb",
    ]);
  });

  it("fills companion fallback with the primary file", () => {
    beginMmdVrAssetSession([
      { kind: "object" as const, objectFile: fakeFile("a.glb"), companionFiles: [] },
    ]);
    const slot = getMmdVrSessionAssets()[0];
    expect(slot.kind).toBe("object");
    if (slot.kind === "object") expect(slot.companionFiles).toEqual([slot.objectFile]);
  });

  it("end clears session", () => {
    beginMmdVrAssetSession([fakeModelSlot("a.pmx")]);
    endMmdVrAssetSession();
    expect(getMmdVrSessionAssets()).toHaveLength(0);
  });

  it("treats an explicit empty handoff as a fresh empty stage", () => {
    beginMmdVrAssetSession([fakeModelSlot("old.pmx")]);
    beginMmdVrAssetSession([]);
    expect(getMmdVrSessionAssets()).toEqual([]);
  });
});
