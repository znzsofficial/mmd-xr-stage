import { DataTexture, LinearFilter, LinearMipmapLinearFilter, NormalRGPacking } from 'three';
import { cameraViewMatrix, float, mix, normalMap, normalView, positionViewDirection, smoothstep, texture, uv, vec2, vec3, vec4 } from 'three/tsl';
import { unzlibSync } from 'three/addons/libs/fflate.module.js';

// This fixture accepts the paired RG-normal / R+A-parameter convention only
// for cloth selected in the Endfield grade. Decode data, not display pixels:
// Canvas and external image uploads can premultiply the material ID by roughness.
export async function rgba8(file, w, h) {
  const bytes = new Uint8Array(await file.arrayBuffer()), view = new DataView(bytes.buffer);
  if (view.getUint32(0) !== 0x89504e47 || view.getUint32(4) !== 0x0d0a1a0a || view.getUint32(12) !== 0x49484452 ||
      view.getUint32(16) !== w || view.getUint32(20) !== h || bytes[24] !== 8 || bytes[25] !== 6 || bytes[26] || bytes[27] || bytes[28]) return;
  const parts = []; let size = 0;
  for (let i = 8; i + 12 <= bytes.length;) {
    const n = view.getUint32(i), type = view.getUint32(i + 4);
    if (i + 12 + n > bytes.length) return;
    if (type === 0x49444154) { parts.push(bytes.subarray(i + 8, i + 8 + n)); size += n; }
    if (type === 0x49454e44) break;
    i += n + 12;
  }
  const compressed = new Uint8Array(size); let offset = 0;
  for (const part of parts) { compressed.set(part, offset); offset += part.length; }
  const stride = w * 4, rows = unzlibSync(compressed, { out: new Uint8Array(h * (stride + 1)) });
  if (rows.length !== h * (stride + 1)) return;
  for (let y = 0; y < h; y++) {
    const i = y * (stride + 1), mode = rows[i];
    if (mode > 4) return;
    if (mode) for (let x = 0; x < stride; x++) {
      const j = i + 1 + x, a = x >= 4 ? rows[j - 4] : 0, b = y ? rows[j - stride - 1] : 0, c = y && x >= 4 ? rows[j - stride - 5] : 0;
      const da = Math.abs(b-c), db = Math.abs(a-c), dc = Math.abs(a+b-2*c);
      rows[j] += mode === 1 ? a : mode === 2 ? b : mode === 3 ? (a+b) >>> 1 : da <= db && da <= dc ? a : db <= dc ? b : c;
    }
  }
  return rows;
}

const path = f => (f.webkitRelativePath || f.name).replaceAll('\\','/').toLowerCase();
export const mapDirectory = f => path(f).slice(0,-f.name.length);

// Map packs may reside beside a byte-identical second copy of the diffuse.
// Never pair files on a basename shared by unrelated actor directories.
export async function matchingPack(diffuse, files, pair) {
  const local = pair(diffuse); if (local) return local;
  const twins = files.filter(f => f.name.toLowerCase() === diffuse.name.toLowerCase() && f.size === diffuse.size && mapDirectory(f) !== mapDirectory(diffuse) && pair(f));
  if (twins.length !== 1) return;
  const [a,b] = await Promise.all([diffuse,twins[0]].map(async f => new Uint8Array(await f.arrayBuffer())));
  if (a.every((v,i) => b[i] === v)) return pair(twins[0]);
}

async function packedData(diffuse, files, w, h) {
  if (!diffuse || !/_D\.png$/i.test(diffuse.name) || !w || !h || w*h > 4096**2) return;
  function pair(d) {
    const sibling = suffix => files.filter(f => path(f) === path(d).replace(/_d\.png$/,suffix));
    const n = sibling('_n.png'), p = sibling('_p.png');
    return n.length === 1 && p.length === 1 ? [n[0],p[0]] : null;
  }
  const companions = await matchingPack(diffuse,files,pair);
  if (!companions) return;
  const [normal,params] = await Promise.all(companions.map(f => rgba8(f,w,h)));
  if (!normal || !params) return;
  const packed = new Uint8Array(w*h*4);
  for (let y=0;y<h;y++) for (let j=y*w*4;j<(y+1)*w*4;j+=4) {
    const i = j+y+1;
    if (normal[i+2] !== 0 || normal[i+3] !== 255) return; // RG-packed tangent normal, not an RGB detail map
    packed[j] = normal[i]; packed[j+1] = normal[i+1]; packed[j+2] = params[i]; packed[j+3] = params[i+3];
  }
  return packed;
}

export async function loadClothDetails(model, indices, resolver, files) {
  const maps = new Map(), cache = new Map();
  for (const i of indices) {
    const m = [model.mesh.material].flat()[i], d = m?.map, ref = m?.userData.mmdMaterial?.texturePath;
    if (!d?.image || !ref) continue;
    const file = await resolver.resolve(ref), w = d.image.width, h = d.image.height;
    if (!cache.has(file)) {
      let data;
      try { data = await packedData(file,files,w,h); } catch { /* unsupported optional pair: keep original grade */ }
      const t = data ? new DataTexture(data,w,h) : null;
      if (t) {
        t.wrapS = d.wrapS; t.wrapT = d.wrapT; t.flipY = d.flipY;
        t.magFilter = LinearFilter; t.minFilter = LinearMipmapLinearFilter; t.generateMipmaps = true; t.needsUpdate = true;
      }
      cache.set(file,t);
    }
    const t = cache.get(file); if (t) maps.set(i,t);
  }
  return maps;
}

