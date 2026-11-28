import type { TranslationKey } from '../../languageStore';
import type { SceneryId } from './catalog';
import { COURT_SHOTS } from './ObservatoryLayout';
import { CHAPEL_SHOTS } from './ChapelLayout';
import { CLINIC_SHOTS,CLINIC_VIEW } from './clinic/clinicLayout';
import {roomLinks,type RoomLink} from './connections';
import {LIDO_ROUTE_SHOTS} from './LidoLayout';
import {SCREEN_ENTRY,SHOTS} from './qinhuai/songhouseLayout';
import {WEDDING_SHOTS,WEDDING_VIEW} from './wedding/weddingLayout';
import {RETREAT_VIEWS} from './retreat/retreatLayout';
import {velvetView} from './velvet/velvetLayout';
import {chamberView} from './chamber/chamberLayout';
import {arcadeView} from './arcade/arcadeViews';
import {transitPortrait,southPortrait} from './planet/opalTerrain';
import {launchViews,returnViews} from './planet/windAtlas';
import {amberPortrait,steppingViews,straitPortrait,twinSurveys} from './planet/twinSurvey';
import {reedShots} from './planet/reedBiosphere';
import {lanternShots} from './planet/lanternShots';
import {opalSurveyShots} from './planet/opalSurvey';
import {shoreView} from './terminus/shoreLayout';

type Point=readonly [number,number,number];
type Shot={key:TranslationKey;eye:Point;aim:Point;up?:Point;fov?:number;link?:RoomLink;overview?:boolean};
type RoomView={entry:readonly [Point,Point];shots?:readonly Shot[]};
// Frame the departure collars, still within their chart-selection reach.
const departureChart={key:'opalDepartureChart',eye:[.55,8.85,4.5],aim:[.16,-.12,.55],fov:63} as const;
export const roomViews:Record<SceneryId,RoomView>={
  seasideTerminus:shoreView,
  ...RETREAT_VIEWS,
  arcadeHall:arcadeView,
  velvetStudio:velvetView,medievalChamber:chamberView,
  glassPlanet:{entry:[[0,2.18,3.45],[.12,.63,-3.85]],shots:[{key:'planetLimb',eye:[10.6,2.1,11.7],aim:[-.7,-2.2,-2.6]},{key:'planetRing',eye:[-.2,1.62,1.85],aim:[-3.6,3.02,-9.4]},
    {key:'planetTransit',...transitPortrait},{key:'planetSouth',...southPortrait},...launchViews,...returnViews,
    {key:'planetPulsar',eye:[.55,1.65,1.88],aim:[4.50,2.73,-12.78]},
    straitPortrait,...twinSurveys.flatMap(s=>[s.portrait,s.leapView]),...reedShots,...opalSurveyShots,...steppingViews,...lanternShots,amberPortrait,departureChart]},
  floor:{entry:[[1.4,1.65,4],[0,.95,-.4]]}, liveHouse:{entry:[[.8,1.7,4.4],[0,1.05,-1.3]]},
  pool:{entry:[[2.1,1.7,2.8],[0,.85,-3.7]],shots:[LIDO_ROUTE_SHOTS.clock,LIDO_ROUTE_SHOTS.return]},
  classroom:{entry:[[.15,1.58,3.95],[0,1.05,-1.4]],shots:[
    {key:'campusWindow',eye:[.6,1.58,-.35],aim:[-13.17,1.46,6.90]},
    {key:'campusHall',eye:[-4.02,1.61,4.52],aim:[-4.58,1.35,9.40]},
    {key:'classWindowDesk',eye:[-1.30,1.14,3.35],aim:[-2.61,.61,2.65]},
    {key:'classWindowPortrait',eye:[-2.72,1.60,-1.91],aim:[.43,.98,-4.08]}]},
  astralCourt:{entry:[[0,1.65,5.65],[0,1.42,-3.6]],shots:COURT_SHOTS.map(s=>({...s,overview:s.key==='courtOverview'}))},
  chapel:{entry:[[.25,1.63,4.7],[0,1.68,-3.8]],shots:CHAPEL_SHOTS}, clinic:{entry:CLINIC_VIEW,shots:[...CLINIC_SHOTS,
    {key:'clinicEastExit',eye:[4.18,1.58,2.74],aim:[10.77,1.28,2.83]},
    {key:'clinicDesk',eye:[-4.90,1.53,2.12],aim:[-6.42,.96,3.74]},
    {key:'clinicDeskSide',eye:[-5.00,1.41,4.24],aim:[-6.43,.95,3.65]}]},
  qinhuai:{entry:SCREEN_ENTRY,shots:[...SHOTS,
    {key:'qinLacquer',eye:[3.48,2.05,-5.70],aim:[4.03,1.41,-6.70]},
    {key:'qinMooring',eye:[4.38,.91,13.03],aim:[3.65,.19,11.99]}]},
  weddingCourt:{entry:WEDDING_VIEW,shots:[...WEDDING_SHOTS,
    {key:'weddingGateFinish',eye:[1.38,3.16,8.56],aim:[-.55,2.94,5.92]}]},
};
const tours=new Map<SceneryId,readonly Shot[]>();
// Local standing views on the way; unlike a link's arrival camera these never change rooms.
const streetViews:Partial<Record<SceneryId,readonly Shot[]>>={
  seasideTerminus:[
    {key:'cityClinicFront',eye:[17.8,1.65,53.86],aim:[8.6,1.46,53.8]},
    {key:'citySchoolFront',eye:[40.54,1.65,58.8],aim:[39.97,1.54,53.6]},
    {key:'cityPoolFront',eye:[-24.9,1.65,80.6],aim:[-24.25,1.55,71.35]},
    {key:'cityArcadeFront',eye:[28.6,1.65,87.4],aim:[29.1,2.40,76]},
  ],
  arcadeHall:[{key:'arcadePoolOverlook',eye:[-7.84,3.70,-24.15],aim:[-24,1.30,-24.15]}],
  pool:[{key:'poolArcadeWalk',eye:[6.2,1.65,-19.25],aim:[15,1.02,-19.25]}],
  weddingCourt:[{key:'weddingBridgeView',eye:[-17,2.07,10.45],aim:[-23.4,1.14,10.45]}],
  qinhuai:[{key:'qinhuaiLanternQuay',eye:[10.6,1.65,7.65],aim:[18.1,.98,7.65]}],
};
export function tourShots(room:SceneryId):readonly Shot[]{
  let list=tours.get(room);if(!list){list=[...(roomViews[room].shots??[]),...roomLinks.filter(l=>l.from===room).map(link=>({...link.arrival,link})),...(streetViews[room]??[])];tours.set(room,list);}
  return list;
}

// Keep camera indices stable, but make travel actions distinct from viewpoints
// in the long planetary picker. Labels come from each site's existing record.
const planetViews=tourShots('glassPlanet');
const planetSections=[['tourSurvey',[departureChart,...opalSurveyShots]],['tourDepart',launchViews],['tourReturn',returnViews],
  ['tourStrait',[straitPortrait,...twinSurveys.map(v=>v.leapView),...steppingViews]]] as const;
const assigned=new Set<string>(planetSections.flatMap(([,shots])=>shots.map(s=>s.key)));
export const planetTourGroups=[...planetSections,['tourPortrait',planetViews.filter(v=>!assigned.has(v.key))] as const]
  .map(([label,shots])=>({label,items:shots.map(s=>({key:s.key,index:planetViews.findIndex(p=>p.key===s.key)}))}));
