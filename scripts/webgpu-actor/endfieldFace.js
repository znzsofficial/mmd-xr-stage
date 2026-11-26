import { DataTexture, LinearFilter, LinearMipmapLinearFilter } from 'three';
import { mix, smoothstep, texture, uv, vec2, vec3 } from 'three/tsl';
import { mapDirectory, matchingPack, rgba8 } from './endfieldCloth.js';

const only = a => a.length === 1 ? a[0] : null;
async function pixels(file) {
  const head = new DataView(await file.slice(0,24).arrayBuffer());
  if (head.byteLength < 24) return;
  const w = head.getUint32(16), h = head.getUint32(20);
  if (!w || !h || w>4096 || h>4096) return;
  const rows = await rgba8(file,w,h);
  return rows && {rows,w,h};
}
function surface(data,w,h,d,mips) {
  const t = new DataTexture(data,w,h);
  t.wrapS = d.wrapS; t.wrapT = d.wrapT; t.flipY = d.flipY;
  t.magFilter = LinearFilter; t.minFilter = mips ? LinearMipmapLinearFilter : LinearFilter;
  t.generateMipmaps = mips; t.needsUpdate = true; return t;
}

async function readFaceSet(diffuse, map, files) {
  // An opt-in face slot plus one unambiguous, same-atlas data set. Generic
  // PMX faces without these maps keep the procedural head-relative lighting.
  const family = diffuse.name.toLowerCase().match(/(face_\d+)_d\.png$/)?.[1];
  if (!family) return;
  const pack = await matchingPack(diffuse,files,d=>{
    const siblings = files.filter(f=>mapDirectory(f)===mapDirectory(d));
    const get = suffix=>only(siblings.filter(f=>f.name.toLowerCase().endsWith('_'+family+suffix)));
    const a = [get('_sdf.png'),get('_cm_m.png'),get('_rd.png')]; return a.every(Boolean) ? a : null;
  });
  if (!pack) return;
  const [s,m,r] = await Promise.all(pack.map(pixels));
  if (!s || !m || !r || r.h!==1 || r.w<8 || s.w!==map.image.width || s.h!==map.image.height || m.w*s.h!==m.h*s.w) return;
  const data = new Uint8Array(s.w*s.h*4);
  for(let y=0,k=0;y<s.h;y++) for(let x=0;x<s.w;x++,k+=4) {
    const i=k+y+1, j=(Math.floor((y+.5)*m.h/s.h)*(m.w*4+1))+1+4*Math.floor((x+.5)*m.w/s.w);
    data[k]=s.rows[i]; data[k+1]=s.rows[i+1]; data[k+2]=m.rows[j+1]; data[k+3]=m.rows[j];
  }
  return { field:surface(data,s.w,s.h,map,true), ramp:surface(r.rows.slice(1),r.w,1,map,false) };
}

export async function loadFaceDetails(model,indices,resolver,files) {
  const bySlot = new Map(), cache = new Map();
  for (const i of indices) {
    const material=[model.mesh.material].flat()[i], ref=material?.userData.mmdMaterial?.texturePath;
    if (!material?.map?.image || !ref) continue;
    const diffuse=await resolver.resolve(ref); if (!diffuse) continue;
    if (!cache.has(diffuse)) {
      let set; try { set=await readFaceSet(diffuse,material.map,files); } catch { /* missing/invalid optional face data */ }
      cache.set(diffuse,set);
    }
    if(cache.get(diffuse))bySlot.set(i,cache.get(diffuse));
  }
  return bySlot;
}

// Atlas U increases toward actor left (+local X); the RG field is bright
// toward decreasing U. Mirror for a light on +X. Work in the evaluated head
// frame, never the camera frame, so orbiting cannot flip the terminator.
export function mappedFace(paint,base,fieldSet,side,front,nl,key) {
  const facing=vec2(side,front), len=facing.length().max(.0001), azimuth=front.div(len).clamp(-1,1);
  const threshold=azimuth.acos().div(Math.PI);
  const st=uv(), coord=vec2(side.greaterThan(0).select(st.x.oneMinus(),st.x),st.y);
  const data=texture(fieldSet.field).sample(coord);
  const dist=data.r.add(data.g).mul(.5);
  // At exactly front/back the mirror switches UV islands. Ease into the
  // symmetric axial light there instead of snapping a temple to the other side.
  const face=mix(smoothstep(-.1,.1,azimuth),smoothstep(threshold.sub(.13),threshold.add(.13),dist),smoothstep(0,.18,side.abs().div(len)));
  // Near-polar lights have an undefined horizontal bearing. Neck/atlas
  // islands selected by the refine G channel use the posed surface normal.
  const geometric=smoothstep(-.35,.55,nl);
  const lit=mix(geometric,face,smoothstep(.03,.22,facing.length()).mul(data.b.oneMinus()));
  const ramp=texture(fieldSet.ramp).sample(vec2(lit.mul(.73).add(.13),.5)).rgb;
  // The local ramp's red channel leads green/blue through the penumbra.
  // Keep its warm diffusion tint off the ink and out of unlit regions.
  const form=mix(vec3(.56,.50,.54),vec3(1.28,1.21,1.17),mix(vec3(lit),ramp,data.a.mul(.28).add(.22)).mul(key));
  return mix(paint.pow(.77).mul(form),base,.09).clamp();
}
