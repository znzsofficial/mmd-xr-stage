import {harbourSkySampling} from './harbourAtmosphere';
import {beaconPaint,fishingBoat} from './harbourFixtures';
import {landing,lantern,quay,stairs,type Slab} from './shoreLayout';

const num=(v:number)=>v.toFixed(5);
const xy=(x:number,y:number)=>`vec2(${num(x)},${num(y)})`;
const xyz=(x:number,y:number,z:number)=>`vec3(${num(x)},${num(y)},${num(z)})`;
const centre=(s:Slab)=>xy(s.x,s.z);
const halfSize=(s:Slab)=>xy(s.w/2,s.d/2);

export const harbourVertex=`
varying vec3 harbourP;
void main(){
  vec4 w=modelMatrix*vec4(position,1.);
  harbourP=w.xyz;
  gl_Position=projectionMatrix*viewMatrix*w;
}`;

// The fill beyond the far clip plane and the last metres of real water use
// the same sea/air boundary. Its angular width is independent of either eye.
const horizon=`
vec3 distantSea(vec3 direction,vec3 air){
  float haze=1.-smoothstep(0.,.049,max(0.,-direction.y));
  vec3 offing=mix(vec3(.058,.196,.252),harbourHorizonColor,.37);
  return mix(offing,air,haze);
}`;

export const harbourHorizon=`
varying vec3 skyDir;
${harbourSkySampling}
${horizon}
void main(){
  vec3 d=normalize(skyDir);
  if(d.y>=0.)discard;
  vec3 air=harbourHorizonColor;
  if(d.y>-.05)air=sampleHarbourSky(vec3(d.x,0.,d.z));
  gl_FragColor=vec4(distantSea(d,air),1.);
  #include <colorspace_fragment>
}`;

const brineStone=`
vec3 brineStone(vec2 p,float wet){
  vec2 blocks=vec2(p.x*.95+floor(p.y*1.69)*.47,p.y*1.69);
  vec2 edges=abs(fract(blocks)-.5);
  float joint=smoothstep(.475,.496,max(edges.x,edges.y));
  float piece=fract(sin(dot(floor(blocks),vec2(13.1,74.9)))*715.133);
  float salt=.5+.5*sin(p.x*12.8+2.4*sin(p.y*14.3))*sin(p.y*18.+1.7*sin(p.x*8.3));
  vec3 rock=mix(vec3(.350,.356,.301),vec3(.105,.137,.117),wet);
  return rock*(.88+.18*piece+.075*salt)*(1.-joint*.34);
}`;

// Upper faces of the exposed tidal landing and steps. The identical flagstone
// joints are seen through the water after the tide crosses each tread.
export const tidalStoneFragment=`
varying vec3 harbourP;
uniform float waterline;
${harbourSkySampling}
${brineStone}
void main(){
  vec2 p=harbourP.xz;
  vec3 eye=normalize(cameraPosition-harbourP);
  float pools=sin(p.x*2.15+.62*sin(p.y*3.4))*sin(p.y*1.91+p.x*.4);
  float height=max(0.,harbourP.y-waterline);
  float wet=1.-smoothstep(.02,.41,height+.13*pools*smoothstep(.01,.15,height));
  float sheen=wet*wet*(.10+.42*pow(1.-clamp(eye.y,0.,1.),3.));
  vec3 sky=sampleHarbourSky(vec3(-eye.x,max(.015,eye.y),-eye.z));
  vec3 c=mix(brineStone(p,wet),sky,sheen);
  gl_FragColor=vec4(c,1.);
  #include <colorspace_fragment>
}`;

const {cabin,roof}=fishingBoat;
const boatFrame=xy(Math.cos(fishingBoat.yaw),Math.sin(fishingBoat.yaw));

