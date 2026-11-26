// r187 resolves its internal eye 0/1 linear-color targets through a mono quad
// per eye (_renderOutputLayers). WebGPUBackend honors the binding's descriptor
// for ArrayCamera draws, but for that quad picks the destination by source eye
// ordinal. Preserve the source index; remap only the external attachment view.
// Confined to the dev-room renderer instance; remove after verifying both slice
// orders on a Three release that uses xrViewDescriptors in the mono branch.
export function bindR187ProjectionOutput(renderer) {
  const backend = renderer.backend, original = backend._createExternalTextureViews;
  if (!backend.isWebGPUBackend || typeof original !== 'function') throw Error('Unexpected r187 projection attachment API');
  backend._createExternalTextureViews = function(context, texture) {
    const ordinal = context.activeCubeFace, descriptor = texture.xrViewDescriptors?.[ordinal];
    if (renderer.xr.isPresenting && context.renderTarget === renderer.getOutputRenderTarget() &&
        !context.camera?.isArrayCamera && descriptor && descriptor.baseArrayLayer !== ordinal) {
      context.activeCubeFace = descriptor.baseArrayLayer;
      try { return original.call(this, context, texture); }
      finally { context.activeCubeFace = ordinal; }
    }
    return original.call(this, context, texture);
  };
  return () => { backend._createExternalTextureViews = original; };
}
