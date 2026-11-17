import { describe, expect, it } from "vitest";
import * as THREE from "three";
import type { ThreeMmdModel } from "@yohawing/three-mmd-loader";
import { applyMaterialOverrides, DEFAULT_MATERIAL_OVERRIDE, type MaterialPipelineEntry } from "./mmdRuntimeMaterials";

function entryFor(material: THREE.Material): MaterialPipelineEntry {
  return {
    id: "model", visible: true, materialNames: ["body"], materialVisible: {},
    materialOverrides: { body: { ...DEFAULT_MATERIAL_OVERRIDE } },
    model: { mesh: new THREE.SkinnedMesh(new THREE.BufferGeometry(), material) } as ThreeMmdModel,
  };
}

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
    const expected = new THREE.Color("#b04080").convertSRGBToLinear();
    expect(color.toArray()).toEqual(expected.toArray());
    for (let frame = 0; frame < 120; frame += 1) applyMaterialOverrides(entry);
    expect(material.userData.mmdEnhanceState).toBe(state);
    expect(uniforms.mmdEnhanceEmissionColor.value).toBe(color);
    expect(color.toArray()).toEqual(expected.toArray());
    expect(uniforms.mmdEnhanceAmbient.value).toBe(0.55);

    entry.materialOverrides.body = { ...entry.materialOverrides.body, emissionColor: "#4080b0" };
    applyMaterialOverrides(entry, { ambientIntensity: 0.3 });
    expect(color.toArray()).toEqual(new THREE.Color("#4080b0").convertSRGBToLinear().toArray());
    expect(state.override).toBe(entry.materialOverrides.body);
    expect(uniforms.mmdEnhanceAmbient.value).toBe(0.3);

    const replacement = new THREE.Color();
    material.userData.mmdEnhanceShader = { uniforms: { mmdEnhanceEmissionColor: { value: replacement } } };
    applyMaterialOverrides(entry);
    expect(replacement.toArray()).toEqual(color.toArray());
    material.dispose();
  });
});
