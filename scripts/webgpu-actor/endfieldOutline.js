import { Fn, attribute, cameraProjectionMatrix, cameraViewMatrix, cameraViewport, mix, modelNormalMatrix,
  modelScale, modelViewMatrix, normalLocal, positionLocal, smoothstep, uniform, vec4, viewportSize } from 'three/tsl';
import { budgets } from './endfieldOutlineBake.js';
export { prepareOutline } from './endfieldOutlineBake.js';

const attrName = 'endfieldEdgeDirection'; // xyz bind-space direction; w PMX vertex edge scale

// r187's WebGPUBackend applies DPR to an ArrayCamera subviewport only on a
// canvas/postprocessing target. XR projection subimages have physical units.
const arrayViewportScale = uniform(1).onRenderUpdate(({renderer}) => {
  const rt = renderer.getRenderTarget();
  return rt === null || rt.isPostProcessingRenderTarget ? renderer.getPixelRatio() : 1;
});
const eyePixels = Fn(({ camera }) => camera.isArrayCamera && camera.cameras.length ?
  cameraViewport.zw.mul(arrayViewportScale).floor() : viewportSize)();

function vertex(width, height, role) {
  const [near,far] = budgets.get(role);
  return Fn(() => {
    // r187 setupPosition has already applied sparse/dense morphs, skin, and
    // the CURRENT positionNode. This includes clothSurface attached later.
    const view = modelViewMatrix.mul(vec4(positionLocal,1)).toConst();
    const clip = cameraProjectionMatrix.mul(view).toConst();
    const viewN = cameraViewMatrix.mul(vec4(modelNormalMatrix.mul(normalLocal),0)).xyz;
    const d = cameraProjectionMatrix.mul(vec4(viewN,0)).toConst();
    const px = eyePixels.max(1).toConst();
    // d(ndc)/dt, up to a positive scalar. Includes off-axis projection and
    // perspective w; normalize in PIXEL space on a rectangular eye target.
    const tangent = d.xy.mul(clip.w).sub(clip.xy.mul(d.w)).mul(px).toConst();
    const unit = tangent.div(tangent.length().max(1e-8));
    const distance = view.z.negate().div(modelScale.y.mul(height).max(1e-6));
    const cap = mix(near,far,smoothstep(.35,1.8,distance));
    const strength = width.mul(attribute(attrName,'vec4').w).max(0);
    // Half-unit PMX edges get 80% of the budget. Smaller animated widths
    // retain their ratio; larger values cannot exceed the role/distance cap.
    const offset = unit.mul(cap).mul(strength.mul(1.6).min(1)).mul(2).div(px).mul(clip.w);
    return clip.add(vec4(offset,0,0));
  })();
}

/** After successful pipeline.attach. Only loader-authored outline materials;
 * no new groups, material or pass. Dispose before adapter.detach. */
export function installOutline(mesh, prepared, { enabled = true, stylePasses } = {}) {
  const g = mesh.geometry, { direction, height, stats } = prepared;
  if (g !== prepared.geometry || g.hasAttribute(attrName)) throw Error('Outline geometry changed or already installed');
  const slots = new Map(stats.slots.map(s => [s.slot,s])), entries = [];
  if (direction) for (const material of [mesh.material].flat()) {
    const edge = material.userData.mmdTslOutlineMaterial;
    const row = slots.get(edge?.sourceMaterialIndex);
    if (!row?.authoredEdge || edge.fallback || !edge.uniforms?.width || !material.vertexNode) continue;
    const original = material.setupPosition;
    // setupVertex builds the position stack BEFORE the custom vertexNode.
    // Seed only this edge draw's normal input; let the original skinning code
    // transform it in the same bind space as the fill (including actor scale).
    const setup = function(builder) {
      normalLocal.assign(attribute(attrName,'vec4').xyz);
      return original.call(this,builder);
    };
    entries.push({ material, original, own: Object.hasOwn(material,'setupPosition'), setup,
      before: material.vertexNode, after: vertex(edge.uniforms.width,height,row.role) });
    row.styledDraws++;
  }
  if (entries.length) g.setAttribute(attrName, direction);
  let active = false, disposed = false;
  function setEnabled(on) {
    if (disposed || active === !!on) return;
    active = !!on;
    for (const e of entries) {
      const m = e.material;
      if (active) { m.setupPosition = e.setup; m.vertexNode = e.after; }
      else {
        if (m.setupPosition === e.setup) {
          if (e.own) m.setupPosition = e.original; else delete m.setupPosition;
        }
        if (m.vertexNode === e.after) m.vertexNode = e.before;
      }
      m.needsUpdate = true;
      stylePasses?.set(m, active ? 'endfield' : 'mmd');
    }
  }
  setEnabled(enabled);
  return {setEnabled, stats, dispose() {
    if (disposed) return;
    setEnabled(false); disposed = true;
    if (direction && g.getAttribute(attrName) === direction) g.deleteAttribute(attrName);
    direction?.dispose(); entries.length = 0;
  }};
}
