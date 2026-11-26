import {RoomShader} from '../../daylightMaterials';
import {useFrame} from '@react-three/fiber';
import {useEffect,useLayoutEffect,useMemo} from 'react';
import {Color,CustomBlending,Float32BufferAttribute,InstancedBufferAttribute,InstancedBufferGeometry,OneMinusSrcAlphaFactor,RepeatWrapping,SrcAlphaFactor,Vector3} from 'three';
import {noPick} from '../../sceneryPaint';
import {useBakedSurface} from '../../useBakedSurface';
import {sunDirection} from '../windAtlas';
import {sampleLongitude,skySpace} from './skySpace';
import belts from './storm-belts.webp';

// Scaled astronomical distances, independent of the walkable moons. A ray
// hits a sphere and (optionally) its ring plane, not a UV patch in the sky.
const rocks=[
  {at:[116,44,-170],r:2.55,ink:'#af9fc4'},
  {at:[98,40,-171],r:10,ink:'#75beca'},
  {at:[151,-88,55],r:13.6,ink:'#cb705e'},
  {at:[-56,-145,115],r:11,ink:'#a98cb3'},
] as const;

const vertex=`${skySpace}
  #ifdef ROCK_BATCH
    attribute vec4 sphere;attribute vec3 paint;varying vec3 tint;
  #else
    uniform vec3 centre;uniform float radius;
  #endif
  uniform float extent;varying vec3 ray;varying vec3 origin;
  void main(){
    #ifdef ROCK_BATCH
      vec3 centre=sphere.xyz;float radius=sphere.w;tint=paint;
    #endif
    vec3 eye=skyEye(cameraPosition);vec3 middle=centre-eye;
    // Face the eye, not the image plane: off-axis ring limbs must stay round.
    vec3 n=normalize(middle),right=normalize(cross(n,vec3(0.,1.,0.))),up=cross(right,n);
    ray=middle+(right*position.x+up*position.y)*(2.*extent*radius);
    origin=-middle/radius;vec4 p=projectionMatrix*vec4(mat3(viewMatrix)*ray,1.);gl_Position=p.xyww;
  }`;

const fragment=`${sampleLongitude}
  uniform sampler2D belts;uniform float mapped,spin;uniform vec3 sun;varying vec3 ray,origin;
  #ifdef ROCK_BATCH
    varying vec3 tint;
  #endif
  const float TAU=6.2831853;
  const vec3 axis=vec3(-.2213,.9085,.3543);
  float band(float x,float low,float high,float aa){return smoothstep(low-aa,low+aa,x)*(1.-smoothstep(high-aa,high+aa,x));}
  float opacityAt(float r,float aa){
    float annulus=band(r,1.22,2.17,aa);float gaps=1.-.95*band(r,1.775,1.841,aa)-.74*band(r,2.041,2.057,aa);
    float teeth=.09*cos(119.*r)*exp(-38.*aa)+.055*sin(375.*r)*exp(-145.*aa);
    return annulus*gaps*clamp(.76+.15*sin(21.*r)+teeth-.36*band(r,1.22,1.43,aa),0.,.98);
  }
  void main(){vec3 d=normalize(ray),o=origin,L=sun;float b=dot(o,d);vec3 closest=o-b*d;
    float h=1.-dot(closest,closest),aa=max(fwidth(h),.00001);float disc=smoothstep(-aa*.55,aa*.55,h);
    vec3 n=normalize(closest-d*sqrt(max(0.,h)));float ts=-b-sqrt(max(0.,h));
    float day=max(0.,dot(n,L));vec3 albedo;
    #ifndef ROCK_BATCH
      float nd=dot(d,axis),tr=-dot(o,axis)/(abs(nd)>.00001?nd:(nd<0.?-.00001:.00001));vec3 ringPoint=o+tr*d;
      float r=length(ringPoint),rw=clamp(fwidth(r)*.65,.0005,.075);float ra=step(.0,tr)*opacityAt(r,rw);
      vec3 east=normalize(cross(axis,vec3(0.,0.,1.))),front=cross(east,axis);
      vec2 uv=vec2(atan(dot(n,east),dot(n,front))/TAU+.5+spin,asin(clamp(dot(n,axis),-1.,1.))/3.14159265+.5);
      albedo=mix(vec3(.62,.33,.19),sampleLongitude(belts,uv).rgb,mapped);
      if(disc+ra<.002)discard;
      float t=-dot(n,axis)/dot(L,axis);float shadowR=length(n+L*t);
      day*=1.-.88*step(.0,t)*opacityAt(shadowR,.009);
    #else
      if(disc<.002)discard;
      float f=sin(9.*n.x+3.*sin(n.z*7.))+cos(n.y*13.+2.*sin(n.x*15.));
      albedo=tint*(.74+.17*f+.062*cos(n.z*37.+4.*f));
    #endif
    float limb=pow(1.-max(0.,dot(n,-d)),4.5)*smoothstep(-.15,.48,dot(n,L));
    vec3 globe=albedo*(.042+.98*sqrt(day))+limb*vec3(.14,.18,.22);
    #ifdef ROCK_BATCH
    gl_FragColor=vec4(globe,disc);
    #else
    float s=-dot(ringPoint,L),penumbra=length(ringPoint+L*s);float night=step(.0,s)*(1.-smoothstep(.96,1.04,penumbra));
    vec3 ring=mix(vec3(.39,.29,.23),vec3(.77,.66,.50),.5+.38*sin(25.*r)+.1*cos(93.*r)*exp(-30.*rw))*(1.-night*.92);
    float a=disc+ra*(1.-disc);vec3 rgb=tr<ts?mix(globe*disc,ring,ra):mix(ring*ra,globe,disc);
    gl_FragColor=vec4(rgb/max(a,.002),a);
    #endif
    #include <colorspace_fragment>
  }`;

