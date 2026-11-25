import { afterEach, describe, expect, it, vi } from "vitest";
import * as THREE from "three";
import type { ThreeMmdModel } from "@yohawing/three-mmd-loader";
import { applyMaterialOverrides, DEFAULT_MATERIAL_OVERRIDE, disposeEntryEnhancementTextures, refreshMaterialTextures, type MaterialPipelineEntry } from "./mmdRuntimeMaterials";

function entryFor(material: THREE.Material): MaterialPipelineEntry {
  return {
    id: "model", visible: true, materialNames: ["body"], materialVisible: {},
    materialOverrides: { body: { ...DEFAULT_MATERIAL_OVERRIDE } },
    model: { mesh: new THREE.SkinnedMesh(new THREE.BufferGeometry(), material) } as ThreeMmdModel,
  };
}

describe("enhancement texture ownership", () => {
  afterEach(() => vi.restoreAllMocks());

  function setup() {
    const material = new THREE.MeshToonMaterial();
    const entry = entryFor(material);
    const loads: { resolve: (map: THREE.Texture<HTMLImageElement>) => void; reject: (error: Error) => void }[] = [];
    vi.spyOn(THREE.TextureLoader.prototype, "loadAsync").mockImplementation(() =>
      new Promise<THREE.Texture<HTMLImageElement>>((resolve, reject) => loads.push({ resolve, reject })));
    const tex = () => { const texture = new THREE.Texture<HTMLImageElement>(); vi.spyOn(texture, "dispose"); return texture; };
    const file = () => new File(["x"], "map.png", { lastModified: 1 });
    const update = (ao: File | null, emission: File | null = null) => {
      Object.assign(entry.materialOverrides.body, { aoMapFile: ao, emissionMapFile: emission });
      return refreshMaterialTextures(entry);
    };
    return { material, entry, loads, tex, file, update };
  }

  it("uploads the same PNG as raw AO/mask values but sRGB emission, all in PMX's top-down UV space", async () => {
    const material = new THREE.MeshToonMaterial(), entry = entryFor(material);
    const file = new File(["x"], "gray.png");
    Object.assign(entry.materialOverrides.body, { aoMapFile: file, emissionMapFile: file, maskMapFile: file });
    vi.spyOn(THREE.TextureLoader.prototype, "loadAsync").mockImplementation(async () => new THREE.Texture<HTMLImageElement>());
    await refreshMaterialTextures(entry);
    const { aoMap, emissionMap, maskMap } = material.userData.mmdEnhanceTextures;
    expect([aoMap.colorSpace, emissionMap.colorSpace, maskMap.colorSpace]).toEqual([
      THREE.NoColorSpace, THREE.SRGBColorSpace, THREE.NoColorSpace,
    ]);
    expect([aoMap.flipY, emissionMap.flipY, maskMap.flipY]).toEqual([false, false, false]);
    disposeEntryEnhancementTextures(entry);
  });

  it("commits B when same-name A finishes last, deduplicates pending B and updates the paused shader", async () => {
    const { material, entry, loads, tex, file, update } = setup();
    const uniform = { value: null };
    material.userData.mmdEnhanceShader = { uniforms: { mmdEnhanceAoMap: uniform } };
    applyMaterialOverrides(entry);
    const b = file(); const first = update(file()), second = update(b), same = update(b);
    expect(loads).toHaveLength(2);
    const aMap = tex(), bMap = tex();
    loads[1].resolve(bMap); await Promise.all([second, same]);
    loads[0].resolve(aMap); await first;
    expect(uniform.value).toBe(bMap);
    expect(aMap.dispose).toHaveBeenCalledOnce(); expect(bMap.dispose).not.toHaveBeenCalled();
    disposeEntryEnhancementTextures(entry);
    expect(bMap.dispose).toHaveBeenCalledOnce();
  });

  it("returning to the committed selection cancels the replacement, including a late decode", async () => {
    const { material, loads, tex, file, update } = setup();
    const a = file(), keep = tex(), stale = tex();
    const first = update(a); loads[0].resolve(keep); await first;
    const replace = update(file()); await update(a);
    loads[1].resolve(stale); await replace;
    expect(material.userData.mmdEnhanceTextures.aoMap).toBe(keep);
    expect(stale.dispose).toHaveBeenCalledOnce(); expect(keep.dispose).not.toHaveBeenCalled();
    await update(null); expect(keep.dispose).toHaveBeenCalledOnce();
  });

  it("keeps the last complete set on partial failure, revokes blob URLs and permits retry", async () => {
    const { material, loads, tex, file, update } = setup();
    const revoke = vi.spyOn(URL, "revokeObjectURL"), warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const keep = tex(), partial = tex(), a = file(), e = file();
    let p = update(file()); loads[0].resolve(keep); await p;
    p = update(a, e); loads[1].resolve(partial); await vi.waitFor(() => expect(loads).toHaveLength(3));
    loads[2].reject(new Error("decode failed")); await p;
    expect(partial.dispose).toHaveBeenCalledOnce(); expect(keep.dispose).not.toHaveBeenCalled();
    expect(material.userData.mmdEnhanceTextures.aoMap).toBe(keep);
    expect(new Set(revoke.mock.calls.map(([url]) => url)).size).toBe(3); expect(warn).toHaveBeenCalledOnce();
    p = update(a, e); const fresh = tex(); loads[3].resolve(fresh); await vi.waitFor(() => expect(loads).toHaveLength(5));
    loads[4].resolve(tex()); await p;
    expect(material.userData.mmdEnhanceTextures.aoMap).toBe(fresh); expect(keep.dispose).toHaveBeenCalledOnce();
  });

  it("unloading during a multi-file load frees staged and late textures exactly once", async () => {
    const { entry, material, loads, tex, file, update } = setup();
    const partial = tex(), late = tex(), p = update(file(), file()); loads[0].resolve(partial);
    await vi.waitFor(() => expect(loads).toHaveLength(2));
    disposeEntryEnhancementTextures(entry);
    expect(partial.dispose).toHaveBeenCalledOnce();
    loads[1].resolve(late); await p;
    expect(partial.dispose).toHaveBeenCalledOnce(); expect(late.dispose).toHaveBeenCalledOnce();
    expect(material.userData.mmdEnhanceTextures).toBeUndefined();
  });
});

