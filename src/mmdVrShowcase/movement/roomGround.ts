import type {SceneryId} from '../scenery/catalog';
import {ROOM} from '../scenery/ClassroomLayout';
import {classPassageFloor,lawnSchoolFoot} from '../scenery/CampusLayout';
import {chapelFloor} from '../scenery/ChapelLayout';
import {onObservatoryFloor} from '../scenery/ObservatoryLayout';
import {LAWN_SIZE,SIMPLE_FLOOR_RADIUS} from '../scenery/placementAreas';
import {borrowedLido,POOL,POOL_SUPPORT} from '../scenery/LidoLayout';
import {clinicNavigation} from '../scenery/clinic/clinicNavigation';
import {canWalkByLawnClinic} from '../scenery/clinic/clinicApproach';
import {songhouseClear,songhouseHeight,XR_ENTRY} from '../scenery/qinhuai/songhouseLayout';
import {weddingClear,WEDDING_ENTRY} from '../scenery/wedding/weddingLayout';
import {retreatGround,retreatPlan} from '../scenery/retreat/retreatLayout';
import {PAD_RADIUS} from '../scenery/planet/planetLayout';
import {velvetEntry,velvetGround} from '../scenery/velvet/velvetLayout';
import {chamberEntry,chamberGround} from '../scenery/chamber/chamberLayout';
import {entry as arcadeEntry,baseGround} from '../scenery/arcade/arcadeLayout';

const origin={x:0,z:0},clinicEntry={x:0,z:2.8};
export function roomEntry(room:SceneryId){
  if(room==='arcadeHall')return arcadeEntry;
  if(room==='velvetStudio')return velvetEntry;
  if(room==='medievalChamber')return chamberEntry;
  if(room==='lanternSuite'||room==='moonSpa')return retreatPlan(room).entry;
  return room==='qinhuai'?XR_ENTRY:room==='weddingCourt'?WEDDING_ENTRY:room==='clinic'?clinicEntry:origin;
}
type Rect={x:number;z:number;w:number;d:number};
const inside=(x:number,z:number,r:Rect)=>Math.abs(x-r.x)<=r.w/2&&Math.abs(z-r.z)<=r.d/2;

// These are travel extents, NOT places where a backpack asset may be dropped.
// Actual walls, planks, GLB furniture and overhead beams are tested separately.
// -Infinity is outside the playable floor (water/void/borrowed scenery).
export function roomGround(room:SceneryId,x:number,z:number){
  switch(room){
    case 'arcadeHall':return baseGround(x,z);
    case 'velvetStudio':return velvetGround(x,z);
    case 'medievalChamber':return chamberGround(x,z);
    case 'glassPlanet':return Math.hypot(x,z)<PAD_RADIUS?0:-Infinity; // flat landing pad; XR uses the radial collider
    case 'floor':return Math.hypot(x,z)<SIMPLE_FLOOR_RADIUS-.16?0:-Infinity;
    case 'classroom':{
      const interior=Math.abs(x)<ROOM.w/2-.16&&Math.abs(z)<ROOM.d/2-.16;
      return interior||classPassageFloor(x,z)?0:-Infinity;
    }
    case 'lawn':return Math.max(Math.abs(x),Math.abs(z))<LAWN_SIZE/2-.16&&canWalkByLawnClinic(x,z)&&!borrowedLido(x,z)&&!lawnSchoolFoot(x,z)?0:-Infinity;
    case 'clinic':return clinicNavigation.clear(x,z)?0:-Infinity;
    case 'weddingCourt':return weddingClear(x,z)?0:-Infinity;
    case 'lanternSuite': case 'moonSpa':return retreatGround(room,x,z);
    case 'qinhuai':return songhouseClear(x,z)?songhouseHeight(x,z):-Infinity;
    case 'pool':return POOL_SUPPORT.some(r=>inside(x,z,r))&&!inside(x,z,POOL.water)?0:-Infinity;
    case 'chapel':return chapelFloor(x,z)?0:-Infinity;
    case 'astralCourt':return onObservatoryFloor(x,z)?0:-Infinity;
    case 'liveHouse':return Math.abs(x)<8.5&&z>-5.50&&z<10.68?
      (Math.max(Math.abs(x),Math.abs(z))<=5.8?0:-.66):-Infinity;
  }
}
