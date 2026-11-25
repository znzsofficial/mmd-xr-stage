import { createMmdTslPipeline } from '@yohawing/three-mmd-loader/webgpu';

/**
 * One facade per fixture renderer. Use geometryAwareAlpha: true on the loader
 * (its WebGL outlines normally enable this scan). Load with loadOptions, then
 * attach that exact model once. After pose evaluation, call prepare(scene)
 * once per frame before the fixture's own draw (not once per model or eye).
 *
 * The fixture owns the renderer, light and loaded model, including its materials
 * and textures. In finally, detach(model) before the usual model disposal, and
 * dispose the adapter on teardown. Init/attach errors propagate to that owner.
 * Detach releases TSL compute/shadow helpers; it does not undo material and
 * outline replacement. Discard a failed/retired model rather than reattaching it.
 */
export async function createActorMaterialAdapter(renderer, light) {
  // The facade awaits init() and checks the selected backend after fallback.
  const pipeline = await createMmdTslPipeline(renderer, {
    light,
    selfShadowEnabled: false, // The dedicated MMD shadow pass is degraded on r187.
  });
  return {
    loadOptions: pipeline.createModelLoadOptions(),
    attach: pipeline.attach,
    prepare: pipeline.prepareRender,
    detach: pipeline.detach,
    dispose: pipeline.dispose,
  };
}
