/// <reference types="node" />
import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";
import { DirectionalLight, Scene } from "three";
import { describe, expect, it, vi } from "vitest";

const require = createRequire(import.meta.url);
const physicsEntry = pathToFileURL(require.resolve("@yohawing/three-mmd-loader/physics"));
const shadowPassUrl = new URL("../webgpu/self-shadow-pass.js", physicsEntry);

describe("loader TSL compatibility patch", () => {
  it("keeps unsupported shadow rendering inert and releases the retained projection once", async () => {
    const { createMmdTslSelfShadowPass } = await import(shadowPassUrl.href);
    const light = new DirectionalLight();
    light.castShadow = true;
    const originalUpdate = light.shadow.updateMatrices;
    const originalProjectionUpdate = light.shadow.camera.updateProjectionMatrix;
    const renderer = { render: vi.fn(), compileAsync: vi.fn() };
    const scene = new Scene();
    const pass = createMmdTslSelfShadowPass(renderer, light);
    const dispose = vi.fn();
    pass.renderTarget.addEventListener("dispose", dispose);

    expect(light.userData.mmdShadowProjection).toBeDefined();
    expect(pass.render(renderer, scene, light)).toBe(false);
    expect(await pass.compileAsync(renderer, scene, light)).toBe(false);
    expect(renderer.render).not.toHaveBeenCalled();
    expect(renderer.compileAsync).not.toHaveBeenCalled();
    expect(pass.setMode(2)).toBe(true);
    expect(pass.setMode(2)).toBe(false);

    pass.dispose();
    pass.dispose();
    expect(dispose).toHaveBeenCalledTimes(1);
    expect(light.userData.mmdShadowProjection).toBeUndefined();
    expect(light.shadow.updateMatrices).toBe(originalUpdate);
    expect(light.shadow.camera.updateProjectionMatrix).toBe(originalProjectionUpdate);
    expect(pass.render(renderer, scene, light)).toBe(false);
  });
});
