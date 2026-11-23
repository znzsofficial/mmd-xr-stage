import {Vector3} from 'three';

export const lanternCentre=new Vector3(-30,18,12),lanternRadius=6.3;
const east=1.65,south=1.85,level=lanternRadius+.06;
export const clearingRadius=1.50;
export const clearingDeck={x:lanternCentre.x+east,y:lanternCentre.y+level,z:lanternCentre.z+south,w:2*clearingRadius,d:2*clearingRadius};
export const onClearing=(x:number,z:number)=>Math.hypot(x-clearingDeck.x,z-clearingDeck.z)<clearingRadius-.19;

/** Physical top, including the narrow rim outside the safe actor footprint. */
export function clearingSupport(nx:number,ny:number,nz:number){
  if(ny<.65)return 0;
  const r=level/ny;return (nx*r-east)**2+(nz*r-south)**2<=clearingRadius**2?r:0;
}

/** A level island of firm mycelium for upright actors. Intersect each radial
 * terrain sample with the horizontal stage, then fade back into the hillside.
 * The clearing is off-axis: longitude alone cannot locate its boundary. */
export function clearingRelief(x:number,y:number,z:number,ground:number){
  if(y<.65)return ground;
  const bed=level-.018,r=bed/y;
  // The north collar sits on the original shell. Measure its footprint there,
  // not on the raised deck plane; the actor berm must not bury the enamel rim.
  const north=Math.hypot(x,z)*(lanternRadius+ground);
  if(north<=.77)return ground;
  const d=Math.hypot(x*r-east,z*r-south);
  if(d>=clearingRadius+1.1)return ground;
  const k=Math.min(1,(clearingRadius+1.1-d)/1.1);
  const edge=Math.min(1,(north-.77)/(.97-.77));
  return ground+(Math.min(1.36,r-lanternRadius)-ground)*k*k*(3-2*k)*edge*edge*(3-2*edge);
}
