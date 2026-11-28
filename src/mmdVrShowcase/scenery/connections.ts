import type {TranslationKey} from '../../languageStore';
import type {SceneryId} from './catalog';
import {CAMPUS_DOOR,CAMPUS_OFFSET,SCHOOL_GATE} from './CampusLayout';
import {LIDO_ENTRY,LIDO_GATE,POOL_ORIGIN} from './LidoLayout';
import {CLINIC_ORIGIN,GARDEN_DOOR} from './clinic/clinicApproach';
import {campusArcadeLinks} from './routes/campusArcade/layout';
import {riverStreetLinks} from './routes/riverStreet/layout';
import {cityLinks} from './city/connections';

type Point=readonly [number,number,number];
export type RoomLink = {
  from:SceneryId; to:SceneryId;
  // Seam and band are in departing-room metres. Move the entire XR origin,
  // preserving the user's tracked offset and heading across the seam.
  axis:'x'|'z'; direction:1|-1; gate:number; band:readonly [number,number];
  floorY?:number; // Local foot level of the doorway, zero for the street gates.
  offset:readonly [number,number]; arrival:{key:TranslationKey;eye:Point;aim:Point};
};
const {x:dx,z:dz}=CAMPUS_OFFSET;
const {x:cx,z:cz}=CLINIC_ORIGIN,{x:px,z:pz}=POOL_ORIGIN;
const band=(mid:number,r:number):[number,number]=>[mid-r,mid+r];
export const roomLinks:readonly RoomLink[]=[
  {from:'lawn',to:'classroom',axis:'z',direction:-1,gate:dz+SCHOOL_GATE.in,band:band(dx+CAMPUS_DOOR,SCHOOL_GATE.half),offset:[-dx,-dz],
    arrival:{key:'campusGoClass',eye:[CAMPUS_DOOR,1.59,5.32],aim:[-.83,1.19,-4.05]}},
  {from:'lawn',to:'pool',axis:'z',direction:-1,gate:pz+LIDO_GATE.in,band:band(px+LIDO_ENTRY.x,LIDO_GATE.half),offset:[-px,-pz],
    arrival:{key:'lidoGoPool',eye:[6.18,1.60,7.08],aim:[4.16,1.04,-9.60]}},
  {from:'lawn',to:'clinic',axis:'x',direction:-1,gate:cx+GARDEN_DOOR.inGate,band:band(cz+GARDEN_DOOR.z,GARDEN_DOOR.clear/2),offset:[-cx,-cz],
    arrival:{key:'lawnGoClinic',eye:[7.99,1.59,2.94],aim:[2.63,1.22,1.69]}},
  ...cityLinks, ...campusArcadeLinks, ...riverStreetLinks,
];
export class RoomGate {
  private last:SceneryId|null=null;
  private x=0; private z=0;
  private readonly exits=new Map<SceneryId,RoomLink[]>();
  constructor(links:readonly RoomLink[]=roomLinks){
    for(const link of links){const group=this.exits.get(link.from);if(group)group.push(link);else this.exits.set(link.from,[link]);}
  }
  hasExits(room:SceneryId){return this.exits.has(room);}
  next(room:SceneryId,x:number,z:number,footY=0){
    const px=this.x,pz=this.z,continuous=this.last===room;
    this.x=x;this.z=z;this.last=room;
    return continuous ? this.crossing(room,px,pz,x,z,footY) : null;
  }
  // Screen movement supplies the actual keyboard step. Orbiting, resetting
  // or changing tour cameras never contributes a travelled segment.
  crossing(room:SceneryId,px:number,pz:number,x:number,z:number,footY:number){
    const exits=this.exits.get(room);
    if(exits&&Math.hypot(x-px,z-pz)<3)for(const link of exits){
      if(Math.abs(footY-(link.floorY??0))>.75)continue; // a small jump may pass; an overlapping gallery cannot
      const across=link.axis==='x',before=across?px:pz,after=across?x:z;
      if((before-link.gate)*link.direction<=0&&(after-link.gate)*link.direction>0){
        const t=(link.gate-before)/(after-before),along=across?pz+(z-pz)*t:px+(x-px)*t;
        if(along>link.band[0]&&along<link.band[1])return link;
      }
    }
    return null;
  }
  reset(){this.last=null;}
}
