import { beforeEach, describe, expect, it } from "vitest";
import {
  MMD_VR_MAX_MODELS,
  MMD_VR_MAX_OBJECTS,
  beginMmdVrAssetSession,
  endMmdVrAssetSession,
  getMmdVrSessionAssets,
  peekMmdVrPendingAssets,
  setMmdVrPendingAssets,
} from "./mmdVrAssets";

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

  it("caps pending model slots", () => {
    const slots = Array.from({ length: MMD_VR_MAX_MODELS + 2 }, (_, i) => fakeModelSlot(`m${i}.pmx`));
    setMmdVrPendingAssets(slots);
    expect(peekMmdVrPendingAssets()).toHaveLength(MMD_VR_MAX_MODELS);
  });

  it("caps pending object slots independently", () => {
    const slots = Array.from({ length: MMD_VR_MAX_OBJECTS + 3 }, (_, i) => fakeObjectSlot(`o${i}.glb`));
    setMmdVrPendingAssets(slots);
    const pending = peekMmdVrPendingAssets();
    expect(pending).toHaveLength(MMD_VR_MAX_OBJECTS);
    expect(pending.every((slot) => slot.kind === "object")).toBe(true);
  });

  it("normalizes a mixed session keeping models before objects", () => {
    setMmdVrPendingAssets([
      fakeObjectSlot("chair.glb"),
      fakeModelSlot("a.pmx"),
      fakeObjectSlot("table.glb"),
    ]);
    beginMmdVrAssetSession();
    const session = getMmdVrSessionAssets();
    expect(session.map((slot) => (slot.kind === "model" ? slot.modelFile.name : slot.objectFile.name))).toEqual([
      "a.pmx",
      "chair.glb",
      "table.glb",
    ]);
  });

  it("fills companion fallback with the primary file", () => {
    setMmdVrPendingAssets([
      { kind: "object" as const, objectFile: fakeFile("a.glb"), companionFiles: [] },
    ]);
    beginMmdVrAssetSession();
    const slot = getMmdVrSessionAssets()[0];
    expect(slot.kind).toBe("object");
    if (slot.kind === "object") expect(slot.companionFiles).toEqual([slot.objectFile]);
  });

  it("begin promotes pending and survives second begin", () => {
    setMmdVrPendingAssets([fakeModelSlot("a.pmx", "a.vmd")]);
    beginMmdVrAssetSession();
    expect(getMmdVrSessionAssets()).toHaveLength(1);
    expect(peekMmdVrPendingAssets()).toHaveLength(0);
    // Strict Mode remount / second begin without new pending keeps session
    beginMmdVrAssetSession();
    expect(getMmdVrSessionAssets()[0]).toMatchObject({ kind: "model" });
  });

  it("end clears session", () => {
    setMmdVrPendingAssets([fakeModelSlot("a.pmx")]);
    beginMmdVrAssetSession();
    endMmdVrAssetSession();
    expect(getMmdVrSessionAssets()).toHaveLength(0);
  });
});
