// Surveyed garden landmarks. The active meadow, placement exclusions, and
// doorway views in the school and lido all use the same metre coordinates.
export const LAWN_SIZE=58;
export const meadowPathX=(z:number)=>-3.1+1.7*Math.sin(z*.22+.9)+.038*z;
export const ARBOR={x:meadowPathX(-6.4),z:-6.4};
export const ARBOR_POSTS=[-1,1].flatMap(side=>[-1,1].map(end=>({x:ARBOR.x+side*1.53,z:ARBOR.z+end*1.16,w:.37,d:.37})));
export const MEADOW_SEAT={x:4.1,z:-4.4,w:1.85,d:.68,yaw:-.55};
export const MEADOW_POSTS=Array.from({length:13},(_,i)=>({x:-8.4-i*.47,z:5-i*1.85,w:.14,d:.14}));
