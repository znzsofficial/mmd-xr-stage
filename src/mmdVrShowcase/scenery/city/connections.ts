import type {RoomLink} from '../connections';
import {CAMPUS_DOOR,SCHOOL_GATE} from '../CampusLayout';
import {GARDEN_DOOR} from '../clinic/clinicApproach';
import {LIDO_ENTRY,LIDO_GATE} from '../LidoLayout';
import {arcadeDoor,CITY_ORIGINS,type CityVenue} from './site';

// Both sides use the same +X/+Z heading. The two gate positions bracket
// the seam, so one forward step can never activate the return link.
function doorway(venue:CityVenue,axis:RoomLink['axis'],mid:number,half:number,
  into:number,out:number,inside:RoomLink['arrival'],outside:RoomLink['arrival']):RoomLink[]{
  const o=CITY_ORIGINS[venue],side=axis==='x'?o.z:o.x;
  return [
    {from:'seasideTerminus',to:venue,axis,direction:-1,gate:o[axis]+into,band:[side+mid-half,side+mid+half],offset:[-o.x,-o.z],arrival:inside},
    {from:venue,to:'seasideTerminus',axis,direction:1,gate:out,band:[mid-half,mid+half],offset:[o.x,o.z],arrival:outside},
  ];
}

export const cityLinks:readonly RoomLink[]=[
  ...doorway('clinic','x',GARDEN_DOOR.z,GARDEN_DOOR.clear/2,GARDEN_DOOR.inGate,GARDEN_DOOR.outGate,
    {key:'cityEnterClinic',eye:[7.99,1.65,2.94],aim:[2.63,1.22,1.69]},
    {key:'clinicToCity',eye:[9.76,1.65,53.8],aim:[20.4,1.36,53.9]}),
  ...doorway('classroom','z',CAMPUS_DOOR,SCHOOL_GATE.half,SCHOOL_GATE.in,SCHOOL_GATE.out,
    {key:'cityEnterSchool',eye:[CAMPUS_DOOR,1.65,5.03],aim:[-.83,1.19,-4.05]},
    {key:'schoolToCity',eye:[39.97,1.65,54.52],aim:[35.4,1.38,58.7]}),
  ...doorway('pool','z',LIDO_ENTRY.x,LIDO_GATE.half,LIDO_GATE.in,LIDO_GATE.out,
    {key:'cityEnterPool',eye:[6.18,1.65,7.08],aim:[4.16,1.04,-9.60]},
    {key:'poolToCity',eye:[-24.25,1.65,73.58],aim:[-23.8,1.32,86.8]}),
  ...doorway('arcadeHall','z',arcadeDoor.x,arcadeDoor.half,arcadeDoor.inGate,arcadeDoor.outGate,
    {key:'cityEnterArcade',eye:[9.10,1.65,12.65],aim:[9.10,2.48,4.5]},
    {key:'arcadeToCity',eye:[29.1,1.65,84.24],aim:[23.5,1.32,87.23]}),
];
