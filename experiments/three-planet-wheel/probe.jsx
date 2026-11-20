import React, {Suspense, useEffect, useRef} from 'react';
import {createRoot} from 'react-dom/client';
import {Canvas, useThree} from '@react-three/fiber';
import {BallCollider, Physics, RigidBody} from '@react-three/rapier';
import {Ecctrl} from 'ecctrl';
import {useCustomGravity} from 'ecctrl/gravity';
import {Vector3} from 'three';

const radius=12, hz=Number(new URLSearchParams(location.search).get('hz'))===90?90:72;
const speed=2.4, gravity=2.5;
function Probe(){
  const player=useRef(null),advance=useThree(s=>s.advance);
  useEffect(()=>{
    const force=new Vector3(),p=new Vector3(),forward=new Vector3(),axis=new Vector3(1,0,0);
    const store=useCustomGravity.getState(),previousField=store.gravityField;
    store.setGravityField(at=>force.copy(at).normalize().multiplyScalar(-gravity));
    let time=0;const step=()=>advance(time+=1/hz,false);
    const run=()=>{
      const c=player.current, at=()=>p.copy(c.body.translation());
      for(let i=0;i<2*hz;i++)step();
      if(!c.isOnGround)throw Error('Capsule did not settle on planet');
      const restingRadius=at().length();let angle=0,prev=0,bottom=1,maxGap=0,minUpDot=1,jump=null;
      for(let i=0;i<80*hz&&angle<2*Math.PI;i++){
        const up=at().normalize(),a=Math.atan2(up.z,up.y),diff=a-prev;prev=a;
        angle+=Math.atan2(Math.sin(diff),Math.cos(diff));bottom=Math.min(bottom,up.y);
        minUpDot=Math.min(minUpDot,c.upAxis.dot(up));maxGap=Math.max(maxGap,Math.abs(at().length()-restingRadius));
        if(!jump&&angle>=Math.PI){
          c.setMovement({forward:false});for(let j=0;j<hz;j++)step();
          const rest=at().length(),startUp=at().normalize().y;
          c.setMovement({jump:true});step();c.setMovement({jump:false});
          let peak=0,landed=false;for(let j=0;j<6*hz;j++){step();const height=at().length()-rest;peak=Math.max(peak,height);
            if(peak>.15&&Math.abs(height)<.05&&c.isOnGround){landed=true;break}}
          jump={startUp,peak,landed};
        }
        c.setForwardDir(forward.crossVectors(axis,at().normalize()).normalize());c.setMovement({forward:true});step();
      }
      const result={hz,radius,speed,gravity,angle,bottom,maxGap,minUpDot,jump};
      const pass=angle>=2*Math.PI&&bottom<-.99&&minUpDot>.98&&maxGap<.15&&jump?.startUp<-.98&&jump.landed;
      document.querySelector('#result').textContent=(pass?'PASS ':'FAIL ')+JSON.stringify(result,null,2);
    };
    // Start after Rapier/R3F have committed the colliders; all motion below is
    // through the published controller inputs, never by setting its position.
    const id=requestAnimationFrame(()=>{try{run()}catch(e){document.querySelector('#result').textContent='FAIL '+e.message}});
    return ()=>{cancelAnimationFrame(id);store.setGravityField(previousField)};
  },[advance]);
  return <><RigidBody type="fixed" colliders={false}><BallCollider args={[radius]}/></RigidBody>
    <Ecctrl ref={player} position={[0,radius+1,0]} enableCustomGravity useCustomForward canSleep={false}
      maxWalkVel={speed} jumpVel={2.4} fallingGravityScale={1}/></>;
}
createRoot(document.querySelector('#root')).render(<Canvas frameloop="never" dpr={1}>
  <Suspense fallback={null}><Physics gravity={[0,0,0]} timeStep={1/hz} interpolate={false}><Probe/></Physics></Suspense>
</Canvas>);
