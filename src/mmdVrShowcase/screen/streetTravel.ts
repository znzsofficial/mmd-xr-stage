import {type Scene,Vector3} from 'three';
import {useBackpack} from '../backpack';
import {createGroundMotor,groundedBody,type ReadColumn} from '../movement/groundMotor';
import {createSolidColumns,playerSolidRoots} from '../movement/solidColumns';
import {actorBodies,sampleBodies} from '../movement/actorBodies';
import {arcadePassage} from '../scenery/arcade/arcadeTravel';
import {roomGround} from '../movement/roomGround';
import {streetsIn} from '../scenery/routes/streets';
import type {SceneryId} from '../scenery/catalog';

// Orbit/zoom/tour remain inspection tools. On a floor, keyboard walking and
// the labelled passage sample the same geometry and standing body as XR.
export function screenStreetTravel(scene:Scene,room:SceneryId){
  const streets=streetsIn(room),arcade=room==='arcadeHall';
  if(!arcade&&!streets.length)return undefined;
  const solids=createSolidColumns(),motor=createGroundMotor(),lastEye=new Vector3(Infinity,0,0);
  let live=null as unknown,roomRoot=undefined as ReturnType<Scene['getObjectByName']>,roots:ReturnType<typeof playerSolidRoots>=[],actors:ReturnType<typeof actorBodies>=[];
  let body=groundedBody(0,0,0);const height=1.65,clearance=1.75;
  const sample:ReadColumn=(x,z,y,column)=>{column.floor=roomGround(room,x,z);column.blocked=false;column.ceiling=Infinity;
    if(!Number.isFinite(column.floor))return;
    solids.sample(roots,x,z,y,column);sampleBodies(actors,x,z,y,column);
  };
  function prepare(eye:Vector3){const bag=useBackpack.getState(),root=scene.getObjectByName('player:room-solids');
    if(live!==bag.live||root!==roomRoot){live=bag.live;roomRoot=root;roots=playerSolidRoots(scene);actors=actorBodies(bag.entries,bag.live);solids.invalidate();}
    if(lastEye.distanceToSquared(eye)>1e-8)body=groundedBody(eye.x,eye.y-height,eye.z);
  }
  return {
    walk(eye:Vector3,offset:Vector3,dt:number){
      if(!offset.lengthSq()&&(body.grounded||lastEye.distanceToSquared(eye)>1e-8))return;
      if(!arcade){
        // Keep the established free inspection camera in the original rooms.
        // At walking height on a street, the same motor as XR follows the
        // bridge crown and slopes and stops at the bank/rails. F/C still fly.
        const onStreet=streets.some(s=>s.ground(room,eye.x,eye.z)!==null||s.ground(room,eye.x+offset.x,eye.z+offset.z)!==null);
        const y=roomGround(room,eye.x,eye.z);
        if(!onStreet||offset.y||Math.abs(eye.y-height-y)>.26){lastEye.set(Infinity,0,0);return;}
      }
      prepare(eye);if(offset.y||!motor.fits(sample,body.x,body.z,body.y,clearance)){lastEye.set(Infinity,0,0);return;}
      motor.advance(body,sample,offset.x,offset.z,dt,clearance,false);lastEye.set(body.x,body.y+height,body.z);offset.copy(lastEye).sub(eye);
    },
    pass:arcade?(eye:Vector3,offset:Vector3)=>{prepare(eye);const dest=arcadePassage(body,(x,y,z)=>motor.fits(sample,x,z,y,clearance));
      if(!dest)return false;body=groundedBody(dest.x,dest.y,dest.z);lastEye.set(dest.x,dest.y+height,dest.z);offset.copy(lastEye).sub(eye);return true;
    }:undefined,dispose(){solids.invalidate();},
  };
}
