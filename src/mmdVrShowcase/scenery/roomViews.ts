import type { TranslationKey } from '../../languageStore';
import type { SceneryId } from './catalog';
import { COURT_SHOTS } from './ObservatoryLayout';
import { CHAPEL_SHOTS } from './ChapelLayout';
import { CLINIC_SHOTS,CLINIC_VIEW } from './clinic/clinicLayout';
import {roomLinks,type RoomLink} from './connections';
import {LIDO_ROUTE_SHOTS} from './LidoLayout';

type Point=readonly [number,number,number];
type Shot={key:TranslationKey;eye:Point;aim:Point;link?:RoomLink;preloadLawn?:boolean;overview?:boolean};
type RoomView={entry:readonly [Point,Point];shots?:readonly Shot[]};
export const roomViews:Record<SceneryId,RoomView>={
  floor:{entry:[[1.4,1.65,4],[0,.95,-.4]]}, liveHouse:{entry:[[.8,1.7,4.4],[0,1.05,-1.3]]},
  pool:{entry:[[2.1,1.7,2.8],[0,.85,-3.7]],shots:[LIDO_ROUTE_SHOTS.clock,LIDO_ROUTE_SHOTS.return]},
  classroom:{entry:[[.15,1.58,3.95],[0,1.05,-1.4]],shots:[
    {key:'campusWindow',eye:[.6,1.58,-.35],aim:[-17.9,1.26,.4]},
    {key:'campusHall',eye:[-3.31,1.61,7.31],aim:[-12.5,1.23,7.12],preloadLawn:true}]},
  lawn:{entry:[[.6,1.65,3.7],[0,1,-1.4]],shots:[
    {key:'campusSchool',eye:[-.9,1.62,2.4],aim:[10.8,1.53,-3.6]},
    {key:'campusArbor',eye:[-.73,1.58,.6],aim:[-4.2,1.40,-6.4]},LIDO_ROUTE_SHOTS.gate]},
  astralCourt:{entry:[[.85,1.65,4.4],[0,1.47,-1.25]],shots:COURT_SHOTS.map(s=>({...s,overview:s.key==='courtOverview'}))},
  chapel:{entry:[[.25,1.63,4.7],[0,1.68,-3.8]],shots:CHAPEL_SHOTS}, clinic:{entry:CLINIC_VIEW,shots:CLINIC_SHOTS},
};
const tours=new Map<SceneryId,readonly Shot[]>();
export function tourShots(room:SceneryId):readonly Shot[]{
  let list=tours.get(room);if(!list){list=[...(roomViews[room].shots??[]),...roomLinks.filter(l=>l.from===room).map(link=>({...link.arrival,link}))];tours.set(room,list);}
  return list;
}