export const harbourWaterFragment=`
varying vec3 harbourP;
uniform float phase,waterline,boatY,localReflections,slopesReady;
uniform sampler2D harbourSlopes;
${harbourSkySampling}
${horizon}
${brineStone}

float boxDistance(vec2 p,vec2 halfExtent){
  vec2 q=abs(p)-halfExtent;
  return length(max(q,vec2(0.)))+min(max(q.x,q.y),0.);
}

float submergedDepth(vec2 p,vec2 stride,vec2 mid,vec2 ext,float top){
  float depth=waterline-top;
  vec2 bed=abs(p+stride*depth-mid)-ext;
  return depth>0. && max(bed.x,bed.y)<0.?depth:99.;
}

// Slab intersection, bounded to this harbour. The cap and the landing also
// occlude the lower part of the beacon from the opposite side of the quay.
vec2 boxInterval(vec3 offset,vec3 ray,vec3 halfExtent){
  vec3 inverse=(2.*step(vec3(0.),ray)-1.)/max(abs(ray),vec3(.0001));
  vec3 a=(-halfExtent-offset)*inverse,b=(halfExtent-offset)*inverse;
  vec3 lo=min(a,b),hi=max(a,b);
  float first=max(max(lo.x,lo.y),max(lo.z,0.));
  float travel=min(min(hi.x,hi.y),hi.z)-first;
  return vec2(travel>=0.?first:100.,max(0.,travel));
}

float slabReflection(vec3 p,vec3 ray,vec2 mid,vec2 ext,float top){
  return boxInterval(vec3(p.x-mid.x,p.y-top+.83,p.z-mid.y),ray,vec3(ext.x,.83,ext.y)).x;
}

vec3 boatLocal(vec3 v){
  vec2 axes=${boatFrame};
  return vec3(dot(v.xz,vec2(axes.x,-axes.y)),v.y,dot(v.xz,axes.yx));
}

// Hull/deck ellipse, cabin and roof only. The mast is thinner than a
// reflected pixel in normal views. No reflected draw, cube or depth read.
vec4 boatReflection(vec3 p,vec3 ray,vec3 sky){
  vec3 q=boatLocal(p-vec3(${num(fishingBoat.x)},boatY,${num(fishingBoat.z)}));
  vec3 d=boatLocal(ray);
  float limit=boxInterval(q,d,vec3(.78,.76,2.)).x;
  vec4 result=vec4(0.,0.,0.,100.);
  if(limit<55.){
    vec3 invHull=vec3(1.42,3.64,.58);
    vec3 origin=(q+vec3(0.,.11,.17))*invHull,dir=d*invHull;
    float aa=dot(dir,dir),bb=dot(origin,dir),cc=dot(origin,origin)-1.;
    float disc=bb*bb-aa*cc;
    if(disc>0.){
      float hull=(-bb-sqrt(disc))/aa;
      if(hull>0.){
        float deck=smoothstep(.07,.13,q.y+hull*d.y);
        vec3 paint=mix(vec3(.034,.092,.078),vec3(.47,.36,.20),deck);
        result=vec4(mix(sky,paint,smoothstep(0.,.17,disc/aa)),hull);
      }
    }
    vec2 house=boxInterval(q-${xyz(0,cabin.y,cabin.z)},d,${xyz(cabin.w/2,cabin.h/2,cabin.d/2)});
    if(house.x<result.a){
      float height=q.y+house.x*d.y;
      float pane=smoothstep(.393,.422,height)*(1.-smoothstep(.559,.587,height));
      vec3 paint=mix(vec3(.64,.63,.51),vec3(.085,.145,.14),pane);
      result=vec4(mix(sky,paint,smoothstep(0.,.16,house.y)),house.x);
    }
    vec2 cap=boxInterval(q-${xyz(0,roof.y,roof.z)},d,${xyz(roof.w/2,roof.h/2,roof.d/2)});
    if(cap.x<result.a)result=vec4(mix(sky,vec3(.36,.14,.077),smoothstep(0.,.10,cap.y)),cap.x);
  }
  return result;
}

vec4 beaconReflection(vec3 p,vec3 ray,vec3 sky){
  vec2 delta=${xy(lantern.x,lantern.z)}-p.xz;
  float t=dot(delta,ray.xz)/max(.0001,dot(ray.xz,ray.xz));
  vec4 result=vec4(0.,0.,0.,100.);
  if(t>0. && t<55.){
    float h=p.y+t*ray.y;
    float radius=${num(beaconPaint.shaftWidth/2)};
    vec3 paint=vec3(.75,.64,.43);
    float stripe=${beaconPaint.stripeStarts.map(y=>`smoothstep(${num(y-.033)},${num(y+.033)},h)*(1.-smoothstep(${num(y+beaconPaint.stripeHeight-.033)},${num(y+beaconPaint.stripeHeight+.033)},h))`).join('+')};
    paint=mix(paint,vec3(.38,.105,.045),stripe);
    if(h>${num(beaconPaint.shaftTop)}){radius=.39;paint=vec3(.073,.12,.102);}
    if(h>${num(beaconPaint.glassBottom)} && h<${num(beaconPaint.glassTop)}){radius=${num(beaconPaint.glassWidth/2)};paint=vec3(.98,.77,.37);}
    float lateral=length(delta-ray.xz*t);
    float soft=.028+.003*t;
    float cover=(1.-smoothstep(radius-soft,radius+soft,lateral))*smoothstep(.26,.35,h)*(1.-smoothstep(4.20,4.27,h));
    if(cover>.001)result=vec4(mix(sky,paint*(1.-.21*clamp(lateral/radius,0.,1.)),cover),t);
  }
  return result;
}

void main(){
  vec2 p=harbourP.xz;
  vec3 toEye=cameraPosition-harbourP;
  float dist=length(toEye);
  vec3 eye=toEye/max(.001,dist);
  float pixel=length(fwidth(p));
  float ripple=1.-smoothstep(.041,.18,pixel);
  float chop=1.-smoothstep(.19,.72,pixel);
  vec2 longU=vec2(.954,.300),longV=vec2(-.300,.954);
  vec2 shortU=vec2(.917,-.399),shortV=vec2(.399,.917);
  vec2 uv1=vec2(dot(p,longU),dot(p,longV))*.155+vec2(.005,.036)*phase;
  vec2 uv2=vec2(dot(p,shortU),dot(p,shortV))*.51+vec2(.011,-.054)*phase+vec2(.33,.75);
  vec3 train=(texture2D(harbourSlopes,uv1).rgb*2.-1.)*slopesReady;
  vec3 grain=(texture2D(harbourSlopes,uv2).rgb*2.-1.)*slopesReady;
  vec2 longSlope=(longU*train.r*.115+longV*train.g*.234)*chop;
  vec2 shortSlope=(shortU*grain.r*.089+shortV*grain.g*.164)*ripple;
  vec2 surfaceSlope=longSlope+shortSlope*.57;
  vec3 n=normalize(vec3(surfaceSlope.x,1.,surfaceSlope.y));
  vec3 skyRay=reflect(-eye,n);

  float landingEdge=boxDistance(p-${centre(landing)},${halfSize(landing)});
  float wallEdge=boxDistance(p-${centre(quay)},${halfSize(quay)});
  float edge=min(landingEdge,wallEdge);
  float shelf=1.-smoothstep(.2,7.4,max(edge,0.));
  vec3 body=mix(vec3(.022,.130,.155),vec3(.057,.218,.183),shelf)*(.99+.15*train.b+.042*grain.b*ripple);
  float film=1.;
  vec3 stone=body;
  if(landingEdge<3.7 && waterline>${num(landing.y)}){
    vec3 down=refract(-eye,n,.751);
    vec2 stride=down.xz/max(.05,-down.y);
    float depth=99.;
    ${[landing,...stairs].map(s=>`depth=min(depth,submergedDepth(p,stride,${centre(s)},${halfSize(s)},${num(s.y)}));`).join('\n    ')}
    if(depth<1.){
      vec2 bedPoint=p+stride*depth;
      float lace=sin(bedPoint.x*7.1+phase+1.9*sin(bedPoint.y*4.7))+.82*sin(bedPoint.y*6.4-phase*.81+sin(bedPoint.x*4.));
      stone=brineStone(bedPoint,1.);
      film=smoothstep(.002,.09,depth);
      vec3 floorColor=stone+vec3(.20,.22,.14)*(1.-smoothstep(.025,.18,abs(lace)));
      body=mix(floorColor,body,.18+depth*.72);
    }
  }

  // At grazing angles a downward-facing facet sees other lit waves and
  // sea air, not a black lower hemisphere outlined against white clouds.
  float seaFog=smoothstep(24.,50.,dist);
  vec3 lookup=mix(vec3(-eye.x,max(.015,eye.y),-eye.z),skyRay,film);
  vec3 sky=sampleHarbourSky(mix(lookup,vec3(-eye.x,.0001,-eye.z),seaFog));
  vec3 reflection=mix(sky,mix(harbourHorizonColor,body,.38),.38*(1.-smoothstep(-.14,.06,skyRay.y))*harbourSkyEnabled);
  float openSky=1.;
  float fixture=0.;
  if(localReflections>.5 && dist<58.){
    // In the lee of the quay, the mirror image still breaks into small
    // horizontal strokes but adjacent bands of the lamp remain legible.
    float sheltered=1.-smoothstep(.5,6.,max(edge,0.));
    vec2 localSlope=(longSlope*.40+shortSlope*.16)*(1.-.54*sheltered);
    vec3 localRay=reflect(-eye,normalize(vec3(localSlope.x,1.,localSlope.y)));
    vec4 boat=boatReflection(harbourP,localRay,sky),beacon=beaconReflection(harbourP,localRay,sky);
    vec4 item=boat.a<beacon.a?boat:beacon;
    float quayHit=slabReflection(harbourP,localRay,${centre(quay)},${halfSize(quay)},${num(quay.y)});
    float landingHit=slabReflection(harbourP,localRay,${centre(landing)},${halfSize(landing)},${num(landing.y)});
    float wall=min(quayHit,landingHit);
    if(wall<item.a){
      vec3 hit=harbourP+localRay*wall;
      float wet=1.-smoothstep(waterline+.02,waterline+.23,hit.y);
      vec3 masonry=brineStone(vec2(hit.x+.42*hit.z,hit.y*2.8),wet);
      item=vec4(mix(masonry,vec3(.46,.43,.33),smoothstep(-.15,-.11,hit.y)),wall);
    }
    if(item.a<55.){
      float coverage=(1.-smoothstep(24.,55.,item.a))*(1.-smoothstep(46.,58.,dist));
      reflection=mix(reflection,item.rgb,.86*coverage);
      if(item.a<wall)fixture=coverage;
      openSky=1.-coverage;
    }
  }

  float grazing=clamp(.72*eye.y+.28*dot(n,eye),0.,1.);
  float fres=.072+.74*pow(1.-grazing,3.3);
  fres=mix(fres,.20+.66*pow(1.-grazing,1.75),fixture);
  vec3 c=mix(body,reflection,fres);
  // Resolve individual sun facets up close. Once they shrink below a pixel,
  // broaden the lobe and conserve its integrated energy instead of flashing.
  vec3 bisector=normalize(eye+harbourSunDirection());
  vec2 missed=longSlope+shortSlope-bisector.xz/max(.12,bisector.y);
  float width=.011+.050*smoothstep(.002,.15,pixel);
  float sunPath=exp(-.5*dot(missed,missed)/(width*width))*(.00030/(width*width));
  c+=harbourSunColor*(harbourSunIntensity*harbourSkyEnabled)*sunPath*openSky;

  float foamEdge=min(wallEdge,mix(landingEdge,99.,smoothstep(-.025,.065,waterline-(${num(landing.y)}))));
  float wash=(1.-smoothstep(.025,.32,abs(foamEdge)-.10*train.b))*smoothstep(.05,.57,train.g+.48*grain.b);
  c=mix(c,vec3(.55,.68,.60),.42*wash*ripple);
  if(film<1.){
    float sheen=.10+.42*pow(1.-clamp(eye.y,0.,1.),3.);
    c=mix(mix(stone,sky,sheen),c,film);
  }
  c=mix(c,distantSea(-eye,sky),seaFog);
  gl_FragColor=vec4(c,1.);
  #include <colorspace_fragment>
}`;
