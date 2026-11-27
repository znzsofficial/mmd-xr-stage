import { cameraViewMatrix, float, max, mix, normalView, objectPosition, objectWorldMatrix, positionViewDirection,
  positionWorld, smoothstep, uniform, vec3, vec4 } from 'three/tsl';
import { hybridToonColor } from './hybridToon.js';
import { endfieldCloth } from './endfieldCloth.js';
import { mappedFace } from './endfieldFace.js';
import { skinBandDelta, surfaceRadii } from './skinDiffusion.js';
import { skinTransmission } from './skinTransmission.js';

function skinLandmarks(mesh) {
  const find = (...names) => mesh.skeleton?.bones.find(b => [b.name, b.userData.mmdEnglishBoneName].some(n => n && names.includes(n.toLowerCase())));
  const head = find('頭','head'), a = find('左目','left eye','eye_l'), b = find('右目','right eye','eye_r');
  const left = a && objectPosition(a), right = b && objectPosition(b);
  return { head, left, right, eyeSpan: left && right && left.sub(right).length() };
}

// A broad plane across both cheeks avoids putting a sharp terminator on the
// small nose polygons. Anchor the width and midline to the evaluated skeleton.
function cheekLighting({head,left,right,eyeSpan}, L, geometric, paint, base, key, field, diffusion) {
  let diffuse=geometric;
  if (head) {
    const headWorld = objectWorldMatrix(head);
    const x = headWorld.mul(vec4(1,0,0,0)).xyz.normalize(), z = headWorld.mul(vec4(0,0,1,0)).xyz.normalize();
    if(field) return mappedFace(paint,base,field,x.dot(L),z.dot(L),geometric,key,diffusion,eyeSpan);
    if (left && right) {
      const mid=left.add(right).mul(.5);
      const across=positionWorld.sub(mid).dot(x).div(eyeSpan.max(.0001)).clamp(-1.7,1.7);
      diffuse=mix(z.dot(L).mul(.80).add(across.mul(x.dot(L)).mul(.78)),geometric,.22);
    }
  }
  return skinBase(paint,base,diffuse,key,diffusion,eyeSpan);
}

function skinBase(paint,base,diffuse,key,diffusion,eyeSpan) {
  let band=smoothstep(-.23,.23,diffuse);
  if (diffusion !== 0) {
    const delta=skinBandDelta(band,diffuse,.23,surfaceRadii(diffuse,eyeSpan));
    band=band.add(delta.mul(float(diffusion).clamp()));
  }
  const ink=paint.pow(.77).mul(mix(vec3(.78,.64,.67),vec3(1.29,1.22,1.19),band.mul(key)));
  return mix(ink,base,.09).clamp();
}

export function endfieldColor(base, material, role, mesh, maps, index, paint) {
  const u = material.userData.mmdTslMaterialUniforms;
  const light = uniform(u.lightColor), worldL = uniform(u.lightDirection);
  const L = cameraViewMatrix.mul(vec4(worldL, 0)).xyz, nl = normalView.dot(L);
  const key = max(light.r, max(light.g, light.b)).clamp();
  const diffusion=maps?.skinDiffusion ?? 1;
  if (role === 'face') {
    const field=maps?.face?.get(index);
    const visibleKey=field && maps.faceKeyVisibility ? key.mul(maps.faceKeyVisibility) : key;
    return cheekLighting(skinLandmarks(mesh),worldL,nl,paint,base,visibleKey,field,diffusion);
  }
  if (role === 'skin') {
    const eyeSpan=diffusion !== 0 && skinLandmarks(mesh).eyeSpan;
    const pigment=skinBase(paint,base,nl,key,diffusion,eyeSpan);
    return maps?.thinSkin ? pigment.add(skinTransmission(paint,L,light)).clamp() : pigment;
  }
  if (role === 'hair') {
    const form = smoothstep(-.34,.53,nl).mul(key);
    const half = L.add(positionViewDirection), nh = normalView.dot(half.div(half.length().max(.0001)));
    const strand = smoothstep(.10,.43,paint.dot(vec3(.28,.58,.14)));
    const glint = smoothstep(.69,.95,nh).mul(strand).mul(form);
    const body = paint.pow(.83).mul(mix(vec3(.64,.53,.58), vec3(1.42,1.31,1.16), form));
    return mix(body,base,.12).add(paint.mul(vec3(.42,.36,.26)).mul(glint)).clamp();
  }
  if (role === 'cloth' && maps?.cloth?.has(index)) return endfieldCloth(paint,base,maps.cloth.get(index),L,light,key);
  // Feed painted fabric into the existing directional BRDF. Re-light most of
  // its albedo so the old toon shadow doesn't double up with the fabric band.
  return hybridToonColor(mix(base, paint.pow(.90).mul(1.22), .78), material, role, paint);
}
