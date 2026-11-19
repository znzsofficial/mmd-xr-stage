import { useEffect, useState } from 'react';
import { SRGBColorSpace, TextureLoader, type Texture } from 'three';

/** Only the mounted room requests its print. A late decoder must not attach
 * a texture to the next room, including on StrictMode's second mount. */
export function useBakedSurface(url:string) {
  const [map,setMap]=useState<Texture|null>(null);
  useEffect(()=>{
    let live=true;
    const texture=new TextureLoader().load(url,t=>{if(live){t.colorSpace=SRGBColorSpace;t.anisotropy=4;setMap(t);}});
    return ()=>{live=false;texture.dispose();};
  },[url]);
  return map;
}
