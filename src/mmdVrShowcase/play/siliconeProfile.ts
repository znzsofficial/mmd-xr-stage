// All dimensions in metres. Model and emitter share a centreline and the
// same transform from the manufactured part to the player's grip space.
export const siliconeTilt=-.38;
export const siliconeMount:[number,number,number]=[0,.01,-.035];
export const tipHeight=.119;
export function centerZ(y:number){const t=Math.max(0,y/tipHeight);return -.019*t*t;}
// An inner ellipsoid of the moulded crown, above the sloped collar. Follow
// the centreline tangent in part space (siliconeTilt is the outer grip pose).
const crownY=.1;
export const siliconeCrown={
  center:[0,crownY,centerZ(crownY)],radii:[.018,.0189,.019],pitch:Math.atan(-.038*crownY/tipHeight**2),
} as const;

// Never move the actual bore, outlet lip or grip. The neighbouring crown
// can compress even on an end-on touch while the spray stays at its nozzle.
export function crownFlex(x:number,y:number,z:number){
  const collar=Math.min(1,Math.max(0,(y-.085)/.009));
  const lip=y>.111?Math.min(1,Math.max(0,(Math.hypot(x,z-centerZ(y))-.005)/.005)):1;
  return collar*lip;
}
const c=Math.cos(siliconeTilt),s=Math.sin(siliconeTilt),z=centerZ(tipHeight);
const slope=-.038/tipHeight,n=Math.hypot(1,slope);
export const siliconeOutlet={
  position:[0,siliconeMount[1]+c*tipHeight-s*z,siliconeMount[2]+s*tipHeight+c*z],
  direction:[0,(c-s*slope)/n,(s+c*slope)/n],
} as const;
