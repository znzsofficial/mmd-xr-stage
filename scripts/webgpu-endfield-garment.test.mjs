import assert from 'node:assert/strict';
import test from 'node:test';
import { DataTexture, LinearFilter, Mesh, MeshToonMaterial, PerspectiveCamera, PlaneGeometry,
  Scene, WebGPURenderer, WGSLNodeBuilder } from 'three/webgpu';
import { createMmdTslMaterialFromSource } from '@yohawing/three-mmd-loader/webgpu';
import { endfieldColor } from './webgpu-actor/endfieldToon.js';

test('garment graphs only fetch the packed fold/trim map once and only for its cloth slot', () => {
  // Use Three's CPU WGSL generator. No device, DOM, render submission or private asset.
  const renderer = new WebGPURenderer({canvas:{width:16, height:16}});
  renderer.hasFeature = () => false;
  renderer.backend.capabilities.getUniformBufferLimit = () => 65536;
  renderer._bindings = undefined;
  const texture = new DataTexture(new Uint8Array([128, 128, 128, 64]), 1, 1);
  texture.minFilter = texture.magFilter = LinearFilter;
  const maps = {cloth:new Map([[1, texture]])};
  const source = new MeshToonMaterial(), mat = createMmdTslMaterialFromSource(source);
  const geometry = new PlaneGeometry(), mesh = new Mesh(geometry, mat);
  const original = mat.colorNode, opacity = mat.opacityNode;
  try {
    for (const [role, slot, samples] of [['cloth', 0, 0], ['cloth', 1, 1], ['leather', 1, 0], ['metal', 1, 0]]) {
      mat.colorNode = endfieldColor(original, original, mat, role, mesh, maps, slot);
      const builder = new WGSLNodeBuilder(mesh, renderer);
      builder.material = mat; builder.scene = new Scene(); builder.camera = new PerspectiveCamera();
      builder.build();
      assert.equal(builder.fragmentShader.match(/\btexture(?:Sample\w*|Load)\(/g)?.length ?? 0, samples, `${role} ${slot}`);
      assert.equal(mat.opacityNode, opacity);
    }
  } finally {
    texture.dispose(); geometry.dispose(); mat.dispose(); source.dispose();
  }
});
