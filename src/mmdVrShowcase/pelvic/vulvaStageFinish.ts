import {DataTexture,LinearFilter,LinearMipmapLinearFilter,MeshStandardMaterial,NearestFilter,RedFormat,type Box3} from 'three';
import {formColors,vulvaHalves} from './vulvaForm';
import {foldFinish,stageRoughness} from './vulvaFinish';
import {printW,printH,halfX,halfY,type GarmentPrint} from './garmentPrint';

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

export function createTissueCover(){
  const bytes=new Uint8Array(printW*printH),tex=new DataTexture(bytes,printW,printH,RedFormat);
  tex.name='pelvic:garment-coverage';tex.minFilter=tex.magFilter=NearestFilter;tex.needsUpdate=true;
  const field={value:tex},scale={value:0};let last:GarmentPrint|null=null,version=-1;
  return {field,scale,dispose:()=>tex.dispose(),apply(sample:GarmentPrint|null|undefined,r:number,bounds:Box3){
    scale.value=sample?.covered?1/r:0;if(!sample?.covered)return true;
    if(last!==sample||version!==sample.version){bytes.set(sample.pixels);tex.needsUpdate=true;last=sample;version=sample.version;}
    const col=(x:number)=>Math.min(printW-1,Math.max(0,Math.floor((.5+x/(2*r*halfX))*printW)));
    const row=(y:number)=>Math.min(printH-1,Math.max(0,Math.floor((.5+y/(2*r*halfY))*printH)));
    const hiX=col(bounds.max.x),hiY=row(bounds.max.y),loX=col(bounds.min.x);
    for(let y=row(bounds.min.y);y<=hiY;y++)for(let x=loX;x<=hiX;x++)if(!sample.pixels[y*printW+x])return true;
    return false;
  }};
}

export function createTissueMaterial(roughnessMap:DataTexture,cover?:ReturnType<typeof createTissueCover>){
  const material=new MeshStandardMaterial({name:'pelvic:tissue',vertexColors:true,roughness:1,roughnessMap});
  // This skin sits against toon-shaded actors. Use the room's soft fill as
  // the tissue's ambient colour rather than the darker Lambert irradiance/π.
  // Direct light, occlusion and the narrow specular lobe keep their normals;
  // the material still goes dark in an unlit room.
  material.onBeforeCompile=shader=>{if(cover){shader.uniforms.garmentField=cover.field;shader.uniforms.garmentScale=cover.scale;
    shader.vertexShader='varying vec2 vFitXY;\n'+shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nvFitXY=position.xy;');
    shader.fragmentShader='varying vec2 vFitXY; uniform sampler2D garmentField; uniform float garmentScale;\n'+shader.fragmentShader.replace('#include <clipping_planes_fragment>',
      `#include <clipping_planes_fragment>\nif(garmentScale>0.0 && texture2D(garmentField,vec2(.5)+vFitXY*garmentScale/vec2(${2*halfX}.0,${2*halfY}.0)).r>.5)discard;`);}
    shader.fragmentShader=shader.fragmentShader.replace('#include <lights_fragment_end>',
    '#include <lights_fragment_end>\nreflectedLight.indirectDiffuse *= 1.13 * PI;');};
  material.customProgramCacheKey=()=>cover?'pelvic-skin-cloth-print-v1':'pelvic-skin-fill-v1';
  return material;
}
