import {Vector3} from 'three';
import {moonRadius,moonSegments} from './moonSurface';
import {crustRadius,crustSegments} from './opalTerrain';
import {facetSampler} from './shellFacets';
import {tideDatum,tideFloor} from './tideLayout';
import {windFloor,type WindTerminal} from './windTerminalLayout';

type Height=(x:number,z:number)=>number;
const homeFacets=facetSampler(...crustSegments,crustRadius),beds=new WeakMap<WindTerminal,Height>();
/** Intersect the local mounting axis with the rendered triangles, using the
 * same Float32 vertices and cell diagonal as the mesh. The grotto has its
 * own planar triangulation. No interpolated height-map between the bolts. */
export function windCollarBed(site:WindTerminal){
  const saved=beds.get(site);if(saved)return saved;
  const {back,lane:{moon},port,rotation}=site,v=new Vector3();let sample:Height;
  if(back&&moon.id==='tide')sample=(x,z)=>{
    v.set(x,0,z).applyQuaternion(rotation);return tideDatum-port.foot.y+tideFloor(v.x,v.z);
  };else{
    const [cols,rows]=moonSegments(moon),facet=back?facetSampler(cols,rows,(x,y,z)=>moonRadius(moon,x,y,z)):homeFacets;
    sample=(x,z)=>{
      v.set(x,0,z).applyQuaternion(rotation).add(port.foot);
      return windFloor(site.lane,back,v,facet);
    };
  }
  beds.set(site,sample);return sample;
}
