/// <reference types="node" />
import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";
import { DirectionalLight, Scene } from "three";
import { WebGPURenderer } from "three/webgpu";
import { describe, expect, it, vi } from "vitest";

const require = createRequire(import.meta.url);
const physicsEntry = pathToFileURL(require.resolve("@yohawing/three-mmd-loader/physics"));
const shadowPassUrl = new URL("../webgpu/self-shadow-pass.js", physicsEntry);

describe("loader 0.9 TSL shadow pass on the stage's Three revision", () => {
  it("restores renderer/scene state after the pass and releases its projection once", async () => {
    const { createMmdTslSelfShadowPass } = await import(shadowPassUrl.href);
    const light = new DirectionalLight();
    light.castShadow = true;
    const originalUpdate = light.shadow.updateMatrices;
    const originalProjectionUpdate = light.shadow.camera.updateProjectionMatrix;
    const canvas = Object.assign(new EventTarget(),{width:2,height:2,style:{}}) as HTMLCanvasElement;
    const renderer = new WebGPURenderer({canvas});
    renderer.shadowMap.enabled=true;
    const scene = new Scene();
    const pass = createMmdTslSelfShadowPass(renderer, light);
    const dispose = vi.fn();
    pass.renderTarget.addEventListener("dispose", dispose);

    expect(light.userData.mmdShadowProjection).toBeDefined();
    const duringPass=()=>{
      expect(renderer.getRenderTarget()).toBe(pass.renderTarget);
      expect(renderer.shadowMap.enabled).toBe(false);
      expect(scene.overrideMaterial).not.toBeNull();
    };
    vi.spyOn(renderer,'render').mockImplementation(duringPass);
    vi.spyOn(renderer,'compileAsync').mockImplementation(async()=>{duringPass();});
    const mask=light.shadow.camera.layers.mask;
    expect(pass.render(renderer, scene, light)).toBe(true);
    expect(await pass.compileAsync(renderer, scene, light)).toBe(true);
    expect(renderer.getRenderTarget()).toBeNull();expect(renderer.shadowMap.enabled).toBe(true);
    expect(scene.overrideMaterial).toBeNull();expect(light.shadow.camera.layers.mask).toBe(mask);
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
