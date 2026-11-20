import { useEffect, useState } from 'react';
import { NoColorSpace, RepeatWrapping, SRGBColorSpace, TextureLoader, type Texture } from 'three';

/** Only the mounted room requests its print. A late decoder must not attach
 * a texture to the next room, including on StrictMode's second mount. */
export function useBakedSurface(url:string,kind:'print'|'mask'|'data'='print') {
  const [map,setMap]=useState<Texture|null>(null);
  useEffect(()=>{
    let live=true;
    const texture=new TextureLoader().load(url,t=>{if(live){t.colorSpace=kind==='print'?SRGBColorSpace:NoColorSpace;if(kind==='mask')t.wrapS=RepeatWrapping;t.anisotropy=4;setMap(t);}});
    return ()=>{live=false;texture.dispose();};
  },[url,kind]);
  return map;
}
