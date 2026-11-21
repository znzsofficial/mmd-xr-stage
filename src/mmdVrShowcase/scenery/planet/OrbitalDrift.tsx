import {useEffect,useMemo,useRef} from 'react';
import {useFrame} from '@react-three/fiber';
import {AdditiveBlending,type ShaderMaterial} from 'three';
import {noPick} from '../sceneryPaint';
import {dustSpines,makeDriftField} from './orbitalDriftField';
import {useSkyAttention} from './sky/skyAttention';

const tau='const float TAU=6.28318530718;';
const rocksVertex=`${tau}
  uniform float cycle;
  attribute vec3 colour; attribute vec4 body; attribute float grain;
  varying vec3 tint,stone; varying float keyLight,glint,clearance,seed;
  vec3 tumble(vec3 p,vec2 a,vec2 b){
    p.yz=mat2(a.x,a.y,-a.y,a.x)*p.yz;
    p.xz=mat2(b.x,b.y,-b.y,b.x)*p.xz; return p;
  }
  void main(){
    float a=TAU*(grain*3.3+cycle*(1.+floor(2.*grain)));
    float b=TAU*(grain*7.1-cycle*(1.+floor(3.*grain)));
    vec2 tilt=vec2(cos(a),sin(a)), yaw=vec2(cos(b),sin(b));
    vec3 centre=body.xyz+.19*vec3(tilt.x,yaw.y*.72,tilt.y);
    vec3 N=normalize(mat3(modelMatrix)*tumble(normal,tilt,yaw));
    vec4 world=modelMatrix*vec4(centre+tumble(position,tilt,yaw),1.);
    vec3 eye=normalize(cameraPosition-world.xyz), sun=normalize(vec3(-5.,3.2,3.8));
    keyLight=dot(N,sun); glint=pow(max(0.,dot(N,normalize(sun+eye))),18.);
    clearance=length((modelViewMatrix*vec4(centre,1.)).xyz)-1.65*body.w;
    stone=position/body.w; tint=colour; seed=grain;
    gl_Position=projectionMatrix*viewMatrix*world;
  }`;
const rocksFragment=`
  varying vec3 tint,stone; varying float keyLight,glint,clearance,seed;
  void main(){
    // Keep the entire boulder outside the near-eye comfort sphere. Fade
    // continuously in free flight, without a noisy stereo dither mask.
    float cover=smoothstep(.85,2.6,clearance); if(cover<.005)discard;
    float cut=stone.y+.27*stone.x+.12*sin(4.*stone.z+1.8*stone.x+seed*12.);
    float aa=clamp(fwidth(cut)*.65,.004,.20);
    float vein=1.-smoothstep(.037-aa,.051+aa,abs(cut+.16));
    float lamina=sin(24.*cut+2.3*sin(6.*cut+seed*7.));
    float grain=sin(11.*stone.z+14.*stone.x)*cos(13.*stone.y-9.*stone.z);
    float layer=.88+(.19*lamina+.12*grain)*exp(-7.*aa);
    vec3 mica=mix(vec3(.31,.66,.69),vec3(.82,.54,.29),smoothstep(.34,.67,seed));
    vec3 albedo=mix(tint*layer,mica,vein*.82);
    vec3 fill=vec3(.095,.131,.19)+max(keyLight,0.)*vec3(1.13,1.01,.83);
    vec3 lit=albedo*fill+vec3(.26,.30,.31)*glint+.048*vein*mica;
    gl_FragColor=vec4(lit,cover);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }`;

