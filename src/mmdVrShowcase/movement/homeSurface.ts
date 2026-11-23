import {Vector3} from 'three';
import {PAD_RADIUS,PLANET_RADIUS as R} from '../scenery/planet/planetLayout';
import {crustRadius,crustSegments} from '../scenery/planet/opalTerrain';
import {facetSampler} from '../scenery/planet/shellFacets';

export const planetCentre=new Vector3(0,-R,0);
const face=facetSampler(...crustSegments,crustRadius);
/** The rendered crust triangles and the top of the flat landing cylinder. */
export function homeShellRadius(x:number,y:number,z:number){
  const pad=y>0?R/y:Infinity;
  return Math.max(face(x,y,z),y>0&&(x*x+z*z)*pad*pad<=PAD_RADIUS**2?pad:0);
}
