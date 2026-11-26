import { cameraViewMatrix, max, mix, normalView, objectPosition, objectWorldMatrix, positionViewDirection,
  positionWorld, smoothstep, uniform, vec3, vec4 } from 'three/tsl';
import { diffusePigment, hybridToonColor } from './hybridToon.js';
import { endfieldCloth } from './endfieldCloth.js';
import { mappedFace } from './endfieldFace.js';
import { skinTransmission } from './skinTransmission.js';

// A broad plane across both cheeks avoids putting a sharp terminator on the
// small nose polygons. Anchor the width and midline to the evaluated skeleton.
function cheekLighting(mesh, L, geometric, paint, base, key, field) {
  const find = (...names) => mesh.skeleton.bones.find(b => [b.name, b.userData.mmdEnglishBoneName].some(n => n && names.includes(n.toLowerCase())));
  const head = find('頭','head'), a = find('左目','left eye','eye_l'), b = find('右目','right eye','eye_r');
  let diffuse=geometric;
  if (head) {
    const headWorld = objectWorldMatrix(head);
    const x = headWorld.mul(vec4(1,0,0,0)).xyz.normalize(), z = headWorld.mul(vec4(0,0,1,0)).xyz.normalize();
    if(field) return mappedFace(paint,base,field,x.dot(L),z.dot(L),geometric,key);
    if (a && b) {
      const left=objectPosition(a), right=objectPosition(b), mid=left.add(right).mul(.5);
      const across=positionWorld.sub(mid).dot(x).div(left.sub(right).length().max(.0001)).clamp(-1.7,1.7);
      diffuse=mix(z.dot(L).mul(.80).add(across.mul(x.dot(L)).mul(.78)),geometric,.22);
    }
  }
  return skinBase(paint,base,diffuse,key);
}

function skinBase(paint,base,diffuse,key) {
  const band=smoothstep(-.23,.23,diffuse).mul(key);
  const ink=paint.pow(.77).mul(mix(vec3(.78,.64,.67),vec3(1.29,1.22,1.19),band));
  return mix(ink,base,.09).clamp();
}

export function endfieldColor(base, material, role, mesh, maps, index) {
  const u = material.userData.mmdTslMaterialUniforms, paint = diffusePigment(material, u);
  const light = uniform(u.lightColor), worldL = uniform(u.lightDirection);
  const L = cameraViewMatrix.mul(vec4(worldL, 0)).xyz, nl = normalView.dot(L);
  const key = max(light.r, max(light.g, light.b)).clamp();
  if (role === 'face') {
    const field=maps?.face?.get(index);
    return cheekLighting(mesh,worldL,nl,paint,base,field && maps.faceKeyVisibility ? key.mul(maps.faceKeyVisibility) : key,field);
  }
  if (role === 'skin') {
    const pigment=skinBase(paint,base,nl,key);
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
  return hybridToonColor(mix(base, paint.pow(.90).mul(1.22), .78), material, role);
}
