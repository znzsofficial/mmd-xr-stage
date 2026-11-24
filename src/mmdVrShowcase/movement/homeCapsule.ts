import type Rapier from '@dimforge/rapier3d-compat';
import type {World} from '@dimforge/rapier3d-compat';
import {Quaternion,Vector3} from 'three';
import {homeGravity} from '../scenery/planet/planetLayout';
import {headMargin} from './eyeHeight';
import {homeStride} from './homeStride';
import {bodyAboveFoot,planetCentre,type PlanetDriver,type Traveller} from './planetTravel';

const zero={x:0,y:0,z:0};
// The motor owns the sole; this inset capsule resolves solid contact between
// two supported poses. No character/render callback is registered on the side.
export function createHomeCapsule(rapier:typeof Rapier,world:World,walkSpeed:()=>number):PlanetDriver&{dispose():void}{
  const body=world.createRigidBody(rapier.RigidBodyDesc.dynamic().lockRotations().setEnabled(false));
  const collider=world.createCollider(rapier.ColliderDesc.capsule(.3,.3).setFriction(0),body);
  const mass=body.mass(),headShape=new rapier.Ball(headMargin),stride=homeStride();
  const at=new Vector3(),command=new Vector3(),velocity=new Vector3(),impulse=new Vector3(),radial=new Vector3();
  const oldFoot=new Vector3(),oldUp=new Vector3(),oldBasis=new Quaternion(),from=new Vector3(),delta=new Vector3();
  let active=false,braked=true,live=true;

  // This world contains only the invisible capsule and fixed collision solids;
  // there are no render transforms, events or other actors to synchronize.
  function advance(h:number){world.timestep=h;world.step();}
  function place(s:Traveller){
    body.setTranslation(at.copy(s.foot).addScaledVector(s.up,bodyAboveFoot),true);
    body.setRotation(s.basis,true);
  }
  return {
    ready:()=>live, // published only after creation; no WASM polling while parked
    seed(s){
      if(!live)return;
      active=true;body.setEnabled(true);place(s);
      // A late handoff may already be walking. Velocity is measured at the
      // sole, not at the centre of the (larger radius) physics capsule.
      velocity.copy(s.velocity).projectOnPlane(s.up).multiplyScalar(1+bodyAboveFoot/s.foot.distanceTo(planetCentre));
      body.setLinvel(velocity,true);braked=velocity.lengthSq()===0;
    },
    step(s,elapsed,x,forward,localEye,read){
      if(!active||!(elapsed>0))return;
      const dt=Math.min(.05,elapsed),moving=!!(x||forward);
      command.crossVectors(s.dir,s.up).multiplyScalar(x).addScaledVector(s.dir,forward).clampLength(0,1);
      command.applyQuaternion(oldBasis.copy(s.basis).invert()).multiplyScalar(moving?walkSpeed():0);
      const count=Math.ceil(dt*60),h=dt/count,gain=-Math.expm1(-10*h);
      for(let i=0;i<count;i++){
        oldFoot.copy(s.foot);oldUp.copy(s.up);oldBasis.copy(s.basis);
        from.copy(localEye).applyQuaternion(oldBasis).add(oldFoot);
        if(moving){
          const r=oldFoot.distanceTo(planetCentre);
          // The same h sets both the change of momentum and the Rapier tick.
          // Retain the deadzoned magnitude, limiting only overlong diagonals.
          velocity.copy(body.linvel());
          impulse.copy(command).applyQuaternion(s.basis).multiplyScalar(1+bodyAboveFoot/r)
            .sub(velocity).multiplyScalar(gain).addScaledVector(s.up,-homeGravity(r)*h).multiplyScalar(mass);
          body.applyImpulse(impulse,true);advance(h);
          at.copy(body.translation());radial.subVectors(at,planetCentre).normalize();
          stride(s,at.addScaledVector(radial,-bodyAboveFoot),true,h,read);
        }else{
          if(!braked){body.setLinvel(zero,true);braked=true;}
          // Re-check the floor even at rest (the visitor can move/remove a
          // prop). With the same support there is no need to tick this world.
          stride(s,oldFoot,false,h,read);
          if(s.foot.distanceToSquared(oldFoot)<1e-20)return;
          advance(h); // refresh new/changed solids for the virtual head sweep
        }
        // Sweep the tracked eye through virtual travel only, including changes
        // of support. A physical lean at rest never pushes the viewer away.
        delta.copy(localEye).applyQuaternion(s.basis).add(s.foot).sub(from);
        if(delta.lengthSq()>1e-12&&world.castShape(from,oldBasis,delta,headShape,0,1,false,undefined,undefined,collider,body)){
          s.foot.copy(oldFoot);s.up.copy(oldUp);s.basis.copy(oldBasis);s.grounded=true;s.velocity.set(0,0,0);
        }
        place(s);
        braked=!moving||s.velocity.lengthSq()===0;
        body.setLinvel(braked?zero:velocity.copy(body.linvel()).projectOnPlane(s.up),true);
        if(!s.grounded)break; // send the actual ledge velocity to the orbit owner
      }
    },
    stop(){if(!active)return;active=false;braked=true;body.setLinvel(zero,false);body.setEnabled(false);},
    dispose(){if(!live)return;live=active=false;world.removeRigidBody(body);},
  };
}
