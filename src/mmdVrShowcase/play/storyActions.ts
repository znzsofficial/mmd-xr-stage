import type { Vector3 } from 'three';
import { aimEncore, dyeEncore, resetEncore } from './encore/EncoreStation';
import { aimFerry, launchFerry, resetFerry } from './ferry/FerryStation';
import { getKiteWind, setKiteWind, resetKite } from './kite/KiteStation';
import { STORIES, type Hand, type StoryRoom, type Toy } from './stagePlay';
import type { SceneryId } from '../scenery/catalog';

/** Explicit menu cues also work with the prop on a character's wrist. */
export function cueStory(room:StoryRoom,side:Hand,origin?:Vector3) {
  if(room==='lawn')setKiteWind(side);
  else if(room==='pool')launchFerry(side,origin);
  else dyeEncore(side);
}

/** Called only at the leading edge of an armed side grip. A missed target
 * still lets the regular bubble blower blow bubbles. */
export function squeezeStory(room:SceneryId,toy:Toy,at:Vector3,dir:Vector3) {
  if(room==='lawn'&&toy===STORIES.lawn.toy)cueStory(room,getKiteWind()==='left'?'right':'left');
  if(room==='pool'&&toy===STORIES.pool.toy){const side=aimFerry(at,dir);if(side)cueStory(room,side,at);}
  if(room==='liveHouse'&&toy===STORIES.liveHouse.toy){const side=aimEncore(at,dir);if(side)cueStory(room,side);}
}

export {resetEncore,resetFerry,resetKite};
