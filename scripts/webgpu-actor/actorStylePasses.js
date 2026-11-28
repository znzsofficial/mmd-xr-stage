// Keep the actual draw (including object, material, geometry and bindings) in
// Three's render lifecycle. A named pass lets r187 keep the RenderObject of
// a previously drawn graph until the actor material is disposed. Its usual
// version, geometry, lights and render-context invalidation still applies.
const passIds = { endfield: 'mmd-stage:endfield', strinova: 'mmd-stage:strinova' };

export function createActorStylePasses(renderer) {
  const active = new Map();
  let installed = false, previous = null;

  function draw(object, scene, camera, geometry, material, group, lights, clipping, passId = null) {
    // Keep explicit passes (including back sides) and scene overrides on
    // their normal path. The local face caster installs its own callback.
    if (passId === null && scene.overrideMaterial == null) passId = active.get(material) ?? null;
    return (previous ?? renderer.renderObject).call(renderer, object, scene, camera, geometry, material, group, lights, clipping, passId);
  }

  function restore() {
    // A later owner can wrap this callback. Leave its chain in place; with
    // an empty map this link only forwards to the callback it captured.
    if (installed && renderer.getRenderObjectFunction() === draw) {
      renderer.setRenderObjectFunction(previous);
      installed = false;
      previous = null;
    }
  }

  return {
    set(material, mode) {
      if (mode === 'mmd') {
        active.delete(material);
        if (!active.size) restore();
        return;
      }
      active.set(material, passIds[mode]);
      if (!installed) {
        previous = renderer.getRenderObjectFunction();
        renderer.setRenderObjectFunction(draw);
        installed = true;
      }
    },
    dispose() { active.clear(); restore(); },
  };
}
