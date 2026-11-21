export const PLANET_RADIUS=12;
export const PAD_RADIUS=2.8;
export const planetPlace=(x:number,z:number)=>Math.hypot(x,z)<PAD_RADIUS-.22;
