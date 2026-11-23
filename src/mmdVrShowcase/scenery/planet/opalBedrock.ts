import type {MeshStandardMaterial,Texture} from 'three';
import {opalGrain} from './surfaceGrain';

// Opaque milky potch in slate. Thin colour is confined to exposed cuts on
// one shoulder of the vein; neither the tread nor the host rock changes hue.
export function opalBedrock(grain:Texture|null):MeshStandardMaterial['onBeforeCompile']{
  const applyGrain=opalGrain(grain,.46);
  return function(shader,renderer){
    applyGrain(shader,renderer);
    shader.vertexShader='attribute float opalOffset; varying float seamMetres;\n'+shader.vertexShader.replace('#include <begin_vertex>',`#include <begin_vertex>
      seamMetres=opalOffset;`);
    shader.fragmentShader='varying float seamMetres;\n'+shader.fragmentShader.replace('#include <color_fragment>',`#include <color_fragment>
      vec3 p=rockPoint;
      float run=dot(p,vec3(.63,.53,-.74)), fold=dot(p,vec3(-.41,.65,.49));
      float bedding=.54*sin(run*1.12+sin(fold*.63))+.28*sin(fold*1.9-run*.3)+.18*sin(run*3.72+fold);
      float strike=atan(-p.z,p.y+.00001), splitA=.5+.5*sin(9.*strike+1.2*sin(5.*strike)), splitB=.5+.5*sin(13.*strike-.8*sin(3.*strike));
      float joint=abs(fract(3.1831*strike+.11*bedding)*2.-1.);
      float d=seamMetres+.18*bedding+.14*joint;
      float broad=.76+.19*sin(strike*7.)+.20*sin(strike*4.+bedding)+.09*joint;
      float shelf=broad*(.63+.68*splitA), toe=broad*(.72+.54*splitB);
      float edge=max(d-shelf,-d-toe), aa=max(.018,fwidth(edge));
      float milk=1.-smoothstep(-aa,aa,edge);
      // Lenses split around islands of host rock, pinch out, then rejoin.
      // Unlike a road border, neither splay runs continuously or at a fixed offset.
      float arm=shelf-.17+splitA*splitA*(1.06+.3*joint),fillet=.044+.17*splitB;
      float branch=(1.-smoothstep(fillet,fillet+aa,abs(d-arm)))*smoothstep(.14,.49,splitA);
      float spur=toe-.10+splitB*splitB*(.73+.20*sin(fold));
      branch=max(branch,.83*(1.-smoothstep(.04,.11+aa,abs(d+spur)))*smoothstep(.32,.66,splitB));
      float layer=d+.21*sin(run*.93+fold*.43)+.12*bedding;
      float grainLift=clamp(1.+grit.r*.52+grit.g*.26,.82,1.2);
      float strata=run*1.76+.58*sin(fold*.77)+.31*bedding;
      float beddingCut=(1.-smoothstep(.02,.37+fwidth(strata),abs(sin(strata))))*smoothstep(-.78,.53,bedding);
      vec3 matrixRock=diffuseColor.rgb*(.87+.15*bedding+.11*sin(strata)+.28*beddingCut);
      vec3 ivory=mix(vec3(.44,.54,.53),vec3(.94,.92,.79),.60+.23*bedding+.16*sin(7.*layer+fold*.75));
      float inclusion=(1.-smoothstep(.02,.14+aa,abs(d-.35*shelf-.25*bedding)))*smoothstep(.42,.78,splitB);
      ivory=mix(ivory,vec3(.32,.39,.36),.45*inclusion);
      float face=(1.-smoothstep(.02,.18+aa,abs(layer-.65*shelf)))*smoothstep(-.35,.49,sin(fold*.86)+.48*sin(run*1.28));
      float angle=abs(dot(normalize(rockEye),normalize(rockNormal)));
      ivory=mix(ivory,mix(vec3(.33,.67,.65),vec3(.58,.47,.68),smoothstep(.22,.85,angle)),face*.80);
       // Bands of opal in the broken shoulder. The coppery selvage occurs on
       // just one side of a seam; keep the centre light enough to follow on foot.
       float v=d-.73*shelf+.13*sin(run*3.7+.57*fold);
       float skin=exp(-12.*v*v)*smoothstep(-.15,.59,bedding+.48*sin(run*2.1-fold));
       float lamina=layer*28.+.86*sin(3.8*run-fold)+1.64*bedding;
       float keep=1.-smoothstep(.32,2.8,fwidth(lamina));
       float luster=pow(.5+.5*cos(lamina),4.)*keep;
       vec3 flash=mix(vec3(.28,.58,.56),vec3(.61,.49,.62),.5+.5*sin(run*2.+1.6*angle));
       ivory=mix(ivory,flash,skin*(.26+.49*luster));
       float rind=abs(edge-.048+.035*bedding),edgeInk=(1.-smoothstep(.022,.063+aa,rind))*smoothstep(-.08,.53,splitA-bedding*.37);
       matrixRock=mix(matrixRock,vec3(.31,.235,.17)*grainLift,edgeInk*.69);
       diffuseColor.rgb=mix(mix(matrixRock,vec3(.48,.56,.52)*grainLift,.80*branch),ivory*grainLift,milk);`);
  };
}
