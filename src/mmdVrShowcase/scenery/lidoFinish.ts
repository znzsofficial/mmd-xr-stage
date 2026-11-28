import {DataTexture,LinearFilter,LinearMipmapLinearFilter,MathUtils} from 'three';
import {POOL} from './LidoLayout';
import {SHORE_SUN} from './shoreDaylight';
import type {Part} from './SceneryBatch';

// One data map on the existing deck. R is the low-profile canopy shade;
// G is the roughness of the dry stone and the wet mosaic at the deep edge.
export function deckFinish(shadows:boolean){
  const {deck,water,parasols}=POOL, width=256, height=144, data=new Uint8Array(width*height*4);
  const [sx,sy,sz]=SHORE_SUN, edgeHeight=2.51-.48;
  for(let j=0;j<height;j++)for(let i=0;i<width;i++){
    const x=deck.x+((i+.5)/width-.5)*deck.w,z=deck.z+(.5-(j+.5)/height)*deck.d;
    let shade=1;
    if(!shadows)for(const parasol of parasols){
      const r=Math.hypot(x-parasol.x+edgeHeight*sx/sy,z-parasol.z+edgeHeight*sz/sy);
      shade=Math.min(shade,.43+.57*MathUtils.smoothstep(r,1.32,1.54));
    }
    const toRim=Math.hypot(Math.max(0,Math.abs(x-water.x)-water.w/2),z-(water.z+water.d/2));
    const dry=MathUtils.smoothstep(toRim,.32,.71),k=(j*width+i)*4;
    data[k]=Math.round(255*shade);data[k+1]=Math.round(255*(.32+.58*dry));data[k+3]=255;
  }
  const map=new DataTexture(data,width,height);
  map.magFilter=LinearFilter;map.minFilter=LinearMipmapLinearFilter;map.generateMipmaps=true;map.needsUpdate=true;
  return map;
}

// Glazed caps have a real 4 mm grout joint, over the darker continuous bed.
export function copingTiles(){
  const parts:Part[]=[],{x,z,w,d}=POOL.water, width=.26;
  function run(cx:number,cz:number,length:number,side:boolean){
    const count=Math.round(length/.30),pitch=length/count;
    for(let i=0;i<count;i++){
      const along=(i+.5)*pitch-length/2;
      parts.push({p:[cx+(side?0:along),.006,cz+(side?along:0)],s:side?[width,.025,pitch-.004]:[pitch-.004,.025,width],
        color:['#a5bfb4','#b1c7ba','#aec6bb','#aac0b7'][i%4]});
    }
  }
  for(const sign of [-1,1]){
    run(x+sign*(w/2+.08),z,d-width,true);
    run(x,z+sign*d/2,w+.16+width,false);
  }
  return parts;
}
