export const PLANET_RADIUS=12;
export const PAD_RADIUS=2.8;
export const HOME_SURFACE_GRAVITY=2.5;
/** Field strength is calibrated at the reference surface. Foot and capsule
 * callers use the same radius; never run this field on MMD rigid bodies. */
export function homeGravity(footRadius:number){
  const ratio=PLANET_RADIUS/Math.max(PLANET_RADIUS,footRadius);
  return HOME_SURFACE_GRAVITY*ratio*ratio;
}
export const planetPlace=(x:number,z:number)=>Math.hypot(x,z)<PAD_RADIUS-.22;
