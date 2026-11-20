import type {SceneryId} from '../scenery/catalog';
import {ROOM} from '../scenery/ClassroomLayout';
import {CAMPUS_DOOR,classPassageFloor} from '../scenery/CampusLayout';
import {chapelFloor} from '../scenery/ChapelLayout';
import {onObservatoryFloor} from '../scenery/ObservatoryLayout';
import {LAWN_SIZE,POOL,SIMPLE_FLOOR_RADIUS} from '../scenery/placementAreas';
import {LIDO_ENTRY,TIME_DECK} from '../scenery/LidoLayout';
import {clinicNavigation} from '../scenery/clinic/clinicNavigation';
import {canWalkByLawnClinic} from '../scenery/clinic/clinicApproach';
import {songhouseClear,songhouseHeight,XR_ENTRY} from '../scenery/qinhuai/songhouseLayout';
import {weddingClear,WEDDING_ENTRY} from '../scenery/wedding/weddingLayout';

const origin={x:0,z:0},clinicEntry={x:0,z:2.8};
export function roomEntry(room:SceneryId){return room==='qinhuai'?XR_ENTRY:room==='weddingCourt'?WEDDING_ENTRY:room==='clinic'?clinicEntry:origin;}
type Rect={x:number;z:number;w:number;d:number};
const inside=(x:number,z:number,r:Rect)=>Math.abs(x-r.x)<=r.w/2&&Math.abs(z-r.z)<=r.d/2;
const decks=[POOL.deck,...POOL.walks,POOL.farWalk,TIME_DECK,LIDO_ENTRY];

// These are travel extents, NOT places where a backpack asset may be dropped.
// Actual walls, planks, GLB furniture and overhead beams are tested separately.
// -Infinity is outside the playable floor (water/void/borrowed scenery).
export function roomGround(room:SceneryId,x:number,z:number){
  switch(room){
    case 'floor':return Math.hypot(x,z)<SIMPLE_FLOOR_RADIUS-.16?0:-Infinity;
    case 'classroom':{
      const interior=Math.abs(x)<ROOM.w/2-.16&&Math.abs(z)<ROOM.d/2-.16;
      const door=Math.abs(x-CAMPUS_DOOR)<.73&&z>ROOM.d/2-.32&&z<6.4;
      // The loading seam is at -8.75, just beyond the placement rectangle.
      return interior||door||classPassageFloor(x,z)||(x>=-10.1&&x<=-7.7&&z>6.25&&z<8.18)?0:-Infinity;
    }
    case 'lawn':return Math.max(Math.abs(x),Math.abs(z))<LAWN_SIZE/2-.16&&canWalkByLawnClinic(x,z)&&!(z< -14.1&&Math.abs(x)<7.1)?0:-Infinity;
    case 'clinic':return clinicNavigation.clear(x,z)?0:-Infinity;
    case 'weddingCourt':return weddingClear(x,z)?0:-Infinity;
    case 'qinhuai':return songhouseClear(x,z)?songhouseHeight(x,z):-Infinity;
    case 'pool':return decks.some(r=>inside(x,z,r))&&!inside(x,z,POOL.water)?0:-Infinity;
    case 'chapel':return chapelFloor(x,z)?0:-Infinity;
    case 'astralCourt':return onObservatoryFloor(x,z)?0:-Infinity;
    case 'liveHouse':return Math.abs(x)<8.5&&z>-5.50&&z<10.68?
      (Math.max(Math.abs(x),Math.abs(z))<=5.8?0:-.66):-Infinity;
  }
}
