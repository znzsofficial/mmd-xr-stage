import {useFrame} from '@react-three/fiber';
import {useXRInputSourceState} from '@react-three/xr';
import {useEffect,useState,type RefObject} from 'react';
import {Quaternion,Vector3,type Group,type Object3D} from 'three';
import {useBackpack} from '../backpack/store';
import {useMmdVrStore} from '../mmdVrStore';
import {WALK_SPEED} from '../settings/mmdVrQuality';
import {nearCampusDoor} from '../scenery/CampusLayout';
import {RoomGate} from '../scenery/connections';
import type {SceneryId} from '../scenery/catalog';
import {walkBetweenZones,hintLawnPrints} from '../scenery/campusTransit';
import type {MovementMode} from '../settings/preferences';
import {createGroundMotor,groundedBody} from './groundMotor';
import {roomEntry,roomGround} from './roomGround';
import {createSolidColumns,playerSolidRoots,type Column} from './solidColumns';
import {actorBodies,sampleBodies} from './actorBodies';
import {newStick,readStick,stickAxis as axis} from './controllerInput';
import {eyeLift,headMargin} from './eyeHeight';
import {arcadePassage} from '../scenery/arcade/arcadeTravel';

export function usePlayerMovement(originRef:RefObject<Group|null>,dragging:boolean){
  const left=useXRInputSourceState('controller','left'),right=useXRInputSourceState('controller','right');
  const [s]=useState(()=>({body:groundedBody(0,0,0),safe:{x:0,y:0,z:0},mode:null as MovementMode|null,
    room:null as SceneryId|null,epoch:-1,xDown:false,gate:new RoomGate(),motor:createGroundMotor(),solids:createSolidColumns(),
    roots:[] as Object3D[],root:undefined as Object3D|undefined,live:null as unknown,people:true,bodies:[] as ReturnType<typeof actorBodies>,
    direction:new Vector3(),q:new Quaternion(),left:newStick(),right:newStick(),headroom:{floor:0,ceiling:Infinity,blocked:false},snapReady:true,aDown:false,release:null as null|(()=>void)}));
  useEffect(()=>()=>{s.release?.();s.solids.invalidate();s.roots=[];},[s]);
  useFrame(({gl,scene},elapsed,frame)=>{
    const origin=originRef.current,space=gl.xr.getReferenceSpace();if(!origin||!frame||!space)return;
    const pose=(!frame.session.visibilityState||frame.session.visibilityState==='visible')&&frame.getViewerPose(space);if(!pose){s.aDown=s.xDown=true;s.snapReady=false;return;}
    const {prefs,viewEpoch}=useMmdVrStore.getState(),{scenery:room,movementMode:mode}=prefs;
    const local=pose.transform.position,q=pose.transform.orientation;
    const dt=Math.min(.1,Math.max(0,elapsed)),speed=WALK_SPEED[prefs.walkSpeedPref==='auto'?'normal':prefs.walkSpeedPref];
    readStick(frame.session.inputSources,'left',left,s.left);readStick(frame.session.inputSources,'right',right,s.right);
    const pressed=s.right.primary;
    const passage=room==='arcadeHall'&&s.left.primary&&!s.xDown&&!dragging;
    s.xDown=s.left.primary;
    let jump=pressed&&!s.aDown&&!dragging;s.aDown=pressed;
    const turn=s.right.x;
    if(Math.abs(turn)<.5)s.snapReady=true;
    if(dragging)s.snapReady=false;

    let yaw=origin.rotation.y,cos=Math.cos(yaw),sin=Math.sin(yaw);
    // The reference-space pose is current for THIS XRFrame, before Three's
    // render pass. Compensate snap turns about the eye, not the room origin.
    let x=origin.position.x+cos*local.x+sin*local.z,z=origin.position.z-sin*local.x+cos*local.z;
    const entry=roomEntry(room),changedRoom=s.room!==room;
    const reset=changedRoom||s.epoch!==viewEpoch,returning=s.mode==='free'&&mode==='normal';
    if(reset||(mode==='free'&&s.mode!=='free')){s.root=undefined;s.live=null;s.roots=[];s.bodies=[];s.solids.invalidate();}
    if(reset){
      s.room=room;s.epoch=viewEpoch;s.gate.reset();s.release?.();s.release=null;
      x=entry.x;z=entry.z;yaw=0;origin.position.y=roomGround(room,x,z);
      Object.assign(s.body,groundedBody(x,origin.position.y,z));Object.assign(s.safe,{x,y:s.body.y,z});jump=false;
    }else if(returning){
      // Free flight may end inside a wall, below a floor, or outside the set.
      // Return to the last grounded foot in this room, preserving the headset yaw.
      ({x,z}=s.safe);origin.position.y=s.safe.y;Object.assign(s.body,groundedBody(x,s.safe.y,z));s.gate.reset();jump=false;
    }
    s.mode=mode;
    if(!dragging&&Math.abs(turn)>.65&&s.snapReady){yaw-=Math.sign(turn)*prefs.snapTurnDegrees*Math.PI/180;s.snapReady=false;}
    cos=Math.cos(yaw);sin=Math.sin(yaw);
    s.direction.set(0,0,-1).applyQuaternion(s.q.set(q.x,q.y,q.z,q.w));
    const heading=yaw+Math.atan2(-s.direction.x,-s.direction.z),cx=Math.cos(heading),sx=Math.sin(heading);
    const ax=dragging?0:axis(s.left.x),az=dragging?0:axis(s.left.y),scale=speed*dt/Math.max(1,Math.hypot(ax,az));
    const dx=(cx*ax+sx*az)*scale,dz=(-sx*ax+cx*az)*scale;
    let lift=0;
    if(mode==='free'){
      x+=dx;z+=dz;if(!dragging)origin.position.y-=axis(s.right.y)*speed*dt;
      s.gate.reset();
    }else{
      const live=useBackpack.getState().live,root=scene.children.find(o=>o.name==='player:room-solids');
      if(root!==s.root||live!==s.live||prefs.showSceneryPeople!==s.people){
        s.roots=playerSolidRoots(scene);s.root=root;s.live=live;s.people=prefs.showSceneryPeople;s.solids.invalidate();
        s.bodies=actorBodies(useBackpack.getState().entries,live);
      }
      const sample=(px:number,pz:number,foot:number,out:Column)=>{
        out.floor=roomGround(room,px,pz);out.blocked=false;out.ceiling=Infinity;
        if(Number.isFinite(out.floor)){s.solids.sample(s.roots,px,pz,foot,out);sampleBodies(s.bodies,px,pz,foot,out);}
      };
      // Constrain calibration at the current foot before testing the next
      // step. Walking into a lower doorway must still enforce the full height.
      if(prefs.normalEyeOffset>0)sample(s.body.x,s.body.z,s.body.y,s.headroom);
      lift=eyeLift(prefs.normalEyeOffset,local.y,s.headroom.ceiling-(s.body.grounded?s.body.y:s.headroom.floor));
      const eye=local.y+lift,h=Math.max(.24,eye+headMargin);
      // A prop might have been placed on the saved landing during free flight.
      // Prefer the entrance and nearby supported points, never an arbitrary Y.
      if((reset||returning)&&!s.motor.fits(sample,x,z,s.body.y,h)){
        search:for(let ring=0;ring<=10;ring++)for(let i=0;i<(ring?12:1);i++){
          const px=entry.x+.45*ring*Math.cos(i*Math.PI/6),pz=entry.z+.45*ring*Math.sin(i*Math.PI/6);
          const ground=roomGround(room,px,pz);
          if(Number.isFinite(ground)&&s.motor.fits(sample,px,pz,ground,h)){
            x=px;z=pz;origin.position.y=ground;Object.assign(s.body,groundedBody(x,ground,z));break search;
          }
        }
      }
      // Keep the last valid motor foot while a physical lean is out of bounds.
      // Leave tracked x/z alone: only a valid step can move the foot or cross a gate.
      if(eye<.055||!s.motor.track(s.body,sample,x,z,h)){
        s.gate.reset();
        if(!s.body.grounded)s.motor.advance(s.body,sample,0,0,dt,h,false);
      }
      else{
        const beforeX=x,beforeZ=z;
        if(passage&&!reset&&!returning&&s.body.grounded&&!useBackpack.getState().draft){
          const dest=arcadePassage(s.body,(px,py,pz)=>s.motor.fits(sample,px,pz,py,h));
          if(dest)Object.assign(s.body,groundedBody(dest.x,dest.y,dest.z));
        }
        s.motor.advance(s.body,sample,dx,dz,dt,h,jump);x=s.body.x;z=s.body.z;
        if(room==='classroom'&&!s.release&&nearCampusDoor(x,z))s.release=hintLawnPrints();
        // Keep sampling the seam across a small step down (or a jump through
        // the open doorway). Brief loss of ground contact must not erase it.
        const link=dragging?null:s.gate.next(room,x,z,s.body.y);
        if(dragging)s.gate.reset();
        if(link){
          if(walkBetweenZones(link)){
            x+=link.offset[0];z+=link.offset[1];s.room=link.to;s.body.x=x;s.body.z=z;
            Object.assign(s.safe,{x,y:s.body.y,z});s.gate.reset();s.release?.();s.release=null;
          }else if(dx||dz){
            // During restoration or placement, stop the stick on this side;
            // do not silently miss the one crossing event and enter the proxy.
            s.body.x=x=beforeX;s.body.z=z=beforeZ;s.gate.reset();s.gate.next(room,x,z);
          }
        }
        if(s.body.grounded){s.safe.x=x;s.safe.z=z;s.safe.y=s.body.y;}
      }
    }
    // Preserve the physical tracked offset, including on reset/portal crossing.
    origin.position.x=x-cos*local.x-sin*local.z;origin.position.z=z+sin*local.x-cos*local.z;
    if(mode==='normal')origin.position.y=s.body.y+lift;
    origin.rotation.y=yaw;origin.updateMatrixWorld(true);
  },-2); // before hand (-1) and controller (0) collider samples
}
