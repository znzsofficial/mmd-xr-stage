import { createMmdTslPipeline, disposeMmdTslShadowCaster } from '@yohawing/three-mmd-loader/webgpu';
import { max, sRGBTransferEOTF, sRGBTransferOETF } from 'three/tsl';
import { hybridToonColor, parseHybridSlots } from './hybridToon.js';
import { endfieldColor } from './endfieldToon.js';

// Fork 3ac1d8e, webgpu/material-core.ts: the pipeline's colorNode returns
// EOTF(clamp(toon/sphere/specular composite, 0, 1)). Its public output cannot
// recover detail already clipped by that clamp. Grade the surviving RGB in the
// same gamma space as mmdMaterialEnhance.ts, before framebuffer blending.
function balancedToonColor(linear, ambientIntensity) {
  const ambient = Math.min(3, Math.max(0, ambientIntensity));
  const rgb = sRGBTransferOETF(linear).mul(0.76 + 0.34 * ambient);
  // Floor peak at the knee: the scale is exactly one below it (also at black).
  const peak = max(0.82, max(rgb.r, max(rgb.g, rgb.b)));
  const shoulder = peak.sub(0.82).mul(0.18).div(peak.sub(0.64)).add(0.82);
  return sRGBTransferEOTF(rgb.mul(shoulder.div(peak)));
}

/**
 * One facade per fixture renderer. Use geometryAwareAlpha: true on the loader
 * (its WebGL outlines normally enable this scan). Load with loadOptions, then
 * attach that exact model once. After pose evaluation, call prepare(scene)
 * once per frame before the fixture's own draw (not once per model or eye).
 * Pass { balancedModelColor: true, ambientIntensity } to test the stage's
 * default toon grade; pass the same ambient scalar as the WebGL reference.
 * hybridSlots optionally maps cloth/leather/metal to disjoint, zero-based PMX
 * indices. Unlisted slots retain the requested grade (loader baseline if off).
 *
 * The fixture owns the renderer, light and loaded model, including its materials
 * and textures. In finally, detach(model) before the usual model disposal, and
 * dispose the adapter on teardown. Init/attach errors propagate to that owner.
 * Detach releases TSL compute/shadow helpers; it does not undo material and
 * outline replacement. Discard a failed/retired model rather than reattaching it.
 */
export async function createActorMaterialAdapter(renderer, light, { balancedModelColor = false, ambientIntensity = 0.55, hybridSlots, endfield = false } = {}) {
  const slots = parseHybridSlots(hybridSlots, endfield);
  // The facade awaits init() and checks the selected backend after fallback.
  const pipeline = await createMmdTslPipeline(renderer, {
    light,
    selfShadowEnabled: false, // The dedicated MMD shadow pass is degraded on r187.
  });
  return {
    loadOptions: pipeline.createModelLoadOptions(),
    attach(model, options) {
      // Validate against authored slots before the fork replaces materials and
      // appends outline slots. Invalid input leaves the loaded actor untouched.
      const source = model.mesh.material, count = Array.isArray(source) ? source.length : 1;
      for (const i of slots.keys()) {
        if (i >= count) throw new RangeError(`Hybrid PMX slot ${i} outside authored slot count ${count}`);
      }
      const attached = pipeline.attach(model, options);
      // r187 adds layer 1 to its left eye. The fork's optional shadow-only
      // geometry uses that same layer and draws an untextured white silhouette
      // in the color pass. This adapter has no dedicated XR shadow pass.
      if (attached && renderer.xr.enabled && !options?.selfShadowEnabled && !options?.selfShadow) disposeMmdTslShadowCaster(model.mesh);
      if (attached && (balancedModelColor || slots.size)) {
        for (const [index, material] of [model.mesh.material].flat().entries()) {
          // Only fork toon surfaces have these uniforms. Appended edges use a
          // different material; opacityNode, alpha test and depth stay loader-owned.
          if (!material.userData.mmdTslMaterialUniforms) continue;
          if (balancedModelColor) material.colorNode = balancedToonColor(material.colorNode, ambientIntensity);
          if (slots.has(index)) material.colorNode = endfield ? endfieldColor(material.colorNode, material, slots.get(index), model.mesh) : hybridToonColor(material.colorNode, material, slots.get(index));
        }
      }
      return attached;
    },
    prepare: pipeline.prepareRender,
    detach: pipeline.detach,
    dispose: pipeline.dispose,
  };
}
