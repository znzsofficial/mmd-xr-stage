import {DataTexture,LinearFilter,LinearMipmapLinearFilter} from 'three';
import {formColors,vulvaHalves} from './vulvaForm';
import {foldFinish,stageRoughness} from './vulvaFinish';

const columns=formColors.length,width=2*columns-1,height=vulvaHalves[0].rows.length;
let texels:Uint8Array<ArrayBuffer>|undefined;
function roughnessField(){
  const data=new Uint8Array(width*height*4),fields=foldFinish();
  for(const [h,{side}] of vulvaHalves.entries())for(let j=0;j<height;j++)for(let k=0;k<columns;k++){
    const {wet,broad}=fields[(h*height+j)*columns+k],p=4*(j*width+columns-1+side*k);
    data[p+1]=Math.round(255*stageRoughness(wet,broad));data[p+3]=255;
  }
  return data;
}
export function createVulvaRoughness(){
  // Immutable CPU texels can be shared; each mount owns its GPU lifecycle.
  // The transverse profile and longitudinal taper localize the reflection;
  // only actual scene lights and the displayed surface normal can turn it on.
  const texture=new DataTexture(texels??=roughnessField(),width,height);
  texture.name='pelvic:tissue-roughness';texture.magFilter=LinearFilter;texture.minFilter=LinearMipmapLinearFilter;
  texture.generateMipmaps=true;texture.needsUpdate=true;return texture;
}
