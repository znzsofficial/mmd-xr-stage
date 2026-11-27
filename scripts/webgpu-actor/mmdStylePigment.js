import { mix, sRGBTransferEOTF, sRGBTransferOETF, texture, uniform, uv, vec3 } from 'three/tsl';

// The fork's material-core.js composes (ambient + diffuse * key) in PMX
// colour space, then multiplies the painted texel and the live texture morph.
// A neutral unit key gives a reference colour without baking any room light,
// toon ramp, sphere map or highlight into albedo. This is not PBR recovery.
export function mmdStylePigment(material) {
  const u = material.userData.mmdTslMaterialUniforms;
  const map = material.userData.stageMaterial?.diffuse ?? material.userData.mmdTslTextureReferences.diffuseMap;
  const d = uniform(u.diffuse), neutral = d.add(uniform(u.ambient)).clamp();
  const f = uniform(u.textureFactor), tint = neutral.mul(mix(vec3(1), f.rgb, f.a));
  const sample = map && texture(map).sample(uv()).rgb;
  const authored = sample ? sRGBTransferOETF(sample) : vec3(1);
  const decoded = sRGBTransferEOTF(authored.mul(tint).clamp());
  // Identity tint should preserve exactly the sampled linear RGB.
  const paint = sample ? tint.equal(vec3(1)).all().select(sample, decoded) : decoded;
  // Don't relight the entire neutral colour as if it all came from diffuse.
  // Where diffuse cannot account for it, retain that share of the displayed
  // MMD composite. Zero pigment likewise cannot establish a style colour.
  const directShare = d.div(neutral.max(1e-6)).clamp();
  return { paint, resolve:(styled, mmd) => mix(mmd, styled, directShare) };
}
