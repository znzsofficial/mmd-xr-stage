import {Vector3} from 'three';
import {homeShellRadius,planetCentre} from './homeSurface';
import {transport,type Traveller} from './planetTravel';
import type {ReadColumn} from './groundMotor';
import {STEP} from './solidColumns';

/** Ecctrl supplies the collision-resolved horizontal stride. Its spring is a
 * body suspension, not the player's sole, ground detector or airborne motor.
 * Measure actual relief and imported floors even during suspension warm-up. */
export function homeStride(){
  const direction=new Vector3(),previous=new Vector3();
  return (s:Traveller,candidate:Vector3,moving:boolean,dt:number,read:ReadColumn)=>{
    previous.copy(s.foot);direction.subVectors(moving?candidate:previous,planetCentre);
    const r=direction.length();direction.divideScalar(r);
    let floor=homeShellRadius(direction.x,direction.y,direction.z);
    if(direction.y>.8){
      const c=s.col;c.floor=planetCentre.y+direction.y*floor;c.ceiling=Infinity;c.blocked=false;
      read(moving?candidate.x:previous.x,moving?candidate.z:previous.z,previous.y,c);
      // A tracked lean into a wall cannot cancel existing ground or lift the player.
      if(c.blocked){s.velocity.set(0,0,0);return;}
      floor=Math.max(floor,(c.floor-planetCentre.y)/direction.y);
    }
    const previousR=previous.distanceTo(planetCentre);
    if(floor>previousR+STEP){s.velocity.set(0,0,0);return;}
    s.grounded=previousR-floor<=STEP;
    s.foot.copy(planetCentre).addScaledVector(direction,s.grounded?floor:previousR);transport(s);
    if(dt>0)s.velocity.subVectors(s.foot,previous).divideScalar(dt).projectOnPlane(s.up);else s.velocity.set(0,0,0);
  };
}
