import {
  cameraViewMatrix, float, max, mix, normalView, positionViewDirection,
  smoothstep, sRGBTransferEOTF, texture, uniform, uv, vec3, vec4,
} from 'three/tsl';

// Perceptual roughness controls highlight width. Fill/lit are the fraction of
// the *already lit* author composite retained across the soft form band. Metal
// keeps a smaller painted underlayer and reflects the pigment in the key light.
const profiles = {
  cloth:   { roughness: .80, f0: .028, fill: .62, lit: .95, sheen: .055 },
  leather: { roughness: .43, f0: .048, fill: .50, lit: .87, sheen: 0 },
  metal:   { roughness: .32,            fill: .39, lit: .74, sheen: 0 },
};

// Snapshot the selection once; reject ambiguity even within a single category.
export const nprRoles = ['face', 'skin', 'hair'];
export function parseHybridSlots(selection, endfield = false) {
  const slots = new Map();
  if (selection == null) return slots;
  if (typeof selection !== 'object' || Array.isArray(selection)) throw new TypeError('hybridSlots must be an object');
  for (const [kind, indices] of Object.entries(selection)) {
    if (!(Object.hasOwn(profiles, kind) || (endfield && nprRoles.includes(kind))) || !Array.isArray(indices)) throw new TypeError(`Invalid hybridSlots category or list: ${kind}`);
    for (const i of indices) {
      if (!Number.isSafeInteger(i) || i < 0) throw new RangeError(`Invalid ${kind} PMX slot: ${i}`);
      if (slots.has(i)) throw new RangeError(`Duplicate hybrid PMX slot ${i}: ${slots.get(i)} and ${kind}`);
      slots.set(i, kind);
    }
  }
  return slots;
}

export function diffusePigment(material, u) {
  // Direct reflection needs *unlit* pigment. Same diffuse UV and live PMX
  // factors as the fork; don't use toon shadows or a baked sphere as albedo.
  const map = material.userData.mmdTslTextureReferences.diffuseMap;
  const factor = uniform(u.textureFactor);
  const tint = uniform(u.diffuse).mul(mix(vec3(1), factor.rgb, factor.a)).clamp();
  return sRGBTransferEOTF(tint).mul(map ? texture(map).sample(uv()).rgb : vec3(1));
}

export function hybridToonColor(base, material, kind) {
  const p = profiles[kind], u = material.userData.mmdTslMaterialUniforms;
  // pipeline.prepareRender updates these Vector3s in place, including setting
  // lightColor to zero for a hidden key. Bring L into the same eye space as N,V.
  const light = uniform(u.lightColor);
  const L = cameraViewMatrix.mul(vec4(uniform(u.lightDirection), 0)).xyz;
  const V = positionViewDirection, N = normalView;
  const half = L.add(V), H = half.div(half.length().max(1e-5));
  const signedNL = N.dot(L), nl = signedNL.clamp(), nv = N.dot(V).clamp();
  const nh = N.dot(H).clamp(), vh = V.dot(H).clamp();

  // GGX D, Schlick-GGX visibility for a direct light, and Schlick Fresnel.
  // The N.L / N.V factors from Smith cancel the BRDF denominator; only the
  // incident cosine remains. k > 0 keeps the grazing case finite.
  const a2 = p.roughness ** 4, k = (p.roughness + 1) ** 2 / 8;
  const denom = nh.mul(nh).mul(a2 - 1).add(1);
  const D = float(a2 / Math.PI).div(denom.mul(denom));
  const visibility = float(.25).div(nl.mul(1 - k).add(k).mul(nv.mul(1 - k).add(k)));
  const f0 = kind === 'metal' ? diffusePigment(material, u).mul(.72).add(.16) : vec3(p.f0);
  const F = mix(f0, vec3(1), vh.oneMinus().pow(5));
  let reflection = F.mul(D).mul(visibility).mul(nl);
  if (p.sheen) reflection = reflection.add(nv.oneMinus().pow(3).mul(nl).mul(p.sheen));
  if (kind === 'metal') {
    // A soft rectangular reflection of the key light makes the traveling glint
    // legible on small fittings. Orient it about the world, not the camera;
    // the artist's baked decoration still comes from the original toon node.
    const up = cameraViewMatrix.mul(vec4(0, 1, 0, 0)).xyz;
    const z = cameraViewMatrix.mul(vec4(0, 0, 1, 0)).xyz;
    const ref = L.dot(up).abs().greaterThan(.98).select(z, up);
    const axis = L.cross(ref), side = axis.div(axis.length().max(1e-5)), along = side.cross(L);
    const ray = N.mul(N.dot(V).mul(2)).sub(V);
    const ribbon = smoothstep(.06, .30, ray.dot(side).abs()).oneMinus()
      .mul(smoothstep(.40, .77, ray.dot(along).abs()).oneMinus())
      .mul(smoothstep(.48, .69, ray.dot(L))).mul(smoothstep(0, .2, nl));
    reflection = reflection.add(F.mul(ribbon).mul(.85));
  }

  const key = max(light.r, max(light.g, light.b)).clamp();
  const form = mix(smoothstep(-.20, .65, signedNL), nl, .3).mul(key);
  const rgb = base.mul(mix(p.fill, p.lit, form)).add(light.mul(reflection));
  // Hue-preserving linear shoulder: identity below .62; even a head-on metal
  // glint approaches .91 rather than clipping all three channels to white.
  const peak = max(.62, max(rgb.r, max(rgb.g, rgb.b))), over = peak.sub(.62);
  const mapped = over.mul(.29).div(over.add(.29)).add(.62);
  return rgb.mul(mapped.div(peak));
}
