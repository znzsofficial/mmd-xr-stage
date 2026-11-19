import { useFrame } from '@react-three/fiber';
import { useMemo, useRef } from 'react';
import { DynamicDrawUsage, Group, InstancedMesh, Matrix4, Mesh, Object3D, Vector2, Vector3 } from 'three';
import { useBackpack } from '../backpack';
import { useHudWorldInput } from '../components/hudWorldInput';
import { useMmdVrStore } from '../mmdVrStore';
import { gripLatch, markAt, POST_Z, toyWorksHere, useStagePlay, type Toy, type Hand } from './stagePlay';
import { MoonPost } from './MoonPost';
import { AstralSaber } from './AstralSaber';
import { KiteReel } from './kite/KiteStation';
import { EncoreMic } from './encore/EncoreStation';
import { squeezeStory } from './storyActions';
import { StoryStations } from './StoryStations';

const CAP=24;
// Single smooth silicone shell. Origin lies in the grip, common to controller and wrist.
const siliconeProfile=[[0,-46],[28,-46],[33,-44],[34,-41],[31,-38],[22,-36],[18,-30],[17,-18],[17,0],[18,24],[19,52],[18,78],[17,90],[18.5,95],[19,99],[18,104],[15,110],[10,115],[4,118],[0,119]].map(([r,y])=>new Vector2(r/1000,y/1000));
export function PlayPiece({toy}:{toy:Toy}) {
  if(toy==='dildo')return <mesh name="play:piece:dildo" rotation-x={-.38} position={[0,.01,-.035]}><latheGeometry args={[siliconeProfile,32]}/><meshStandardMaterial color="#9877ab" roughness={.52}/></mesh>;
  if(toy==='saber')return <AstralSaber/>;
  if(toy==='kite')return <KiteReel/>;
  if(toy==='encore')return <EncoreMic/>;
  const post=toy==='post', main=post?'#47668a':'#62bcaf', trim=post?'#ffce76':'#f39f83';
  return <group name={`play:piece:${toy}`}>
    <mesh position={[0,.015,-.064]} scale={[.059,.062,.092]}><sphereGeometry args={[1,16,12]}/><meshStandardMaterial color={main} roughness={.38}/></mesh>
    <mesh position={[0,.079,-.055]} scale={[.033,.037,.049]}><sphereGeometry args={[1,12,8]}/><meshStandardMaterial color={trim} roughness={.35}/></mesh>
    <mesh position={[0,-.042,-.06]} rotation-z={-.17}><capsuleGeometry args={[.021,.032,3,10]}/><meshStandardMaterial color={main}/></mesh>
    <mesh position={[0,.025,-.173]}><torusGeometry args={[post?.039:.049,.009,7,post?6:24]}/><meshStandardMaterial color={trim} roughness={.4}/></mesh>
    {!post&&<mesh position={[0,.025,-.167]} rotation-z={.4}><torusGeometry args={[.027,.004,5,16]}/><meshStandardMaterial color="#dbf3d4"/></mesh>}
    {!post&&<ShellBadge/>}
  </group>;
}

/** Scalloped ceramic thumb rest on the pool edition of the bubble blower. */
function ShellBadge(){const pool=useMmdVrStore(s=>s.prefs.scenery==='pool');if(!pool)return null;
  return <group position={[0,.075,-.068]} rotation-x={-.40}>
    {[-2,-1,0,1,2].map(i=><mesh key={i} position={[i*.010,.012-Math.abs(i)*.003,0]} rotation-z={-i*.24} scale={[.014,.034,.012]}>
      <sphereGeometry args={[1,10,7]}/><meshStandardMaterial color={i%2?'#f9c5a9':'#edb59b'}/></mesh>)}
  </group>;}

