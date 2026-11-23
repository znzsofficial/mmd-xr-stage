import {BufferGeometry,Float32BufferAttribute} from 'three';
import {tideChart,tideFloor,tideWaterBounds,tideWaterFootprint} from './tideLayout';
import {floodLevel} from './tideClock';

/** A stitched, bed-sampled patch rather than a full planet-sized sea plane.
 * Heights remain in north-landing coordinates on their way to the fragment. */
export function tidePool(){
  const {minX,maxX,minZ,maxZ}=tideWaterBounds,dx=(tideChart.maxX-tideChart.minX)/tideChart.cols,dz=(tideChart.maxZ-tideChart.minZ)/tideChart.rows;
  const x0=tideChart.minX+Math.floor((minX-tideChart.minX)/dx)*dx,z0=tideChart.minZ+Math.floor((minZ-tideChart.minZ)/dz)*dz;
  const cols=Math.ceil((maxX-x0)/dx),rows=Math.ceil((maxZ-z0)/dz),xyz:number[]=[],bed:number[]=[],ix:number[]=[],stride=cols+1;
  for(let j=0;j<=rows;j++)for(let i=0;i<=cols;i++){
    const x=x0+i*dx,z=z0+j*dz;xyz.push(x,0,z);bed.push(tideFloor(x,z));
    if(i&&j&&tideWaterFootprint(x-dx*.5,z-dz*.5)){const d=j*stride+i,a=d-1-stride,b=d-stride,c=d-1;
      if(Math.min(bed[a],bed[b],bed[c])<floodLevel)ix.push(a,c,b);
      if(Math.min(bed[b],bed[c],bed[d])<floodLevel)ix.push(b,c,d);}
  }
  const g=new BufferGeometry();g.setAttribute('position',new Float32BufferAttribute(xyz,3));g.setAttribute('bed',new Float32BufferAttribute(bed,1));g.setIndex(ix);g.computeBoundingSphere();return g;
}

export const tideWaterVertex=`attribute float bed; varying vec3 world,eye; varying float bottom;
void main(){vec4 wp=modelMatrix*vec4(position,1.);world=wp.xyz;bottom=bed;eye=cameraPosition-world;gl_Position=projectionMatrix*viewMatrix*wp;}`;
// The finite neighbouring moon is traced along the reflected eye ray. Each
// eye sees its own disc and parallax; no mirrored camera or extra scene pass.
export const tideWaterFragment=`varying vec3 world,eye;varying float bottom;
uniform vec3 moon,sun;uniform float radius,water,clock;uniform sampler2D reedPrint;
void main(){
  float depth=water-bottom;if(depth<=.004)discard;
  vec2 p=world.xz;float a=dot(p,vec2(5.1,2.3))+sin(.81*p.y)-clock*1.2;
  float b=dot(p,vec2(-3.1,10.3))+sin(2.*p.x+.39*clock)+clock*1.62;
  float fold=cos(a)*(.80+.20*cos(b));float grain=sin(b)*(1.-smoothstep(.1,1.6,fwidth(b)));
  vec3 N=normalize(vec3(.016*fold+.004*grain,1.,.018*grain+.006*fold));
  vec3 V=normalize(eye),D=reflect(-V,N),rel=moon-world;
  float farT=dot(D,rel);vec3 offset=farT*D-rel;float disc=radius*radius-dot(offset,offset);float aa=max(.16,fwidth(disc));
  float rim=clamp(1.-abs(dot(N,V)),0.,1.);float fres=.15+.84*pow(rim,2.);
  vec3 base=mix(vec3(.043,.21,.176),vec3(.002,.039,.058),smoothstep(0.,.50,depth));
  vec3 sky=mix(vec3(.008,.018,.033),vec3(.043,.079,.102),max(D.y,0.));
  if(farT>0.&&disc>0.){
    vec3 n=normalize(offset-sqrt(disc)*D);
    vec2 uv=vec2(fract(atan(n.z,-n.x)/6.2831853),.5+asin(clamp(n.y,-1.,1.))/3.14159265);
    vec3 printInk=texture2D(reedPrint,uv).rgb;
    vec3 orb=printInk*(.48+1.35*max(0.,dot(n,sun)))+vec3(.058,.125,.11)*pow(1.-max(0.,dot(n,-D)),2.);
    sky=mix(sky,orb,smoothstep(0.,aa,disc));
  }
  vec3 col=mix(base,sky,fres);float shore=(1.-smoothstep(.008,.065,depth));
  float lap=pow(.5+.5*cos(depth*77.+.55*grain-clock*1.05),5.)*exp(-7.8*depth);
  float lace=sin(.70*a+.54*cos(.54*b))+.83*cos(.57*b+sin(.47*a));
  float caustic=(1.-smoothstep(.035,.17+fwidth(lace),abs(lace)))*exp(-3.9*depth)*(1.-fres);
  col+=vec3(.13,.21,.16)*shore+vec3(.060,.115,.085)*lap+vec3(.055,.12,.085)*caustic;
  col+=vec3(.31,.31,.20)*pow(max(0.,dot(N,normalize(sun+V))),95.);
  gl_FragColor=vec4(col,mix(.61,.96,max(fres,smoothstep(.01,.23,depth))));
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;