// A reflected strip on small fittings. Its long axis stays upright relative
// to the room key; turning the viewer cannot rotate the strip with the screen.
function hardwareReflection(N, L, V, nv, rough, paint) {
  const up = cameraViewMatrix.mul(vec4(0, 1, 0, 0)).xyz;
  const forward = cameraViewMatrix.mul(vec4(0, 0, 1, 0)).xyz;
  const axis = L.cross(L.dot(up).abs().greaterThan(.98).select(forward, up));
  const side = axis.div(axis.length().max(.0001));
  const ray = N.mul(nv.mul(2)).sub(V);
  const miss = ray.dot(L).oneMinus().max(0).add(ray.dot(side).pow2().mul(3));
  const width = rough.pow2().mul(.44).add(.07);
  const strip = smoothstep(width.mul(.12), width, miss).oneMinus();
  const bloom = smoothstep(0, width.add(.5), miss).oneMinus();
  const conductor = paint.mul(.79).add(.16);
  return conductor.mul(strip.mul(rough.mul(-.64).add(1.18)).add(bloom.mul(.24)));
}

// Where the detail normal departs from the underlying plane, their cross
// product runs along the local fold. Stretch the satin reflection along it.
// Nearly flat texels lose anisotropy continuously (no guessed UV weave axis).
function satinReflection(N, H, nh, rough, paint) {
  const fold = normalView.cross(N);
  const along = H.dot(fold).pow2().div(fold.dot(fold).add(.04));
  const miss = nh.pow2().oneMinus().sub(along.mul(.64)).max(0);
  const roll = smoothstep(0, rough.mul(.35).add(.12), miss).oneMinus();
  const fiber = mix(vec3(.62), paint.sqrt(), .62);
  return fiber.mul(roll).mul(rough.oneMinus().pow2().mul(.44).add(.045));
}

export function endfieldGarment(paint, base, role, incident, dataMap) {
  const { view:L, rgb:light, band:key } = incident;
  const sample = dataMap && texture(dataMap).sample(uv());
  let N = normalView;
  if (sample) {
    // UV0 has V down. Reconstruct the slope on the posed surface, including
    // mirrored islands. Use the same packed lookup for R/A, never D's alpha.
    N = normalMap(sample, vec2(.82, -.82));
    N.unpackNormalMode = NormalRGPacking;
  }
  const V = positionViewDirection, half = L.add(V), H = half.div(half.length().max(.0001));
  const nl = N.dot(L), nv = N.dot(V).clamp(), nh = N.dot(H).clamp();
  // The broad form is also the painted underlayer for reflective hardware.
  const fold = sample ? mix(normalView.dot(L), nl, .58) : nl;
  const form = smoothstep(-.46, .48, fold).mul(.57).add(fold.clamp().mul(.43));
  const direct = key.mul(form);
  const ink = mix(paint, base, sample ? .08 : .16);
  // Sheen needs light on this side of the surface. Fade its last few grazing
  // degrees instead of tracing a bright line around the character in stereo.
  const reflectionLight = light.mul(smoothstep(0, .40, nl)).mul(smoothstep(0, .24, nv));

  let rgb;
  if (role === 'leather') {
    const body = ink.mul(direct.mul(.55).add(.34));
    const broad = smoothstep(.64, .98, nh).pow2(), crest = smoothstep(.92, .998, nh);
    rgb = body.add(reflectionLight.mul(broad.mul(.082).add(crest.mul(.066))));
  } else {
    if (!sample && role === 'cloth') {
      // Unmapped cloth is matte; reserve the bright roll for authored data.
      const cloth = ink.mul(vec3(.39, .405, .44).add(direct.mul(vec3(.65, .64, .61))));
      const nap = nv.oneMinus().pow2().mul(.035).mul(nl.clamp());
      rgb = cloth.add(reflectionLight.mul(nap).mul(paint.sqrt()));
    } else {
      const rough = sample ? sample.a.clamp(.12, 1) : float(.32);
      const metal = ink.mul(direct.mul(.44).add(.26))
        .add(reflectionLight.mul(hardwareReflection(N, L, V, nv, rough, paint)));
      if (sample) {
        // Light the two sides of an authored pleat even when the viewer is
        // outside its satin reflection. The wider second band opens the
        // light-facing slope; the trough retains the shadow pigment.
        const pleat = mix(normalView.dot(L), nl, .80);
        const lit = smoothstep(-.24, .44, pleat), slope = smoothstep(.18, .84, pleat);
        const diffuse = vec3(.34, .36, .40).add(key.mul(vec3(.82, .80, .77).mul(lit).add(slope.mul(.47))));
        const silk = ink.mul(diffuse).add(reflectionLight.mul(satinReflection(N, H, nh, sample.a.pow(1 / 2.2).max(.12), paint)));
        rgb = mix(silk, metal, sample.b); // continuous source P.R, before highlight roll-off
      } else rgb = metal;
    }
  }
  // Keep bright diffuse gradients up to .83 linear; compress only the peak
  // of a reflection, with one scale for RGB so a gold fitting stays gold.
  const peak = rgb.r.max(rgb.g).max(rgb.b).max(.83), over = peak.sub(.83);
  return rgb.mul(over.mul(.165).div(over.add(.165)).add(.83).div(peak));
}
