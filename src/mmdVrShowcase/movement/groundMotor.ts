import {STEP,type Column} from './solidColumns';
import {ROOM_GRAVITY} from './gravityReference';

export type Body={x:number;y:number;z:number;vy:number;grounded:boolean};
export type ReadColumn=(x:number,z:number,foot:number,out:Column)=>void;
export const groundedBody=(x:number,y:number,z:number):Body=>({x,y,z,vy:0,grounded:true});
const usable=(c:Column,y:number,h:number)=>Number.isFinite(c.floor)&&!c.blocked&&c.floor<=y+STEP+.002&&Math.max(c.floor,y)+h<=c.ceiling+.001;
const LAUNCH=3.65;

/** Collision is evaluated in spatial as well as time substeps. Even a sprint at
 * low FPS cannot skip a door jamb. Foot Y and gravity never enter preferences. */
export function createGroundMotor(){
  const c:Column={floor:0,ceiling:Infinity,blocked:false};
  function fits(sample:ReadColumn,x:number,z:number,y:number,h:number){sample(x,z,y,c);return usable(c,y,h);}
  function move(b:Body,sample:ReadColumn,dx:number,dz:number,h:number){
    if(!dx&&!dz)return;
    if(fits(sample,b.x+dx,b.z+dz,b.y,h)){b.x+=dx;b.z+=dz;}
    else if(dx&&fits(sample,b.x+dx,b.z,b.y,h))b.x+=dx;
    else if(dz&&fits(sample,b.x,b.z+dz,b.y,h))b.z+=dz;
  }
  return {fits,
    advance(b:Body,sample:ReadColumn,dx:number,dz:number,elapsed:number,h:number,jump:boolean){
      if(![dx,dz,elapsed,h].every(Number.isFinite)||elapsed<=0)return;
      const dt=Math.min(.1,elapsed); // discard tracking gaps, never catch up in one leap
      if(jump&&b.grounded){b.vy=LAUNCH;b.grounded=false;}
      const n=Math.max(1,Math.ceil(dt*90),Math.ceil(Math.hypot(dx,dz)/.075)),t=dt/n;
      for(let i=0;i<n;i++){
        move(b,sample,dx/n,dz/n,h);sample(b.x,b.z,b.y,c);
        if(!Number.isFinite(c.floor)||c.blocked)break;
        const next=b.y+b.vy*t-.5*ROOM_GRAVITY*t*t;b.vy-=ROOM_GRAVITY*t;
        if(next<=c.floor&&b.vy<=0){b.y=c.floor;b.vy=0;b.grounded=true;}
        else if(next+h>=c.ceiling&&b.vy>0){b.y=Math.max(c.floor,c.ceiling-h);b.vy=0;b.grounded=false;}
        else {b.y=Math.max(c.floor,next);b.grounded=false;}
      }
    },
    // Validate a physical step from the last known foot separately. Don't drive
    // the user's tracked head backwards when it enters a solid.
    track(b:Body,sample:ReadColumn,x:number,z:number,h:number){
      const dx=x-b.x,dz=z-b.z,d=Math.hypot(dx,dz);if(!Number.isFinite(d)||d>3)return false;
      const steps=Math.max(1,Math.ceil(d/.075));let y=b.y;
      for(let i=1;i<=steps;i++){
        if(!fits(sample,b.x+dx*i/steps,b.z+dz*i/steps,y,h))return false;
        if(b.grounded&&c.floor>y)y=c.floor;
      }
      b.x=x;b.z=z;b.y=y;return true;
    },
  };
}
