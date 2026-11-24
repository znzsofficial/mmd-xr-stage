import {Vector3} from 'three';
import {surveyReaderBlocks,surveyReaderBoxes} from '../scenery/planet/opalSurvey';
import {windTerminalBlocks,windTerminals,type WindTerminalWorld} from '../scenery/planet/windTerminalLayout';
import {headMargin} from './eyeHeight';

// Rapier only owns the home world. Keep these in world coordinates: the
// printed panel and its back have a different tilt from the supporting foot.
export const homeFixtureBoxes=[...windTerminals.filter(t=>!t.back).flatMap(t=>t.boxes),...surveyReaderBoxes];

function blocks(world:WindTerminalWorld,p:Vector3,r:number,h:number,up:Vector3){
  return windTerminalBlocks(p,r,h,world,up)||world==='home'&&surveyReaderBlocks(p,r,h,up);
}
const sole=new Vector3();
/** Evaluate a virtual move using this frame's actual tracking, not a camera
 * position saved before the visitor leaned. Tracked offsets run from motor
 * sole to eye, in world axes. The motor itself still occupies its own feet. */
export function fixtureBodyBlocked(world:WindTerminalWorld,foot:Vector3,up:Vector3,eye:Vector3,r:number,height=eye.dot(up)){
  sole.copy(foot).add(eye).addScaledVector(up,-height);
  return blocks(world,sole,r,Math.max(.24,height+headMargin),up)||
    sole.distanceToSquared(foot)>1e-6&&blocks(world,foot,r,.24,up);
}