const ionVertex=`${tau}
  uniform float cycle; attribute vec4 track,mote; attribute vec2 span;
  varying vec2 ink; varying vec3 tint; varying float flux,kind;
  ${dustSpines}
  void main(){
    float lane=track.x, strand=track.z, salt=track.w;
    kind=mote.z; bool gas=kind>2.5;
    float progress=gas ? track.y+(.5+.5*position.x)*mote.x : fract(track.y+cycle*(2.+strand+floor(mote.x*2.)));
    float t=mix(span.x,span.y,progress);
    vec3 p,d; spine(lane,t,p,d);
    vec3 across=normalize(cross(d,vec3(0.,1.,0.))), up=cross(across,d);
    float scale=lane<.5?1.48:.85;
    float twist=TAU*(1.36*t+.5*strand+salt*.12+.045*sin(TAU*(cycle*4.-t)));
    float r=scale*(.45+.39*sin(t*3.14159)+mote.y*.91);
    p+=up*(r*cos(twist)+scale*mote.y)+across*(1.5*r*sin(twist)+scale*(salt-.5));
    d=normalize(d+scale*.31*(across*cos(twist)-up*sin(twist)));
    vec4 view=modelViewMatrix*vec4(p,1.);
    float eyeRange=length(view.xyz);
    vec3 tangent=mat3(modelViewMatrix)*d;
    // Project the 3D velocity, including perspective foreshortening. Do not
    // use a central camera-facing quad for both eye views.
    vec2 dir=tangent.xy+tangent.z*view.xy/max(.20,-view.z);
    float projected=length(dir); dir=projected>.0001?dir/projected:vec2(1.,0.);
    float f=scale*(.65+.70*mote.w);
    vec2 size=(kind<.5?vec2(.13,.076):kind<1.5?vec2(.45,.049):vec2(1.76,.62))*f;
    size.x=mix(size.y,size.x,min(1.,projected));
    if(gas)size=vec2(0.,scale*(.25+.16*sin(19.*t+strand)*sin(13.*t)));
    view.xy+=dir*(size.x*position.x)+vec2(-dir.y,dir.x)*(size.y*position.y);
    gl_Position=projectionMatrix*view;
    float ripple=.5+.5*sin(TAU*(2.*t-cycle*3.+salt*.22));
    vec3 cool=mix(vec3(.016,.94,.63),vec3(.24,.10,1.),ripple);
    vec3 warm=mix(vec3(1.,.051,.44),vec3(1.,.51,.06),ripple);
    tint=mix(cool,warm,strand);
    flux=smoothstep(.0,.08,progress)*smoothstep(.0,.09,1.-progress)*smoothstep(1.4,4.2,eyeRange);
    flux*=(.58+.42*mote.w)*(.77+.23*cos(TAU*(t*4.-cycle*5.+salt)));
    ink=vec2(gas?t:position.x,position.y);
    if(gas)flux*=.32+.68*smoothstep(-.60,.65,sin(TAU*(1.7*t-cycle*2.+.34*strand)));
  }`;

const ionFragment=`
  uniform float cycle,attention; varying vec2 ink; varying vec3 tint; varying float flux,kind;
  void main(){
    float r2=dot(ink,ink), edge=max(0.,1.-r2);
    // A white mineral spark at the head of a coloured wake, interleaved
    // with narrow needles and much softer, wider pools of illuminated dust.
    float head=exp(-19.*dot(ink-vec2(.29,0.),ink-vec2(.29,0.)));
    float glow=kind<.5?.82*edge*edge+.34*head:
      kind<1.5?.69*edge*exp(-9.*ink.y*ink.y)*(.65+.35*ink.x):.12*edge*edge*edge;
    if(kind>2.5){
      // A narrow shifting caustic inside the softer gas, broken into wisps
      // along the curve. This remains legible against the dense star field.
      float x=ink.y, wave=.24*sin(41.*ink.x+6.2831853*cycle*3.);
      float core=(x-wave)*5.7;
      glow=(.18*exp(-3.6*x*x)+.45*exp(-core*core))*(1.-smoothstep(.58,1.,abs(x)));
    }
    vec3 emission=mix(tint,vec3(.93,.95,1.),(kind<.5?.53:.05)*head);
    gl_FragColor=vec4(emission,clamp(glow*flux*mix(.15,1.,attention),0.,1.));
    #include <colorspace_fragment>
  }`;

const visualOnly={playerCollision:false};

export function OrbitalDrift(){
  const {rocks,ions}=useMemo(makeDriftField,[]);
  const stone=useRef<ShaderMaterial>(null), dust=useRef<ShaderMaterial>(null);
  const attention=useSkyAttention(),clock=useRef(0),uniforms=useMemo(()=>({cycle:{value:0},attention}),[attention]);
  useEffect(()=>()=>{rocks.dispose();ions.dispose();},[rocks,ions]);
  useFrame((_,dt)=>{
    // All phases use integer multiples of this period, including particle
    // birth/death. Long-running sessions wrap without a visible jump.
    clock.current=(clock.current+Math.min(.1,dt)/240)%1;
    if(stone.current)stone.current.uniforms.cycle.value=clock.current;
    if(dust.current)dust.current.uniforms.cycle.value=clock.current;
    if(dust.current)dust.current.uniforms.attention.value=attention.value;
  });
  return <group name="planet:orbital-drift" pointerEvents="none">
    <mesh name="drift:fracture-families" geometry={rocks} raycast={noPick} userData={visualOnly} renderOrder={-1}>
      <shaderMaterial ref={stone} uniforms={uniforms} vertexShader={rocksVertex} fragmentShader={rocksFragment} transparent depthWrite/>
    </mesh>
    <mesh name="drift:ion-wakes" geometry={ions} raycast={noPick} userData={visualOnly}>
      <shaderMaterial ref={dust} uniforms={uniforms} vertexShader={ionVertex} fragmentShader={ionFragment}
        transparent blending={AdditiveBlending} depthWrite={false} toneMapped={false}/>
    </mesh>
  </group>;
}
