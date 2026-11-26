import { DataTexture, LinearFilter, LinearMipmapLinearFilter } from 'three';
import { NormalRGPacking } from 'three';
import { mix, normalMap, normalView, positionViewDirection, smoothstep, texture, uv, vec2, vec3 } from 'three/tsl';
import { unzlibSync } from 'three/addons/libs/fflate.module.js';

// This fixture accepts the paired RG-normal / R+A-parameter convention only
// for cloth selected in the Endfield grade. Decode data, not display pixels:
// Canvas and external image uploads can premultiply the material ID by roughness.
async function rgba8(file, w, h) {
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

async function packedData(diffuse, files, w, h) {
  if (!diffuse || !/_D\.png$/i.test(diffuse.name) || !w || !h || w*h > 4096**2) return;
  const path = f => (f.webkitRelativePath || f.name).replaceAll('\\','/').toLowerCase();
  const directory = f => path(f).slice(0,-f.name.length);
  function pair(d) {
    const sibling = suffix => files.filter(f => path(f) === path(d).replace(/_d\.png$/,suffix));
    const n = sibling('_n.png'), p = sibling('_p.png');
    return n.length === 1 && p.length === 1 ? [n[0],p[0]] : null;
  }
  let companions = pair(diffuse);
  if (!companions) {
    // Some exports place maps next to a second copy of the diffuse atlas.
    // A similarly named file in another directory isn't sufficient evidence.
    const twins = files.filter(f => f.name.toLowerCase() === diffuse.name.toLowerCase() && f.size === diffuse.size && directory(f) !== directory(diffuse) && pair(f));
    if (twins.length !== 1) return;
    const [a,b] = await Promise.all([diffuse,twins[0]].map(async f => new Uint8Array(await f.arrayBuffer())));
    if (!a.every((v,i) => b[i] === v)) return;
    companions = pair(twins[0]);
  }
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

export function endfieldCloth(paint, base, dataMap, L, light, key) {
  const sample = texture(dataMap).sample(uv()), metal = sample.b, rough = sample.a.clamp(.10,1);
  // UV0 has V down. Transform the packed tangent slope with the posed surface
  // derivatives, including mirrored islands; never bake the portrait light into D.
  const N = normalMap(sample, vec2(.92,-.92)); N.unpackNormalMode = NormalRGPacking;
  const V = positionViewDirection, hv = L.add(V), H = hv.div(hv.length().max(.0001));
  const nl = N.dot(L), nh = N.dot(H).clamp(), form = mix(normalView.dot(L),nl,.83);
  const band = smoothstep(-.18,.40,form), plane = smoothstep(.27,.84,form);
  const ink = mix(paint,base,.08);
  const dye = ink.mul(mix(vec3(.37,.40,.48),vec3(1.02,1.00,1.01), band.mul(key)))
    .mul(plane.mul(key).mul(.30).add(1));
  // Broad satin roll crossing several pleats, with a narrower crest on the
  // slicker threads. High-R trim carries a dyed reflection rather than fabric nap.
  const r = rough.pow(1/2.2), soft = smoothstep(r.mul(-.24).add(.87),.994,nh);
  const crest = smoothstep(r.mul(-.10).add(.973),.999,nh);
  const facing = smoothstep(-.12,.34,nl);
  const fiber = paint.sqrt().mul(.68).add(vec3(.28,.26,.28));
  const silk = dye.add(light.mul(fiber).mul(facing).mul(soft.mul(.24).add(crest.mul(r.oneMinus()).mul(.20))));
  const trimGlint = smoothstep(rough.mul(-.30).add(.96),.998,nh);
  const trim = dye.mul(.70).add(light.mul(paint.mul(.76).add(.14)).mul(facing).mul(trimGlint).mul(.91));
  const rgb = mix(silk,trim,metal), peak = rgb.r.max(rgb.g).max(rgb.b).max(.74), over = peak.sub(.74);
  return rgb.mul(over.mul(.24).div(over.add(.24)).add(.74).div(peak));
}
