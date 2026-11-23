import {reedCentre} from './reedBiosphere';
import {tideCentre,tideDeck,tideFloor,tideRadius} from './tideLayout';

type Point=[number,number,number];
const pole=tideCentre.y+tideRadius;
const standing=(x:number,z:number,h:number):Point=>[tideCentre.x+x,pole+tideFloor(x,z)+h,tideCentre.z+z];
// A level horizon for upright actors and a horizontal reflecting pool.
const up:Point=[0,1,0],eye=standing(5.64,-1.26,1.15);
const reed=reedCentre.clone().sub({x:eye[0],y:reedCentre.y,z:eye[2]}).normalize();
export const tideShots=[
  // Stand clear of the return sign: see the pool, dial, steps and arch together.
  {key:'tideShellSteps',eye:standing(-1.70,1.50,1.65),aim:[tideCentre.x+4.10,pole+1.50,tideCentre.z-.38],up,fov:68},
  {key:'tideStage',eye:standing(1.53,.54,1.52),aim:[tideDeck.x,tideDeck.y+.95,tideDeck.z],up,fov:48},
  // At standing height Reedwater and its image subtend ~55° vertically.
  // Aim down 2° and keep the orbit pivot nearby so the eye stays on the bank.
  {key:'tideMoonrise',eye,aim:[eye[0]+8*reed.x,eye[1]-8*Math.tan(Math.PI/90),eye[2]+8*reed.z],up,fov:58},
] as const;
