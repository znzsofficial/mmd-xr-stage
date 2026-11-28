import {CAMPUS_DOOR,SCHOOL_GATE,campusPassageParts,schoolExterior} from '../CampusLayout';
import {forecourtEdge} from '../arcade/westGallery';
import {APRON,EAST_FACE,GARDEN_DOOR,approachSolids} from '../clinic/clinicApproach';
import {LIDO_ENTRY,LIDO_GATE,arcadeParts,distantLido,poolBarrierParts} from '../LidoLayout';
import {shell,westStreetDoor as arcadeDoor} from '../routes/campusArcade/site';
import type {Part} from '../SceneryBatch';
import {laneMouth} from '../terminus/parkLayout';
import type {PickDeck} from '../routes/types';
import {cityGreenBlocks,cityGreenDeck} from './green';
import {cityStreetFurnitureBlocks} from './streetFurniture';
export {westStreetDoor as arcadeDoor} from '../routes/campusArcade/site';

export type CityVenue='clinic'|'classroom'|'pool'|'arcadeHall';
export const CITY_ORIGINS={
  clinic:{x:0,z:51},classroom:{x:44,z:48},pool:{x:-30.4,z:63.7},arcadeHall:{x:20,z:68.6},
} as const satisfies Record<CityVenue,{x:number;z:number}>;

const c=CITY_ORIGINS.clinic,s=CITY_ORIGINS.classroom,p=CITY_ORIGINS.pool,a=CITY_ORIGINS.arcadeHall;
const clinicZ=c.z+GARDEN_DOOR.z, schoolX=s.x+CAMPUS_DOOR, poolX=p.x+LIDO_ENTRY.x, arcadeX=a.x+arcadeDoor.x;
const apronEnd=Math.min(c.x+APRON.x+APRON.w/2,cityGreenDeck.x-cityGreenDeck.w/2);
const laneLeft=laneMouth.x-laneMouth.w/2,laneRight=laneMouth.x+laneMouth.w/2;

function paving(id:string,left:number,right:number,back:number,front:number):PickDeck & {id:string}{
  return {id,x:(left+right)/2,z:(back+front)/2,w:right-left,d:front-back,y:0};
}

// Share edges at each T-junction. The green is its own mesh and pick deck;
// the two short approaches terminate at, rather than underneath, its boundary.
export const cityPavements=[
  paving('station-street',laneLeft,laneRight,laneMouth.z+laneMouth.d/2,56.8),
  paving('green-east',cityGreenDeck.x+cityGreenDeck.w/2,laneLeft,47.6,50.6),
  paving('green-north',14,17.5,cityGreenDeck.z+cityGreenDeck.d/2,52.3),
  paving('clinic-walk',apronEnd,laneLeft,52.3,55.3),
  paving('clinic-porch',c.x+GARDEN_DOOR.x,apronEnd,clinicZ-APRON.d/2,clinicZ+APRON.d/2),
  paving('clinic-door',c.x+GARDEN_DOOR.inGate-.40,c.x+GARDEN_DOOR.x,clinicZ-GARDEN_DOOR.clear/2,clinicZ+GARDEN_DOOR.clear/2),
  paving('school-street',-1,schoolX+2.15,56.8,60.2),
  // The brick walk fans west across this landing. A narrow rectangle around
  // the canopy alone left a gap in the walkable route along the brick bend.
  paving('school-porch',schoolX-5.52,schoolX+1.75,53.80,56.8),
  paving('school-door',schoolX-SCHOOL_GATE.half,schoolX+SCHOOL_GATE.half,s.z+SCHOOL_GATE.in-.40,53.80),
  paving('inland-street',-1,3,60.2,85.2),
  paving('sports-street',poolX-2.1,arcadeX+2.1,85.2,88.8),
  paving('pool-walk',poolX-1.85,poolX+1.85,75.7,85.2),
  paving('pool-gate',poolX-LIDO_GATE.half,poolX+LIDO_GATE.half,p.z+LIDO_GATE.in-.40,75.7),
  paving('arcade-gate',arcadeX-arcadeDoor.half,arcadeX+arcadeDoor.half,a.z+arcadeDoor.inGate-.40,85.2),
] as const;

export type CityBlock={x:number;z:number;w:number;d:number;bottom:number;top:number};

// A separate piece drawn by the west forecourt connects its last metre to
// the city paving. It must also support a translated foot from either room.
export const arcadeVestibule=paving('arcade-vestibule',arcadeX-arcadeDoor.half,arcadeX+arcadeDoor.half,
  a.z+forecourtEdge,a.z+arcadeDoor.inGate-.40);
export const cityDecks:readonly PickDeck[]=[...cityPavements,arcadeVestibule,cityGreenDeck];

function partBlock(part:Part):CityBlock{
  const [x,y,z]=part.p,[w,h,d]=part.s;
  const pitch=part.rx??0,depth=Math.abs(d*Math.cos(pitch))+Math.abs(h*Math.sin(pitch));
  const height=Math.abs(h*Math.cos(pitch))+Math.abs(d*Math.sin(pitch));
  return {x,z,w,d:depth,bottom:y-height/2,top:y+height/2};
}
// Omit the floor slabs: their shoe surfaces do not occlude an actor on them.
const schoolBlocks=[...schoolExterior(),...campusPassageParts()].map(partBlock).filter(b=>b.top>.04);
const clinicBlocks=[...EAST_FACE,...approachSolids,
  ...[-9,4.8].map(z=>({x:0,z,w:17.32,d:.16,bottom:0,top:3.12})),
  {x:-8.6,z:-2.1,w:.16,d:13.8,bottom:0,top:3.12},
  {x:0,z:-2.1,w:17.62,d:14.13,bottom:3.12,top:3.36},
];
const lidoBlocks=[...arcadeParts(),...poolBarrierParts(),...distantLido()].map(partBlock).filter(b=>b.top>.06);
const arcadeBlocks=shell.map(b=>({x:b.x,z:b.z,w:b.w,d:b.d,bottom:b.y-b.h/2,top:b.y+b.h/2})).filter(b=>b.top>.04);
export const localFacades={classroom:schoolBlocks,clinic:clinicBlocks,pool:lidoBlocks,arcadeHall:arcadeBlocks};
function translate(blocks:readonly CityBlock[],origin:{x:number;z:number}){
  return blocks.map(b=>({...b,x:b.x+origin.x,z:b.z+origin.z}));
}
export const cityFacadeBlocks=[...translate(schoolBlocks,s),...translate(clinicBlocks,c),...translate(localFacades.pool,p),...translate(arcadeBlocks,a)];

export const cityBlocks=[...cityGreenBlocks,...cityStreetFurnitureBlocks,
  ...[{x:20.13,z:44.48},{x:30.65,z:42.30}].map(pole=>({...pole,w:.21,d:.17,bottom:0,top:5.77})),
];
