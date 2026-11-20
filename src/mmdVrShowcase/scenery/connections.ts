import type {TranslationKey} from '../../languageStore';
import type {SceneryId} from './catalog';
import {CAMPUS_DOOR,CAMPUS_OFFSET,SCHOOL_GATE} from './CampusLayout';
import {LIDO_ENTRY,LIDO_GATE,POOL_ORIGIN} from './LidoLayout';
import {CLINIC_ORIGIN,GARDEN_DOOR} from './clinic/clinicApproach';

type Point=readonly [number,number,number];
export type RoomLink = {
  from:SceneryId; to:SceneryId;
  // Seam and band are in departing-room metres. Move the entire XR origin,
  // preserving the user's tracked offset and heading across the seam.
  axis:'x'|'z'; direction:1|-1; gate:number; band:readonly [number,number];
  offset:readonly [number,number]; arrival:{key:TranslationKey;eye:Point;aim:Point};
};
const {x:dx,z:dz}=CAMPUS_OFFSET;
const {x:cx,z:cz}=CLINIC_ORIGIN,{x:px,z:pz}=POOL_ORIGIN;
const band=(mid:number,r:number):[number,number]=>[mid-r,mid+r];
export const roomLinks:readonly RoomLink[]=[
  {from:'classroom',to:'lawn',axis:'z',direction:1,gate:SCHOOL_GATE.out,band:band(CAMPUS_DOOR,SCHOOL_GATE.half),offset:[dx,dz],
    arrival:{key:'campusGoLawn',eye:[dx+CAMPUS_DOOR,1.60,dz+6.66],aim:[-1.42,1.02,-3.01]}},
  {from:'lawn',to:'classroom',axis:'z',direction:-1,gate:dz+SCHOOL_GATE.in,band:band(dx+CAMPUS_DOOR,SCHOOL_GATE.half),offset:[-dx,-dz],
    arrival:{key:'campusGoClass',eye:[CAMPUS_DOOR,1.59,5.32],aim:[-.83,1.19,-4.05]}},
  {from:'lawn',to:'pool',axis:'z',direction:-1,gate:pz+LIDO_GATE.in,band:band(px+LIDO_ENTRY.x,LIDO_GATE.half),offset:[-px,-pz],
    arrival:{key:'lidoGoPool',eye:[6.18,1.60,7.08],aim:[4.16,1.04,-9.60]}},
  {from:'pool',to:'lawn',axis:'z',direction:1,gate:LIDO_GATE.out,band:band(LIDO_ENTRY.x,LIDO_GATE.half),offset:[px,pz],
    arrival:{key:'lidoGoLawn',eye:[px+6.14,1.58,pz+9.91],aim:[-3.88,.96,-5.42]}},
  {from:'lawn',to:'clinic',axis:'x',direction:-1,gate:cx+GARDEN_DOOR.inGate,band:band(cz+GARDEN_DOOR.z,GARDEN_DOOR.clear/2),offset:[-cx,-cz],
    arrival:{key:'lawnGoClinic',eye:[7.99,1.59,2.94],aim:[2.63,1.22,1.69]}},
  {from:'clinic',to:'lawn',axis:'x',direction:1,gate:GARDEN_DOOR.outGate,band:band(GARDEN_DOOR.z,GARDEN_DOOR.clear/2),offset:[cx,cz],
    arrival:{key:'clinicGoLawn',eye:[cx+9.67,1.60,cz+2.97],aim:[cx+17.22,.97,cz+2.05]}},
];
export class RoomGate {
  private last:SceneryId|null=null;
  private x=0; private z=0;
  private readonly exits=new Map<SceneryId,RoomLink[]>();
  constructor(links:readonly RoomLink[]=roomLinks){
    for(const link of links){const group=this.exits.get(link.from);if(group)group.push(link);else this.exits.set(link.from,[link]);}
  }
  hasExits(room:SceneryId){return this.exits.has(room);}
  next(room:SceneryId,x:number,z:number){
    const px=this.x,pz=this.z,continuous=this.last===room&&Math.hypot(x-px,z-pz)<3;
    this.x=x;this.z=z;this.last=room;
    const exits=this.exits.get(room);
    if(continuous&&exits)for(const link of exits){
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
