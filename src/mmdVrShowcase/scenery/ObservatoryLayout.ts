/** All connected tops meet the existing MMD foot plane. Bridges overlap the
 * landings slightly so a foot can cross the joint even on the circular rim. */
export const OLD_COURT_RADIUS=6.8;
export const TERRACES=[
  {id:'north',x:0,z:-39,r:7.2},
  {id:'west',x:-23,z:-20,r:5.8},
  {id:'east',x:23,z:-20,r:5.8},
] as const;
export const BRIDGES=[
  {x:0,z:-19.5,w:3.8,d:29},
  {x:0,z:-20,w:37,d:3.6},
] as const;
type Foot={x:number;z:number;w:number;d:number};
export const DOME_FEET=Array.from({length:9},(_,i)=>{const a=Math.PI+i*Math.PI/8;return {x:5.72*Math.cos(a),z:-39+5.72*Math.sin(a),w:.66,d:.66};});
export const ARCHIVE_FEET=[-25.9,-23.2,-20.5].flatMap(x=>[-23.2,-16.8].map(z=>({x,z,w:.60,d:.60})));
export const DIAL_FOOT={x:24.55,z:-20.9,w:2.1,d:1.6};
export const CHART_CASES=[-21.65,-20,-18.35].map(z=>({x:-26.6,z,w:.59,d:1.48}));
export const ROUTE_FEET:Foot[]=[...DOME_FEET,...ARCHIVE_FEET,...CHART_CASES,DIAL_FOOT];

// Rails occupy the extreme 28 cm of each bridge; the junction stays open.
export function onObservatoryFloor(x:number,z:number){
  if(Math.hypot(x,z)<=OLD_COURT_RADIUS-.01)return true;
  if(TERRACES.some(p=>Math.hypot(x-p.x,z-p.z)<p.r-.12))return true;
  return BRIDGES.some(b=>Math.abs(x-b.x)<=b.w/2-(b.d>b.w?.29:0)&&Math.abs(z-b.z)<=b.d/2-(b.w>b.d?.29:0));
}

type Shot={key:'courtOverview'|'courtNorth'|'courtWest'|'courtEast'|'courtReturn';eye:[number,number,number];aim:[number,number,number]};
export const COURT_SHOTS:Shot[]=[
  {key:'courtOverview',eye:[1.1,28,-14.2],aim:[0,0,-20]},
  {key:'courtNorth',eye:[2.7,1.62,-32.9],aim:[-.4,2.0,-40]},
  {key:'courtWest',eye:[-17.9,1.62,-18.3],aim:[-24.4,1.55,-20.4]},
  {key:'courtEast',eye:[18.6,1.65,-17.55],aim:[24.4,1.8,-21]},
  {key:'courtReturn',eye:[.8,1.6,-30.1],aim:[0,1.6,-3.4]},
];
