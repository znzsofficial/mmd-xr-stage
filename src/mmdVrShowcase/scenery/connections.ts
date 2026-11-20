import type {TranslationKey} from '../../languageStore';
import type {SceneryId} from './catalog';
import {CAMPUS_OFFSET} from './CampusLayout';
import {POOL_ORIGIN_Z} from './LidoLayout';

type Point=readonly [number,number,number];
export type RoomLink = {
  from:SceneryId; to:SceneryId;
  // Seam and band are in departing-room metres. Move the entire XR origin,
  // preserving the user's tracked offset and heading across the seam.
  axis:'x'|'z'; direction:1|-1; gate:number; band:readonly [number,number];
  offset:readonly [number,number]; arrival:{key:TranslationKey;eye:Point;aim:Point};
};
const {x:dx,z:dz}=CAMPUS_OFFSET;
export const roomLinks:readonly RoomLink[]=[
  {from:'classroom',to:'lawn',axis:'x',direction:-1,gate:-8.75,band:[6.24,8.20],offset:[dx,dz],
    arrival:{key:'campusGoLawn',eye:[2.73,1.61,.42],aim:[-4.2,1.42,-6.4]}},
  {from:'lawn',to:'classroom',axis:'x',direction:1,gate:dx-7.8,band:[dz+6.24,dz+8.20],offset:[-dx,-dz],
    arrival:{key:'campusGoClass',eye:[-8.04,1.61,7.25],aim:[-3.35,1.34,6.21]}},
  {from:'lawn',to:'pool',axis:'z',direction:-1,gate:POOL_ORIGIN_Z+8.85,band:[-1.35,1.35],offset:[0,-POOL_ORIGIN_Z],
    arrival:{key:'lidoGoPool',eye:[.35,1.62,8.12],aim:[-.4,1.17,-9.50]}},
  {from:'pool',to:'lawn',axis:'z',direction:1,gate:9.85,band:[-1.35,1.35],offset:[0,POOL_ORIGIN_Z],
    arrival:{key:'lidoGoLawn',eye:[.42,1.62,-9.86],aim:[-3.8,1.42,-5.0]}},
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
      const across=link.axis==='x',before=across?px:pz,after=across?x:z,along=across?z:x;
      if((before-link.gate)*link.direction<=0&&(after-link.gate)*link.direction>0&&along>link.band[0]&&along<link.band[1])return link;
    }
    return null;
  }
  reset(){this.last=null;}
}
