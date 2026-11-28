import {crossesBlock,laneMouth,type ParkBlock} from '../terminus/parkLayout';
import type {PickDeck,RouteExtension,RoutePoint} from '../routes/types';
import {arcadeVestibule,cityBlocks,cityDecks,cityFacadeBlocks,localFacades,type CityBlock} from './site';

const joinZ=laneMouth.z+laneMouth.d/2;
const shoe=.22;
function contains(r:{x:number;z:number;w:number;d:number},x:number,z:number,pad=0){
  return Math.abs(r.x-x)<=r.w/2+pad+.00001&&Math.abs(r.z-z)<=r.d/2+pad+.00001;
}

// Only test obstacles beside the particular pavement being walked. The rest
// of the school desks, poolside piers, etc. matter to long sightlines only.
const solids:readonly CityBlock[]=[...cityBlocks,...cityFacadeBlocks];
const crossings=cityDecks.map(deck=>({deck,blocks:solids.filter(b=>b.top>.025&&b.bottom<1.75&&
  Math.abs(deck.x-b.x)<=(deck.w+b.w)/2+shoe&&Math.abs(deck.z-b.z)<=(deck.d+b.d)/2+shoe)}));
// At the arcade court edge only the far toe reaches into the borrowed
// court. Do not turn the rest of its interior into a city placement deck.
const courtLip={...arcadeVestibule,z:arcadeVestibule.z-arcadeVestibule.d/2-shoe/2,d:shoe};
const allDecks:readonly PickDeck[]=[laneMouth,courtLip,...cityDecks];
const clearFoot=(x:number,z:number,margin:number)=>crossings.some(({deck,blocks})=>
  contains(deck,x,z)&&!blocks.some(b=>contains(b,x,z,margin)));
const hasPaving=(x:number,z:number)=>allDecks.some(deck=>contains(deck,x,z));

// The oblique parcel depot is already part of the station architecture. Its
// wall does not reach the street's foot surface, but can still hide a mark
// viewed diagonally between the school and the cut-through.
const angle=-2.80;
const depot:ParkBlock={x:28.6-2.16*Math.sin(angle),z:46-2.16*Math.cos(angle),w:9.4,d:4.32,bottom:0,top:3.4,yaw:angle};
const districtOccluders:readonly ParkBlock[]=[...solids,depot];
function unobstructed(blocks:readonly ParkBlock[],a:RoutePoint,x:number,y:number,z:number){
  const end={x,y:y+.018,z};
  const left=Math.min(a.x,x),right=Math.max(a.x,x),back=Math.min(a.z,z),front=Math.max(a.z,z);
  return !blocks.some(b=>{
    if(!b.yaw&&(left>b.x+b.w/2||right<b.x-b.w/2||back>b.z+b.d/2||front<b.z-b.d/2))return false;
    return crossesBlock(a,end,b);
  });
}

export const classroomDoorSight=(a:RoutePoint,x:number,y:number,z:number)=>unobstructed(localFacades.classroom,a,x,y,z);
export const poolGateSight=(a:RoutePoint,x:number,y:number,z:number)=>unobstructed(localFacades.pool,a,x,y,z);

export const cityExtension:RouteExtension={
  rooms:['seasideTerminus'],
  ground(_room,x,z){return z<joinZ?null:clearFoot(x,z,.15)?0:-Infinity;},
  decks:()=>cityDecks,
  resolve(_room,x,z,y=0){
    if(z<joinZ-.28)return undefined; // bridge the original park's .28 m placement inset
    const valid=z<joinZ?contains(laneMouth,x,z):clearFoot(x,z,shoe);
    return y===0&&valid&&hasPaving(x-shoe,z)&&hasPaving(x+shoe,z)&&hasPaving(x,z-shoe)&&hasPaving(x,z+shoe)?0:null;
  },
  visible(_room,a,x,y,z){return Math.max(a.z,z)<39||unobstructed(districtOccluders,a,x,y,z);},
};
