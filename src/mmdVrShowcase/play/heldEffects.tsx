import { useImperativeHandle, useMemo, useRef } from 'react';
import { DynamicDrawUsage, InstancedMesh, Mesh, Object3D, Vector3 } from 'three';
import { markAt, POST_MARKS, POST_Z, stamp, useLunarCard } from './lunarCard';
import type { FrameEffectProps, GripFrame } from './propView';

export function StampAim({ref}:FrameEffectProps) {
  const mesh=useRef<Mesh>(null);
  useImperativeHandle(ref,()=>({at,dir,usable,action}:GripFrame)=>{
    const aim=mesh.current!;
    aim.visible=false;
    if(!usable||useLunarCard.getState().stamps.length===POST_MARKS.length)return;
    const distance=Math.abs(dir.z)>.0001?(POST_Z-at.z)/dir.z:-1;
    if(distance<=0||distance>=18)return;
    const x=at.x+distance*dir.x,y=at.y+distance*dir.y,hit=markAt(x,y);
    if(hit===-1)return;
    aim.visible=true;aim.position.set(x,y,POST_Z+.012);
    if(action==='start')stamp(hit);
  },[]);
  return <mesh name="post:aim" ref={mesh} visible={false}><ringGeometry args={[.065,.085,28]}/><meshBasicMaterial color="#fffce1" toneMapped={false}/></mesh>;
}

const CAP=24;
/** A metered pump: one short pulse per squeeze, in world space. Positions,
 * velocity and scratch are reused. Drops in flight never follow the hand. */
export function LiquidSpray({ref}:FrameEffectProps){
  const mesh=useRef<InstancedMesh>(null);
  const s=useMemo(()=>({age:new Float32Array(CAP).fill(-1),path:new Float32Array(CAP*6),next:0,left:0,until:0,
    dot:new Object3D(),v:new Vector3(),up:new Vector3(0,1,0)}),[]);
  useImperativeHandle(ref,()=>({at,dir,usable,action,dt}:GripFrame)=>{
    const batch=mesh.current!;if(action==='start'){s.left=10;s.until=0;}if(!usable)s.left=0;
    s.until-=dt;
    while(s.left>0&&s.until<=0){
      const i=s.next++%CAP,k=i*6,phase=10-s.left;const speed=1.5+.65*Math.sin(Math.PI*(phase+.5)/10);
      s.age[i]=0;s.path[k]=at.x;s.path[k+1]=at.y;s.path[k+2]=at.z;
      s.path[k+3]=dir.x*speed+.024*Math.sin(i*4);s.path[k+4]=dir.y*speed;s.path[k+5]=dir.z*speed+.019*Math.cos(i*3);
      s.left--;s.until+=.024;
    }
    let count=0;for(let i=0;i<CAP;i++){if(s.age[i]<0)continue;
      const k=6*i,t=s.age[i],vy=s.path[k+4],y=s.path[k+1]+vy*t-3.5*t*t;
      if(t>.76||y<.01){s.age[i]=-1;continue;}
      s.dot.position.set(s.path[k]+s.path[k+3]*t,y,s.path[k+2]+s.path[k+5]*t);
      s.dot.quaternion.setFromUnitVectors(s.up,s.v.set(s.path[k+3],vy-7*t,s.path[k+5]).normalize());
      const radius=.0031*(1-.35*t);s.dot.scale.set(radius,.017*(1-.85*t),radius);s.dot.updateMatrix();batch.setMatrixAt(count++,s.dot.matrix);s.age[i]+=dt;
    }
    if(count||batch.count){batch.count=count;batch.instanceMatrix.needsUpdate=true;}
  },[s]);
  return <instancedMesh name="play:liquid-spray" ref={mesh} args={[undefined,undefined,CAP]} count={0} frustumCulled={false} onUpdate={m=>m.instanceMatrix.setUsage(DynamicDrawUsage)}>
    <sphereGeometry args={[1,8,6]}/><meshStandardMaterial color="#e3f3fa" roughness={.21} transparent opacity={.83} depthWrite={false}/>
  </instancedMesh>;
}
export function BubbleStream({ref}:FrameEffectProps) {
  const mesh=useRef<InstancedMesh>(null);
  const s=useMemo(()=>({dot:new Object3D(), age:new Float32Array(CAP).fill(-1),paths:new Float32Array(CAP*6),next:0,cooldown:0}),[]);
  useImperativeHandle(ref,()=>({at,dir,action,dt}:GripFrame)=>{
    const batch=mesh.current!;
    s.cooldown=Math.max(0,s.cooldown-dt);
    if(action!=='off'&&(action==='start'||s.cooldown<=0)){
      const i=s.next++%CAP,k=i*6;s.age[i]=0;s.cooldown=.13;
      s.paths[k]=at.x;s.paths[k+1]=at.y;s.paths[k+2]=at.z;
      s.paths[k+3]=dir.x*1.3;s.paths[k+4]=dir.y*1.3;s.paths[k+5]=dir.z*1.3;
    }
    let count=0;
    for(let i=0;i<CAP;i++){
      if(s.age[i]<0)continue;const t=s.age[i]+=dt;
      if(t>2.9){s.age[i]=-1;continue;}
      const k=i*6,travel=t/(1+.24*t);
      s.dot.position.set(s.paths[k]+s.paths[k+3]*travel+.063*t*Math.sin(i*2.1+t*2.2),s.paths[k+1]+s.paths[k+4]*travel+.15*t*t,s.paths[k+2]+s.paths[k+5]*travel+.047*t*Math.cos(i+t));
      const radius=(.042+.009*(i%4))*(.6+Math.min(1,t*5)) * Math.min(1,(2.9-t)*6);
      s.dot.scale.setScalar(radius);s.dot.updateMatrix();batch.setMatrixAt(count++,s.dot.matrix);
    }
    if(count||batch.count){batch.count=count;batch.instanceMatrix.needsUpdate=true;}
  },[s]);
  return <instancedMesh name="play:bubbles" ref={mesh} args={[undefined,undefined,CAP]} count={0} frustumCulled={false} onUpdate={m=>m.instanceMatrix.setUsage(DynamicDrawUsage)}>
    <sphereGeometry args={[1,14,10]}/><shaderMaterial transparent depthWrite={false}
      vertexShader={`varying vec3 vN,vEye;void main(){vec4 p=modelViewMatrix*instanceMatrix*vec4(position,1.);vN=normalMatrix*mat3(instanceMatrix)*normal;vEye=-p.xyz;gl_Position=projectionMatrix*p;}`}
      fragmentShader={`varying vec3 vN,vEye;void main(){vec3 n=normalize(vN);float rim=pow(1.-abs(dot(normalize(vEye),n)),1.2);float glint=smoothstep(.86,.98,dot(n,normalize(vec3(-.46,.57,.68))));vec3 hue=mix(vec3(.4,.96,.88),vec3(.99,.54,.83),.5+.5*sin(n.y*7.+n.x*3.));gl_FragColor=vec4(mix(hue,vec3(1.),glint),.11+.72*rim+.17*glint);
      #include <colorspace_fragment>
      }`}/></instancedMesh>;
}
