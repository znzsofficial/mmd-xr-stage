// All dimensions in metres. Model and emitter share a centreline and the
// same transform from the manufactured part to the player's grip space.
export const siliconeTilt=-.38;
export const siliconeMount:[number,number,number]=[0,.01,-.035];
export const tipHeight=.119;
export function centerZ(y:number){const t=Math.max(0,y/tipHeight);return -.019*t*t;}
const c=Math.cos(siliconeTilt),s=Math.sin(siliconeTilt),z=centerZ(tipHeight);
const slope=-.038/tipHeight,n=Math.hypot(1,slope);
export const siliconeOutlet={
  position:[0,siliconeMount[1]+c*tipHeight-s*z,siliconeMount[2]+s*tipHeight+c*z],
  direction:[0,(c-s*slope)/n,(s+c*slope)/n],
} as const;
