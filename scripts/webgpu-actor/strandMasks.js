import { DataTexture, LinearFilter, LinearMipmapLinearFilter, RedFormat } from 'three';
import { mapDirectory, rgba8 } from './endfieldCloth.js';

// An explicitly painted accessory to the *actual diffuse*; a generic _Mask,
// matcap or bright diffuse texel does not identify a strand highlight.
async function readMask(slot, diffuse, files) {
  const name = diffuse.name.toLowerCase()+'.strand-mask.png';
  const matches = files.filter(f=>f.name.toLowerCase()===name && mapDirectory(f)===mapDirectory(diffuse));
  if (matches.length!==1) return;
  const file=matches[0], header=new DataView(await file.slice(0,24).arrayBuffer());
  if (header.byteLength!==24) return;
  const w=header.getUint32(16), h=header.getUint32(20);
  if (!w || !h || w>4096 || h>4096 || w*slot.height!==h*slot.width) return;
  const rgba = await rgba8(file,w,h);
  if (!rgba) return;
  // Strip PNG row filter bytes. Respect transparent black/white in a painted
  // RGBA mask without interpreting it as sRGB or multiplying actor opacity.
  const data=new Uint8Array(w*h);
  for (let y=0;y<h;y++) for (let x=0;x<w;x++) {
    const i=y*w+x, src=4*i+y+1;
    data[i]=Math.round(rgba[src]*rgba[src+3]/255);
  }
  const texture=new DataTexture(data,w,h,RedFormat);
  Object.assign(texture,{wrapS:slot.wrapS,wrapT:slot.wrapT,flipY:slot.flipY,magFilter:LinearFilter,minFilter:LinearMipmapLinearFilter,generateMipmaps:true});
  return texture;
}

export async function loadStrandMasks(inputs, files) {
  const bySlot = new Map(), cache = new Map();
  for (const slot of inputs) {
    if (slot.role!=='hair') continue;
    const diffuse=files[slot.file];
    if (!cache.has(diffuse)) {
      let mask;
      try { mask=await readMask(slot,diffuse,files); } catch { /* Unreadable optional map leaves the painted hair intact. */ }
      cache.set(diffuse,mask);
    }
    const mask=cache.get(diffuse);
    if (mask) bySlot.set(slot.i,mask);
  }
  return bySlot;
}
