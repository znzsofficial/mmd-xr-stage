import { BufferAttribute } from 'three';
import { attribute, normalView, positionViewDirection, vec3 } from 'three/tsl';
import { bakeSkinTransmission, fingerSegments } from './skinTransmissionBake.js';

export const maskName = 'mmdSkinThinness';

// The synchronous material probe consumes the same bind-space bake as the worker.
export function prepareSkinTransmission(mesh, skinSlots) {
  const {mask,active}=bakeSkinTransmission(mesh.geometry,skinSlots,fingerSegments(mesh));
  mesh.geometry.setAttribute(maskName,new BufferAttribute(mask,1));
  return active;
}

// Direct, linear RGB only. A broad backlit lobe plus a stronger forward
// scattering lobe (light opposite the eye); N or V never supply thickness.
export function skinTransmission(paint, L, light) {
  const through = positionViewDirection.dot(L).negate().clamp();
  const back = normalView.dot(L).negate().clamp();
  return paint.mul(light).mul(vec3(.27, .075, .033)).mul(attribute(maskName, 'float'))
    .mul(back).mul(through.mul(through).mul(.7).add(.3));
}