function rockBatch(){
  const g=new InstancedBufferGeometry(),c=new Color();
  g.setIndex([0,1,2,2,1,3]);g.setAttribute('position',new Float32BufferAttribute([-.5,-.5,0,.5,-.5,0,-.5,.5,0,.5,.5,0],3));
  g.setAttribute('sphere',new InstancedBufferAttribute(Float32Array.from(rocks.flatMap(b=>[...b.at,b.r])),4));
  g.setAttribute('paint',new InstancedBufferAttribute(Float32Array.from(rocks.flatMap(b=>c.set(b.ink).toArray())),3));g.instanceCount=rocks.length;return g;
}
// Opaque queue + explicit blending: a normal transparent pass would draw
// after the actors, letting the distant ring cover the real horizon.
const material={vertexShader:vertex,fragmentShader:fragment,blending:CustomBlending,blendSrc:SrcAlphaFactor,blendDst:OneMinusSrcAlphaFactor,depthTest:false,depthWrite:false,toneMapped:false} as const;
const rockDefines={ROCK_BATCH:1};
export function DistantSystem(){
  const map=useBakedSurface(belts);useLayoutEffect(()=>{if(map){map.wrapS=RepeatWrapping;map.needsUpdate=true;}},[map]);
  const batch=useMemo(rockBatch,[]),rockUniforms=useMemo(()=>({sun:{value:sunDirection},extent:{value:1.08}}),[]);
  useEffect(()=>()=>batch.dispose(),[batch]);
  const u=useMemo(()=>({centre:{value:new Vector3(-29,19,-146)},radius:{value:18},extent:{value:2.34},sun:{value:sunDirection},belts:{value:map},mapped:{value:map?1:0},spin:{value:0}}),[map]);
  useFrame((_,dt)=>{u.spin.value=(u.spin.value+Math.min(.1,dt)*.0011)%1;});
  return <><mesh name="sky:rock-moons" frustumCulled={false} geometry={batch} renderOrder={-970} raycast={noPick}>
    <RoomShader effect="rocks" {...material} defines={rockDefines} uniforms={rockUniforms}/></mesh>
    <mesh name="sky:body-amber" frustumCulled={false} renderOrder={-960} raycast={noPick}><planeGeometry args={[1,1]}/><RoomShader effect="amber" {...material} uniforms={u}/></mesh></>;
}
