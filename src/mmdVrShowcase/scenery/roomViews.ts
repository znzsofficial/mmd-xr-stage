import type { TranslationKey } from '../../languageStore';
import type { SceneryId } from './catalog';
import { COURT_SHOTS } from './ObservatoryLayout';
import { CHAPEL_SHOTS } from './ChapelLayout';
import { CLINIC_SHOTS,CLINIC_VIEW } from './clinic/clinicLayout';
import {CLINIC_ORIGIN} from './clinic/clinicApproach';
import {roomLinks,type RoomLink} from './connections';
import {LIDO_ROUTE_SHOTS} from './LidoLayout';
import {SCREEN_ENTRY,SHOTS} from './qinhuai/songhouseLayout';
import {WEDDING_SHOTS,WEDDING_VIEW} from './wedding/weddingLayout';

type Point=readonly [number,number,number];
type Shot={key:TranslationKey;eye:Point;aim:Point;link?:RoomLink;preloadLawn?:boolean;overview?:boolean};
type RoomView={entry:readonly [Point,Point];shots?:readonly Shot[]};
export const roomViews:Record<SceneryId,RoomView>={
  floor:{entry:[[1.4,1.65,4],[0,.95,-.4]]}, liveHouse:{entry:[[.8,1.7,4.4],[0,1.05,-1.3]]},
  pool:{entry:[[2.1,1.7,2.8],[0,.85,-3.7]],shots:[LIDO_ROUTE_SHOTS.clock,LIDO_ROUTE_SHOTS.return]},
  classroom:{entry:[[.15,1.58,3.95],[0,1.05,-1.4]],shots:[
    {key:'campusWindow',eye:[.6,1.58,-.35],aim:[-17.9,1.26,.4]},
    {key:'campusHall',eye:[-3.31,1.61,7.31],aim:[-12.5,1.23,7.12],preloadLawn:true},
    {key:'classWindowDesk',eye:[-1.30,1.14,3.35],aim:[-2.61,.61,2.65]},
    {key:'classWindowPortrait',eye:[-2.72,1.60,-1.91],aim:[.43,.98,-4.08]}]},
  lawn:{entry:[[.6,1.65,3.7],[0,1,-1.4]],shots:[
    {key:'campusSchool',eye:[-.9,1.62,2.4],aim:[10.8,1.53,-3.6]},
    {key:'campusArbor',eye:[-.73,1.58,.6],aim:[-4.2,1.40,-6.4]},LIDO_ROUTE_SHOTS.gate,
    {key:'clinicGardenPorch',eye:[CLINIC_ORIGIN.x+4.15,1.6,CLINIC_ORIGIN.z+11.25],aim:[CLINIC_ORIGIN.x,1.35,CLINIC_ORIGIN.z+7.0]}]},
  astralCourt:{entry:[[.85,1.65,4.4],[0,1.47,-1.25]],shots:COURT_SHOTS.map(s=>({...s,overview:s.key==='courtOverview'}))},
  chapel:{entry:[[.25,1.63,4.7],[0,1.68,-3.8]],shots:CHAPEL_SHOTS}, clinic:{entry:CLINIC_VIEW,shots:[...CLINIC_SHOTS,
    {key:'clinicDesk',eye:[-4.90,1.53,2.12],aim:[-6.42,.96,3.74]},
    {key:'clinicDeskSide',eye:[-5.00,1.41,4.24],aim:[-6.43,.95,3.65]}]},
  qinhuai:{entry:SCREEN_ENTRY,shots:[...SHOTS,
    {key:'qinLacquer',eye:[3.48,2.05,-5.70],aim:[4.03,1.41,-6.70]},
    {key:'qinMooring',eye:[4.38,.91,13.03],aim:[3.65,.19,11.99]}]},
  weddingCourt:{entry:WEDDING_VIEW,shots:[...WEDDING_SHOTS,
    {key:'weddingGateFinish',eye:[1.38,3.16,8.56],aim:[-.55,2.94,5.92]}]},
};
const tours=new Map<SceneryId,readonly Shot[]>();
export function tourShots(room:SceneryId):readonly Shot[]{
  let list=tours.get(room);if(!list){list=[...(roomViews[room].shots??[]),...roomLinks.filter(l=>l.from===room).map(link=>({...link.arrival,link}))];tours.set(room,list);}
  return list;
}