function InHand({toy,hand}:{toy:Toy;hand:Hand}) {
  const body=useRef<Group>(null), bubbles=useRef<InstancedMesh>(null),reticle=useRef<Mesh>(null);
  const scratch=useMemo(()=>({latch:gripLatch(),pose:new Matrix4(),ray:new Matrix4(),at:new Vector3(),dir:new Vector3(),
    dot:new Object3D(), age:new Float32Array(CAP).fill(-1), paths:new Float32Array(CAP*6),next:0,cooldown:0,source:null as XRInputSource|null}),[]);
  useFrame(({gl},delta,frame)=>{
    const prop=body.current;if(!prop)return;
    const session=frame?.session,ref=gl.xr.getReferenceSpace(),s=scratch;
    let source:XRInputSource|undefined;
    if(session)for(const input of session.inputSources)if(input.handedness===hand&&!input.hand&&input.gripSpace&&input.targetRayMode==='tracked-pointer'){source=input;break;}
    if(!source&&session?.visibilityState==='visible') { if(useStagePlay.getState().held?.hand===hand)useStagePlay.getState().stow();return; }
    const visible=!!frame&&!!ref&&!!source&&session?.visibilityState==='visible';
    const grip=visible?frame.getPose(source!.gripSpace!,ref):null, ray=visible?frame.getPose(source!.targetRaySpace,ref):null;
    const tracked=!!grip&&!!ray;
    prop.visible=tracked;
    if(s.source!==(source??null)){s.latch(false,false);s.source=source??null;}
    const bag=useBackpack.getState(),stage=useMmdVrStore.getState();
    const usable=tracked&&!useHudWorldInput.getState().blocked&&!bag.busy&&!bag.draft&&!bag.selected&&!stage.placeMode&&!stage.assetLoad.running&&!stage.physicsBusy&&!stage.physicsFatal;
    const action=s.latch(usable&&toyWorksHere(toy,stage.prefs.scenery),!!source?.gamepad?.buttons[1]?.pressed);
    if(toy==='saber'&&action==='start')useStagePlay.getState().toggleSaber();
    const dt=Math.min(.05,Math.max(0,delta));s.cooldown=Math.max(0,s.cooldown-dt);
    if(tracked){
      s.pose.fromArray(grip.transform.matrix);s.ray.fromArray(ray.transform.matrix);
      const origin=gl.xr.getCamera().parent;if(origin){origin.updateWorldMatrix(true,false);s.pose.premultiply(origin.matrixWorld);s.ray.premultiply(origin.matrixWorld);}
      prop.position.setFromMatrixPosition(s.pose);prop.quaternion.setFromRotationMatrix(s.ray);
       s.dir.set(0,0,-1).applyQuaternion(prop.quaternion);s.at.set(0,.025,-.177).applyQuaternion(prop.quaternion).add(prop.position);
       if(action==='start')squeezeStory(stage.prefs.scenery,toy,s.at,s.dir);
      if(toy==='post'&&reticle.current){
        const distance=Math.abs(s.dir.z)>.0001?(POST_Z-s.at.z)/s.dir.z:-1;
        const x=s.at.x+distance*s.dir.x,y=s.at.y+distance*s.dir.y;
        const hit=distance>0&&distance<18?markAt(x,y):-1;
        reticle.current.visible=stage.prefs.scenery==='floor'&&usable&&hit!==-1&&useStagePlay.getState().stamps.length<3;
        if(reticle.current.visible){reticle.current.position.set(x,y,POST_Z+.012);if(action==='start')useStagePlay.getState().stamp(hit);}
      }
      if(toy==='bubbles'&&action!=='off'&&(action==='start'||s.cooldown<=0)){
        const i=s.next++%CAP,k=i*6;s.age[i]=0;s.cooldown=.13;
        s.paths[k]=s.at.x;s.paths[k+1]=s.at.y;s.paths[k+2]=s.at.z;
        s.paths[k+3]=s.dir.x*1.3;s.paths[k+4]=s.dir.y*1.3;s.paths[k+5]=s.dir.z*1.3;
      }
    }else if(reticle.current)reticle.current.visible=false;
    const batch=bubbles.current;if(!batch)return;
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
  });
  return <group pointerEvents="none"><group ref={body} visible={false}><PlayPiece toy={toy}/></group>
    {toy==='post'?<mesh name="post:aim" ref={reticle} visible={false}><ringGeometry args={[.065,.085,28]}/><meshBasicMaterial color="#fffce1" toneMapped={false}/></mesh>:
     toy==='bubbles'&&<instancedMesh name="play:bubbles" ref={bubbles} args={[undefined,undefined,CAP]} count={0} frustumCulled={false} onUpdate={m=>m.instanceMatrix.setUsage(DynamicDrawUsage)}>
      <sphereGeometry args={[1,14,10]}/><shaderMaterial transparent depthWrite={false}
        vertexShader={`varying vec3 vN,vEye;void main(){vec4 p=modelViewMatrix*instanceMatrix*vec4(position,1.);vN=normalMatrix*mat3(instanceMatrix)*normal;vEye=-p.xyz;gl_Position=projectionMatrix*p;}`}
        fragmentShader={`varying vec3 vN,vEye;void main(){vec3 n=normalize(vN);float rim=pow(1.-abs(dot(normalize(vEye),n)),1.2);float glint=smoothstep(.86,.98,dot(n,normalize(vec3(-.46,.57,.68))));vec3 hue=mix(vec3(.4,.96,.88),vec3(.99,.54,.83),.5+.5*sin(n.y*7.+n.x*3.));gl_FragColor=vec4(mix(hue,vec3(1.),glint),.11+.72*rim+.17*glint);
        #include <colorspace_fragment>
        }`}/></instancedMesh>}
  </group>;
}

export function StagePlay(){const held=useStagePlay(s=>s.held),scenery=useMmdVrStore(s=>s.prefs.scenery);
  return <>{held&&<InHand key={`${held.hand}:${held.toy}`} {...held} />}<StoryStations/>{scenery==='floor'&&<MoonPost/>}</>;
}
