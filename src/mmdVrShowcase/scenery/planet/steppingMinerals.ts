import type {MeshBasicMaterial,Texture} from 'three';
import {opalGrain} from './surfaceGrain';

// Mid-scale marks, between the silhouette-scale coloured relief and the shared
// fine grain. No displacement, view-dependent glints, or additional samplers.
const deposits=`
float edgeInk(float distanceToLine,float halfWidth,float aa){
  return 1.-smoothstep(halfWidth-aa,halfWidth+aa,distanceToLine);
}
#ifdef MICA_CLEAVAGE
vec3 deposit(vec3 p,vec3 ink,float range){
  vec3 n=normalize(p);
  // Follow the very same tilted, folded bedding as the mica relief. The
  // partings split into short overlapping leaves, not stripes around a ball.
  float bed=3.1*n.y+1.3*n.x-.65*n.z+.13*sin(4.*n.z);
  float phase=2.*bed+.09*sin(13.*n.x+5.*n.y)+.034*sin(21.*n.z-4.*n.y);
  float w=max(.001,fwidth(phase));
  float near=(1.-smoothstep(4.5,10.,range))*(1.-smoothstep(.042,.14,w));
  float aa=min(.055,.55*w);
  float reach=smoothstep(-.47,.19,sin(7.*n.x-8.*n.z+1.7*bed)+.43*sin(13.*n.y+4.*n.z));
  float part=abs(fract(phase+.5)-.5),lip=abs(fract(phase+.43)-.5);
  float split=abs(fract(phase+.29+.045*sin(16.*n.z))-.5);
  float shadow=edgeInk(part,.038,aa)*(.60+.4*reach);
  shadow=max(shadow,.68*edgeInk(split,.021,aa)*smoothstep(.28,.91,reach));
  vec3 leaf=ink*(1.-.64*near*reach*shadow);
  return leaf+ink*vec3(.59,.55,.40)*near*reach*edgeInk(lip,.022,aa);
}
#else
vec3 cellNoise(vec2 id){
  vec3 q=fract(vec3(id.xyx)*vec3(.1031,.1030,.0973));q+=dot(q,q.yxz+33.33);
  return fract((q.xxy+q.yzz)*q.zyx);
}
vec3 deposit(vec3 p,vec3 ink,float range){
  vec3 n=normalize(p),a=abs(n);vec2 uv;float face;
  if(a.x>=a.y&&a.x>=a.z){uv=n.yz/a.x;face=1.+step(0.,n.x);}
  else if(a.y>=a.z){uv=n.zx/a.y;face=3.+step(0.,n.y);}
  else{uv=n.xy/a.z;face=5.+step(0.,n.z);}
  // One offset vent in an occasional cell. Radius and jitter keep the complete
  // rim inside its cell; fade at face joins instead of stretching the pockets.
  vec2 grid=(uv+1.)*2.5;
  vec3 seed=cellNoise(floor(grid)+face*vec2(13.,23.));
  vec2 local=fract(grid)-.5-(seed.xy-.5)*.39;
  float r=length(local*vec2(.92,1.06))+.011*sin(33.*local.x+seed.x*3.)*sin(29.*local.y);
  float rim=.137+.060*seed.y,w=max(.001,length(fwidth(grid))),aa=min(.05,.52*w);
  float vis=step(.58,seed.z)*(1.-smoothstep(.91,.99,max(abs(uv.x),abs(uv.y))))
    *(1.-smoothstep(4.8,10.,range))*(1.-smoothstep(.039,.13,w));
  float hollow=1.-smoothstep(.50*rim,rim,r),raised=edgeInk(abs(r-rim),.022,aa);
  float lee=smoothstep(-.10,.045,.74*local.y-.61*local.x);
  vec3 bed=ink*(1.-vis*hollow*(.34+.18*lee));
  // Preserve the baked daylight: the sand desaturates the ochre rim and
  // catches a little light only on one side, never glows on the night face.
  vec3 sand=vec3(1.44,1.35,1.06)*dot(ink,vec3(.25,.64,.11));
  return mix(bed,sand,vis*raised*(.17+.76*lee));
}
#endif`;

export function stoneFinish(grain:Texture|null,gain:number):MeshBasicMaterial['onBeforeCompile']{
  const fine=opalGrain(grain,gain);
  return (shader,renderer)=>{fine(shader,renderer);
    shader.fragmentShader=deposits+'\n'+shader.fragmentShader.replace('#include <color_fragment>',
      '#include <color_fragment>\n diffuseColor.rgb=deposit(rockPoint,diffuseColor.rgb,length(rockEye));');
  };
}