describe("material hot-path synchronization", () => {
  it("updates fallback uniforms without repeatedly invalidating the material program", () => {
    const material = new THREE.MeshStandardMaterial();
    material.userData.mmdWebGpuStripped = true;
    const entry = entryFor(material);
    const version = material.version;
    for (let frame = 0; frame < 120; frame += 1) applyMaterialOverrides(entry);
    expect(material.version).toBe(version);
    entry.materialOverrides.body.roughness = 0.2;
    entry.materialOverrides.body.metallic = 0.7;
    applyMaterialOverrides(entry);
    expect(material.roughness).toBe(0.2);
    expect(material.metalness).toBe(0.7);
    expect(material.version).toBe(version);
    const texture = new THREE.Texture();
    material.envMap = texture;
    applyMaterialOverrides(entry);
    expect(material.envMap).toBeNull();
    expect(material.version).toBe(version + 1);
    applyMaterialOverrides(entry);
    expect(material.version).toBe(version + 1);
    texture.dispose();
    material.dispose();
  });

  it("reuses enhancement state and color uniforms while responding to changed overrides and shader replacement", () => {
    const material = new THREE.MeshToonMaterial();
    const color = new THREE.Color();
    const uniforms = { mmdEnhanceEmissionColor: { value: color }, mmdEnhanceAmbient: { value: 0 } };
    material.userData.mmdEnhanceShader = { uniforms };
    const entry = entryFor(material);
    entry.materialOverrides.body.emissionColor = "#b04080";
    applyMaterialOverrides(entry);
    const state = material.userData.mmdEnhanceState;
    // #80 in sRGB is ~0.216 linear; decoding it twice would give ~0.038.
    expect(color.b).toBeCloseTo(0.2158605, 6);
    expect(color.getHexString()).toBe("b04080");
    for (let frame = 0; frame < 120; frame += 1) applyMaterialOverrides(entry);
    expect(material.userData.mmdEnhanceState).toBe(state);
    expect(uniforms.mmdEnhanceEmissionColor.value).toBe(color);
    expect(color.getHexString()).toBe("b04080");
    expect(uniforms.mmdEnhanceAmbient.value).toBe(0.55);

    entry.materialOverrides.body = { ...entry.materialOverrides.body, emissionColor: "#4080b0" };
    applyMaterialOverrides(entry, { ambientIntensity: 0.3 });
    expect(color.getHexString()).toBe("4080b0");
    expect(state.override).toBe(entry.materialOverrides.body);
    expect(uniforms.mmdEnhanceAmbient.value).toBe(0.3);

    const replacement = new THREE.Color();
    material.userData.mmdEnhanceShader = { uniforms: { mmdEnhanceEmissionColor: { value: replacement } } };
    applyMaterialOverrides(entry);
    expect(replacement.toArray()).toEqual(color.toArray());
    material.dispose();
  });
});
