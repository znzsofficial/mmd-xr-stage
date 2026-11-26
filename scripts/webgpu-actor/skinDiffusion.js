import { dFdx, dFdy, float, positionView, vec3 } from 'three/tsl';

// Primitive of smoothstep(0, 1, x), including its constant tails.
function integratedStep(x) {
  const t = x.clamp();
  return t.mul(t).mul(t).mul(t.mul(-.5).add(1)).add(x.sub(1).max(0));
}

// Exact convolution of the existing cubic light band with a unit-mass box
// per wavelength. RGB have different transport distances, not different gains.
// Integrate the dark half and reflect it: plateaus remain exactly 0/1 and
// the light lost on the lit shoulder equals that gained on the dark shoulder.
export function skinBandDelta(band, fromMidpoint, edgeHalfWidth, radii) {
  const invSpan = .5 / edgeHalfWidth;
  const x = fromMidpoint.abs().mul(-invSpan).add(.5);
  const r = radii.mul(invSpan).max(.002);
  const dark = integratedStep(x.add(r)).sub(integratedStep(x.sub(r))).div(r.mul(2)).clamp(0,.5);
  const scattered = dark.sub(.5).mul(fromMidpoint.sign().negate()).add(.5);
  return scattered.sub(band);
}

// Convert an anatomical length to a distance in the posed scalar light field.
// |Py * dx(f) - Px * dy(f)| / |Px × Py| is the surface gradient magnitude;
// a change of camera pixel density cancels, as does uniformly scaling the
// actor and its interocular reference. Cap extreme gradients at normal seams.
export function surfaceRadii(field, eyeSpan) {
  let slope = float(.8); // rigs without named eyes: angular profile in N.L units
  if (eyeSpan) {
    const px = dFdx(positionView), py = dFdy(positionView);
    const numerator = py.mul(dFdx(field)).sub(px.mul(dFdy(field))).length();
    slope = numerator.mul(eyeSpan).div(px.cross(py).length().max(1e-14)).clamp();
  }
  return vec3(.64,.34,.16).mul(slope);
}
