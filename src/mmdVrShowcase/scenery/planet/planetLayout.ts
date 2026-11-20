export const PLANET_RADIUS=12;
export const PAD_RADIUS=2.8;
export const planetPlace=(x:number,z:number)=>Math.hypot(x,z)<PAD_RADIUS-.22;
// The flat landing stage is tangent to the north pole. A ray from the
// underside must never reach it through the sphere.
export const planetSight=(p:{y:number})=>p.y>.005;
