import {useEffect,useMemo} from 'react';
import {useFrame} from '@react-three/fiber';
import {AdditiveBlending,BufferGeometry,DoubleSide,Float32BufferAttribute,Vector3} from 'three';
import {noPick} from '../../sceneryPaint';
import {skySpace} from './skySpace';
import {useSkyAttention} from './skyAttention';

// Two unequal lobes at a finite distance. A strip follows each bent spine
// in 3D and faces each eye independently. Only the emission knots advance.
function ejecta(){
  const position:number[]=[],tangent:number[]=[],uv:number[]=[],width:number[]=[],index:number[]=[];
  const origin=new Vector3(67,20,-246),axis=new Vector3(.51,.77,-.39).normalize(),across=new Vector3(-axis.y,axis.x,0).normalize();
  const other=new Vector3().crossVectors(axis,across);
  for(const side of [-1,1]){
    const first=position.length/3,len=side>0?24:16;
    for(let i=0;i<=48;i++){
      const t=i/48,d=t*len,w=.95+2.2*t+3.8*t*t;
      const center=origin.clone().addScaledVector(axis,side*d).addScaledVector(across,side*(1.6*t*t+.35*t*Math.sin(13*t)));
      const direction=axis.clone().multiplyScalar(side*len).addScaledVector(across,side*(3.2*t+.35*Math.sin(13*t)+4.55*t*Math.cos(13*t))).normalize();
      for(const k of [-1,1]){position.push(...center.toArray());tangent.push(...direction.toArray());uv.push(k,t);width.push(w);}
      if(i){const k=first+2*i;index.push(k-2,k,k-1,k-1,k,k+1);}
    }
  }
  // Discontinuous equatorial wisps, tilted around the outflow axis. The
  // bright inner arc crosses the jet; the broken outer bow fades at its tips.
  for(const [r,phase,sweep] of [[5.2,-.65,4.8],[8.3,2.05,3.5],[8.8,-.43,1.32]]){
    const first=position.length/3;
    for(let i=0;i<=48;i++){
      const t=i/48,a=phase+t*sweep,R=r*(1+.055*Math.sin(a*3+.2));
      const p=origin.clone().addScaledVector(across,R*Math.cos(a)).addScaledVector(other,R*Math.sin(a)).addScaledVector(axis,.5*Math.sin(a*2));
      const d=across.clone().multiplyScalar(-Math.sin(a)).addScaledVector(other,Math.cos(a)).normalize();
      for(const k of [-1,1]){position.push(...p.toArray());tangent.push(...d.toArray());uv.push(k,-2.-t);width.push(r*.13);}
      if(i){const k=first+2*i;index.push(k-2,k,k-1,k-1,k,k+1);}
    }
  }
  // Compact hot core plus a little diffraction light, in the same batch.
  const k=position.length/3;for(const [x,y] of [[-1,-1],[1,-1],[-1,1],[1,1]]){
    position.push(...origin.toArray());tangent.push(0,0,0);uv.push(x,y);width.push(-4.8);
  }index.push(k,k+1,k+2,k+2,k+1,k+3);
  const g=new BufferGeometry();g.setAttribute('position',new Float32BufferAttribute(position,3));g.setAttribute('spine',new Float32BufferAttribute(tangent,3));g.setAttribute('uv',new Float32BufferAttribute(uv,2));g.setAttribute('width',new Float32BufferAttribute(width,1));g.setIndex(index);return g;
}
export function Pulsar(){
  const attention=useSkyAttention(),geo=useMemo(ejecta,[]),u=useMemo(()=>({time:{value:0},attention}),[attention]);
  useEffect(()=>()=>geo.dispose(),[geo]);useFrame((_,dt)=>{u.time.value=(u.time.value+Math.min(.10,dt))%100;u.attention.value=attention.value;});
  return <mesh name="sky:pulsar" renderOrder={-980} frustumCulled={false} geometry={geo} raycast={noPick}>
    <shaderMaterial uniforms={u} depthWrite={false} depthTest={false} blending={AdditiveBlending} side={DoubleSide} toneMapped={false}
      vertexShader={`${skySpace}attribute vec3 spine;attribute float width;varying vec2 local;varying float core;
        void main(){vec3 ray=position-skyEye(cameraPosition);core=step(width,0.);local=uv;vec3 d=mat3(viewMatrix)*ray;
          if(width>0.)d+=mat3(viewMatrix)*normalize(cross(spine,ray))*width*uv.x;else d.xy+=-width*uv;
          vec4 p=projectionMatrix*vec4(d,1.);gl_Position=p.xyww;}`}
      fragmentShader={`uniform float time,attention;varying vec2 local;varying float core;
        void main(){vec3 light;float flux;
          if(core>.5){float r=length(local);flux=.30*exp(-5.*r)+.80*exp(-28.*r)+.18*exp(-abs(local.x*local.y)*225.-4.*r);
            light=mix(vec3(.20,.65,1.),vec3(.96,.99,1.),exp(-6.*r));}
          else if(local.y< -1.5){float t=-local.y-2.;float x=local.x;
            flux=(.48+.16*sin(14.*t-time*.2513274))*sin(3.14159*t)*exp(-x*x*4.);light=mix(vec3(.29,.31,.79),vec3(.21,.85,.98),t);}
          else{float x=abs(local.x),t=local.y;float knot=.72+.28*cos(39.*t-time*.56548668);
            float delta=(x-.63)/.15;float spine=exp(-x*x*11.),rim=exp(-delta*delta);
            float bow=(t-.80-.11*(1.-x*x))/.047;
            flux=((.85*spine*knot+.35*rim)*pow(max(0.,1.-t),.85)+.20*exp(-bow*bow))*(1.-smoothstep(.78,1.,x));
            light=mix(vec3(.59,.22,.84),vec3(.15,.76,1.),spine);}
          gl_FragColor=vec4(light,clamp(flux*mix(.35,1.,attention),0.,1.));
          #include <colorspace_fragment>
        }`}/></mesh>;
}
