import {resolvePlacementHeight,roomPickDecks,visiblePick} from '../scenery/placementAreas';

/** A shortcut targets the closest stage, even when occluded. Never substitute
 * an unrelated, farther stage behind the player's back on a failed sightline. */
export function planetCenterDrop(eye:{x:number;y:number;z:number}){
  const sq=(p:typeof eye)=>(p.x-eye.x)**2+(p.y-eye.y)**2+(p.z-eye.z)**2;
  const nearest=roomPickDecks('glassPlanet').reduce((a,b)=>sq(a)<=sq(b)?a:b);
  const {x,y,z}=nearest,h=resolvePlacementHeight('glassPlanet',x,z,y);
  return h!==null&&visiblePick('glassPlanet',eye,x,h,z)?{x,y:h,z}:null;
}
