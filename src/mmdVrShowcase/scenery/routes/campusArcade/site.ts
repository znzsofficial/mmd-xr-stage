import { blocks, UPPER } from '../../arcade/arcadeLayout';
import {forecourtEdge,westStreetDoor} from '../../arcade/westGallery';
export {westStreetDoor} from '../../arcade/westGallery';
import { POOL_ORIGIN, TIME_DECK, POOL } from '../../LidoLayout';

// Shared survey for the arcade and swim club. Arcade west is +X.
export const ARCADE_ORIGIN = {x:39,z:-15.4};
export const shell=blocks.filter(s=>['court','balcony','east-balcony','west-walk','west-side','lounge-court','roof','west-sign','west-portal','west-spine','west-shelter-back','west-shelter-roof','west-end-wall','east-retaining','east-service','lounge-canopy','lounge-kiosk','tank-base'].includes(s.tag)||s.tag.startsWith('front-court')||s.tag==='wall'||s.tag==='header'||s.tag==='jamb'||s.tag==='lintel');
export const EAST = {x:ARCADE_ORIGIN.x-7.85,z:POOL_ORIGIN.z-19.25,half:1.25};
export type Surface = {id:string;l:number;r:number;b:number;f:number;y:number;sx:number;sz:number};
const a=ARCADE_ORIGIN, p=POOL_ORIGIN, e=EAST;
const surfaces:Surface[]=[];
function pad(id:string,l:number,r:number,b:number,f:number,y=0,sx=0,sz=0){
  surfaces.push({id,l,r,b,f,y,sx,sz});
}
// The city draws the west vestibule. Keep local support as far as the
// departure line, plus one step so the motor can actually cross that line.
export const westThreshold:Surface={id:'west-threshold',l:a.x+westStreetDoor.x-westStreetDoor.half,r:a.x+westStreetDoor.x+westStreetDoor.half,
  b:a.z+forecourtEdge,f:a.z+westStreetDoor.outGate+.4,y:0,sx:0,sz:0};
const highStart=a.z-6.4, turn=e.z+e.half;
const landingZ=2.05,mid=1.08,highX=e.x-e.half, midRight=a.x-20.9,midLeft=a.x-23.70,lowX=p.x+14.5;
export const timingBoards=[[a.x-22.3,mid,e.z-1.73],[e.x+1.67,landingZ,e.z-.36]] as const;
// Ramp sections meet broad, horizontal rest/placement landings. No slope
// gets a fictitious horizontal picking surface. Leave the lower court alone.
pad('gallery-neck',e.x-.85,e.x+.85,highStart,a.z-4.45,UPPER);
pad('north-flight',e.x-e.half,e.x+e.half,turn,highStart,landingZ,0,(UPPER-landingZ)/(highStart-turn));
pad('turntable',highX,e.x+1.93,e.z-e.half,turn,landingZ);
pad('clock-flight',midRight,highX,e.z-e.half,turn,mid,(landingZ-mid)/(highX-midRight));
pad('split-landing',midLeft,midRight,e.z-e.half-.84,turn,mid);
pad('pool-flight',lowX,midLeft,e.z-e.half,turn,0,mid/(midLeft-lowX));
const deckEnd=p.x+TIME_DECK.x+TIME_DECK.w/2,front=p.z+TIME_DECK.z+TIME_DECK.d/2;
pad('finish-apron',deckEnd,lowX,e.z-e.half,turn);
pad('finish-joint',p.x+POOL.walks[1].x+POOL.walks[1].w/2,deckEnd,front,turn);
// Tiny return against the far walk between the end of the side walk and
// the front edge of the existing timing deck.
pad('coping-joint',p.x+POOL.farWalk.w/2,p.x+POOL.walks[1].x+POOL.walks[1].w/2,front,p.z+POOL.walks[1].z-POOL.walks[1].d/2);
export const routeSurfaces:readonly Surface[]=surfaces;
export const heightAt=(s:Surface,x:number,z:number)=>s.y+s.sx*(x-s.l)+s.sz*(z-s.b);
export const inside=(s:Surface,x:number,z:number,m=0)=>x>=s.l-m&&x<=s.r+m&&z>=s.b-m&&z<=s.f+m;
export const isFlat=(s:Surface)=>!s.sx&&!s.sz;

// Keep the pool's tree belt clear of the elevated walk and hall exterior.
export function reserveArcadeSite(x:number,z:number,m=0){
  return surfaces.some(s=>inside(s,x,z,m+.40))||
    x>=a.x-15.4-m&&x<=a.x+14.3+m&&z>=a.z-6.3-m&&z<=westThreshold.b+m;
}
