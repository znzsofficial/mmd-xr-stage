import {DataTexture,LinearFilter,LinearMipmapLinearFilter,RepeatWrapping} from 'three';
import {groveSites,reedRelief,reedRadius,reedSeaLevel} from './reedBiosphere';

/** Low-frequency reflected albedo of Reedwater, registered to its actual
 * world axes, lagoons and groves. Lighting and silhouette are per water eye. */
export function reedReflectionPrint(){
  const w=192,h=96,bytes=new Uint8Array(4*w*h);
  for(let j=0;j<h;j++)for(let i=0;i<w;i++){
    const lon=(i+.5)*2*Math.PI/w,lat=((j+.5)/h-.5)*Math.PI,k=Math.cos(lat);
    const x=-k*Math.cos(lon),y=Math.sin(lat),z=k*Math.sin(lon),above=reedRelief(x,y,z)-reedSeaLevel;
    const t=Math.min(1,Math.max(0,(above-.025)/.11)),wet=Math.min(1,Math.max(0,-above/.40));
    const soil=.5+.45*Math.sin(3.3*x*reedRadius+1.5*Math.sin(y*reedRadius*2.7)+1.6*z*reedRadius)*Math.cos(1.8*z*reedRadius-y*1.5);
    const beach=Math.exp(-((above/.075)**2));let shade=1;
    for(const s of groveSites){const u=s.up.x*x+s.up.y*y+s.up.z*z;if(u>.985)shade=Math.min(shade,1-.32*(u-.985)/.015);}
    const rgb=[(.031-.016*wet)*(1-t)+(.070+.18*soil)*t+.23*beach,(.43-.24*wet)*(1-t)+(.23+.22*soil)*t+.14*beach,(.33-.11*wet)*(1-t)+(.058+.056*soil)*t+.06*beach];
    const n=4*(i+j*w);for(let ch=0;ch<3;ch++)bytes[n+ch]=Math.round(255*Math.min(1,rgb[ch]*shade));bytes[n+3]=255;
  }
  const map=new DataTexture(bytes,w,h);map.wrapS=RepeatWrapping;map.magFilter=LinearFilter;map.minFilter=LinearMipmapLinearFilter;map.generateMipmaps=true;map.needsUpdate=true;return map;
}
