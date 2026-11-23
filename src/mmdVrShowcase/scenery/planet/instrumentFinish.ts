import {Uint8BufferAttribute,type BufferGeometry,type MeshStandardMaterial} from 'three';
import {PaintedParts} from '../../play/modelParts';

const copper=new Set(['#cf874d','#b28b63']),porcelain=new Set(['#ffe8b4','#edcc96']);
const optical=new Set(['#ffd489','#2a4f62','#9fe4cf']);
/** Carry the authored finish through geometry batching. No texture or extra
 * draw is needed to separate a mineral facet from a painted cast-metal shoe. */
export class InstrumentParts extends PaintedParts{
  constructor(private mineral:boolean){super();}
  override add(g:BufferGeometry,paint:string){
    const type=this.mineral&&paint!=='#5a6685'?4:copper.has(paint)?1:porcelain.has(paint)?2:optical.has(paint)?3:0;
    g.setAttribute('finishCode',new Uint8BufferAttribute(new Uint8Array(g.attributes.position.count).fill(type),1));super.add(g,paint);
  }
}

export const instrumentFinish:MeshStandardMaterial['onBeforeCompile']=s=>{
  s.vertexShader='attribute float finishCode; varying float finishId; varying vec3 toolPos;\n'+s.vertexShader.replace('#include <begin_vertex>',`#include <begin_vertex>
    finishId=finishCode;toolPos=position;`);
  s.fragmentShader='varying float finishId;varying vec3 toolPos;\n'+s.fragmentShader.replace('#include <color_fragment>',`#include <color_fragment>
    float bronze=1.-step(.25,abs(finishId-1.)),shell=1.-step(.25,abs(finishId-2.)),lens=1.-step(.25,abs(finishId-3.)),quartz=step(3.5,finishId);
    float lay=toolPos.y*318.+1.1*sin(14.*toolPos.x+7.*toolPos.z);
    float lathe=cos(lay)*(1.-smoothstep(.35,2.8,fwidth(lay)));
    float swale=.5+.5*sin(4.*toolPos.x+6.*toolPos.z+1.5*sin(5.*toolPos.y));
    float tarnish=bronze*(1.-smoothstep(.04,.32,toolPos.y))*(.10+.43*swale);
    diffuseColor.rgb=mix(diffuseColor.rgb*(1.+.07*lathe*bronze),vec3(.095,.186,.164),tarnish);
    float band=8.3*toolPos.y-3.6*toolPos.x+1.8*sin(4.9*toolPos.z+toolPos.x);
    float strata=smoothstep(.42,.89,.5+.5*sin(band))*smoothstep(.06,.36,toolPos.y);
    diffuseColor.rgb*=1.-quartz*.18*(1.-strata);
    diffuseColor.rgb+=quartz*strata*vec3(.055,.063,.087);
    diffuseColor.rgb*=1.-.10*shell*(1.-swale);`)
    .replace('#include <roughnessmap_fragment>',`#include <roughnessmap_fragment>
      roughnessFactor=mix(.66,.37+.20*tarnish,bronze);roughnessFactor=mix(roughnessFactor,.42,shell);roughnessFactor=mix(roughnessFactor,.28,lens);roughnessFactor=mix(roughnessFactor,.32+.22*(1.-strata),quartz);`)
    .replace('#include <metalnessmap_fragment>',`#include <metalnessmap_fragment>
      metalnessFactor=mix(.055,.44-.21*tarnish,bronze);`);
};
