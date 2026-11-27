import { Vector3 } from 'three';
import { float, mix, normalView, objectWorldMatrix, positionWorld, smoothstep, texture, uv, vec2, vec3, vec4 } from 'three/tsl';
import { actorKeyLight } from './hybridToon.js';
import { mmdStylePigment } from './mmdStylePigment.js';

// The eyes locate the portrait in the bind pose. Carry that frame with the
// evaluated head, independently of VMD gaze, local bone axes and actor scale.
// Never mirror, threshold or translate the diffuse atlas to find a cheek.
function faceLight(mesh, light) {
  const skeleton = mesh.skeleton;
  const bone = (...names) => skeleton?.bones.findIndex(b => [b.name,b.userData.mmdBoneName,b.userData.mmdEnglishBoneName]
    .some(name => name && names.includes(name.toLowerCase()))) ?? -1;
  const head = bone('頭','头','head'), left = bone('左目','left eye','eye_l'), right = bone('右目','right eye','eye_r');
  if ([head,left,right].some(i => !skeleton?.boneInverses[i])) return float(.77);
  const toHead = skeleton.boneInverses[head];
  const bindEye = i => new Vector3().setFromMatrixPosition(skeleton.boneInverses[i].clone().invert()).applyMatrix4(toHead);
  const a = bindEye(left), b = bindEye(right), across = a.clone().sub(b), width = across.length();
  if (!Number.isFinite(width) || width < .0001) return float(.77);
  const bindUp = new Vector3(0,1,0).transformDirection(mesh.bindMatrix).transformDirection(toHead);
  across.normalize();
  const forward = across.clone().cross(bindUp);
  if (forward.lengthSq() < .5) return float(.77);
  forward.normalize();
  // Some rigs label L/R in viewer space. The loader converts PMX forward to +Z.
  const bindFront = new Vector3(0,0,1).transformDirection(mesh.bindMatrix).transformDirection(toHead);
  if (forward.dot(bindFront) < 0) forward.negate();
  const world = objectWorldMatrix(skeleton.bones[head]);
  const transform = (v,w) => world.mul(vec4(...v.toArray(),w)).xyz;
  const span = transform(across.multiplyScalar(width),0);
  const x = span.div(span.length().max(.0001)), z = transform(forward,0).normalize();
  const up = transform(bindUp,0).normalize();
  const offset = positionWorld.sub(transform(a.lerp(b,.5),1)).div(span.length().max(.0001));
  const jaw = smoothstep(.15,1.0,offset.dot(up).negate());
  const cheek = offset.dot(x).mul(jaw.mul(.30).add(.85)).clamp(-.98,.98);
  const bearing = vec2(x.dot(light),z.dot(light));
  const horizontal = bearing.length(), direction = bearing.div(horizontal.max(.0001));
  const front = cheek.mul(cheek).oneMinus().sqrt();
  const lit = smoothstep(-.10,.12,cheek.mul(direction.x).add(front.mul(direction.y)).sub(.12));
  return mix(.77,lit,smoothstep(.05,.32,horizontal));
}

export function strinovaColor(mmd, material, role, mesh, strandMask) {
  const { paint,resolve } = mmdStylePigment(material), key = actorKeyLight(material);
  const nl = normalView.dot(key.view);
  if (role === 'face' || role === 'skin') {
    const lit = role === 'face' ? faceLight(mesh,key.world) : smoothstep(-.16,.16,nl);
    // Modest contrast on the entire face leaves painted-in liner and blush
    // intact. Independent eyes/lashes never enter the list of styled draws.
    const tone = mix(vec3(.80,.63,.63),vec3(1.16,1.13,1.08),lit.mul(key.band));
    return resolve(mix(paint.pow(.91).mul(tone),mmd,.14).clamp(),mmd);
  }
  if (role === 'hair') {
    const lightSide = smoothstep(-.08,.16,nl), lit = lightSide.mul(key.band);
    let hair = paint.pow(.93).mul(mix(vec3(.66,.57,.65),vec3(1.15,1.09,1.06),lit));
    hair = mix(hair,mmd,.23);
    if (strandMask) {
      const mark = texture(strandMask).sample(uv()).r;
      const amount = mark.mul(lightSide.mul(.58).add(.32)).mul(key.band)
        .mul(material.userData.stageMaterial?.originalDiffuseWeight ?? 1);
      // Move partway towards the lighter *pigment* only within the UV mark;
      // white painted streaks have no remaining headroom. No view-facing stripe.
      const highlight = mix(paint.sqrt(),vec3(1),.27);
      hair = hair.add(highlight.sub(hair).max(0).mul(amount));
    }
    return resolve(hair.clamp(),mmd);
  }
  // Two cool painted folds and a flatter light-facing panel. Unlike the
  // Endfield textile there is no roughness/gloss reflection lobe on the cloth.
  const mid = smoothstep(-.27,-.06,nl).mul(key.band), top = smoothstep(.34,.51,nl).mul(key.band);
  const shadow = role === 'leather' ? vec3(.35,.33,.43) : vec3(.46,.49,.63);
  const tone = mix(mix(shadow,vec3(.79,.79,.87),mid),vec3(1.13,1.11,1.10),top);
  // Retain the authored sphere/reflection on identified fittings.
  return resolve(mix(paint.mul(tone),mmd,role === 'metal' ? .68 : .15).clamp(),mmd);
}
