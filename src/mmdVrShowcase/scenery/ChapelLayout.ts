// The limestone floor is the only supported y=0 plane. Leave two clear side
// passages as well as the processional aisle; the altar stands on shallow steps.
export const CHAPEL = { width:11.6, length:18, shoulder:4.95, crown:8.55, bay:3 };
export const CHAPEL_BAYS = Array.from({length:6},(_,i)=>-7.5+3*i);
export const CHAPEL_PIERS = [-1,1].flatMap(side=>Array.from({length:7},(_,i)=>({x:side*5.55,z:-9+i*3,w:.58,d:.66})));
export const CHAPEL_PEWS = [-2.4,-.85,.70,2.25,3.8,5.35].flatMap(z=>[-1,1].map(side=>({x:side*2.85,z,w:2.65,d:.78})));
export const CHAPEL_DAIS = {x:0,z:-7.30,w:7.8,d:3.4};
export const CHAPEL_SUN: [number,number,number] = [-5.8,4.7,2.8];
export const CHAPEL_OBSTACLES = [CHAPEL_DAIS,...CHAPEL_PEWS,...CHAPEL_PIERS];
