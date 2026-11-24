import type {newStick} from './controllerInput';
import type {WalkMoon} from '../scenery/planet/windAtlas';

/** Counters since this planet visit, no tracking coordinates or device IDs. */
export function planetCounters(){return {backend:'pending' as 'pending'|'failed'|'rapier',frames:0,poseFrames:0,inputHeldFrames:0,
  location:'home' as 'home'|WalkMoon['id']|'wind'|'twinLeap'|'orbit'|'free',gravityOwner:'home' as 'home'|WalkMoon['id']|null,
  orbitalJumps:0,wellChanges:0,orbitalLandings:0,grazes:0,grounded:true,groundedWalkM:0,alignments:0,
  left:'none' as ReturnType<typeof newStick>['via'],right:'none' as ReturnType<typeof newStick>['via'],walkInputFrames:0,turnInputFrames:0,snapTurns:0,footTravelM:0,windDepartures:0,windLandings:0,twinDepartures:0,twinLandings:0};}
type Counters=ReturnType<typeof planetCounters>;
let active:Counters|null=null;
export function observePlanet(c:Counters){active=c;return()=>{if(active===c)active=null;};}
export function samplePlanetMovement(){return active?{...active,footTravelM:Math.round(active.footTravelM*100)/100,groundedWalkM:Math.round(active.groundedWalkM*100)/100}:undefined;}
