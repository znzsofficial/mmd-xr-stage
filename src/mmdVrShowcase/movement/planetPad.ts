import type {Object3D,Scene} from 'three';
import {useBackpack} from '../backpack';
import {actorBodies,sampleBodies} from './actorBodies';
import {createSolidColumns} from './solidColumns';
import type {ReadColumn} from './groundMotor';
import {PAD_RADIUS,PLANET_RADIUS} from '../scenery/planet/planetLayout';

/** User solids on the north landing; never index the decorative planet mesh. */
export function createPlanetPad(){
  const solids=createSolidColumns(),column={floor:0,ceiling:Infinity,blocked:false};
  let known:unknown=null,roots:Object3D[]=[],bodies:ReturnType<typeof actorBodies>=[];
  const read:ReadColumn=(x,z,y,c)=>{solids.sample(roots,x,z,y,c);sampleBodies(bodies,x,z,y,c);};
  return {read,dispose:()=>solids.invalidate(),
    update(scene:Scene){const {entries,live}=useBackpack.getState();if(live===known)return;
      known=live;roots=scene.children.filter(o=>o.userData.stagePropSolid);bodies=actorBodies(entries,live);solids.invalidate();},
    column(x:number,z:number,footY:number){const r2=x*x+z*z;
      column.floor=r2<=PAD_RADIUS*PAD_RADIUS?0:Math.sqrt(Math.max(0,PLANET_RADIUS**2-r2))-PLANET_RADIUS;
      column.ceiling=Infinity;column.blocked=false;read(x,z,footY,column);return column;}
  };
}
