// Plan in wedding-court metres. +Z is the open river; a tributary runs
// under the bridge. The two coordinate systems differ only by translation.
export const qinOffset={x:40,z:-2.8};
export const laneZ=10.45, laneEnd=-5.8, quayEnd=-32.5, gateX=-23.2;
export const bridge={west:-21.5,crownWest:-19,crownEast:-15,east:-12.5,half:1.74,y:.42};
export const quayOpening={min:5.70,max:9.60}; // the opening in the original east rail, in songhouse metres
export const gateHalf=1.72,gatePost=.28;
export const bridgeY=(x:number)=>bridge.y*Math.max(0,Math.min(1,(x-bridge.west)/(bridge.crownWest-bridge.west),(bridge.east-x)/(bridge.east-bridge.crownEast)));
export type StreetRect={x:number;z:number;w:number;d:number};
export const bounds=(l:number,r:number,n:number,s:number):StreetRect=>({x:(l+r)/2,w:r-l,z:(n+s)/2,d:s-n});
export const alley=bounds(bridge.east,laneEnd,8.4,12.5);
export const span=bounds(bridge.west,bridge.east,laneZ-bridge.half,laneZ+bridge.half);
export const quay=bounds(quayEnd,bridge.west,quayOpening.min-qinOffset.z,quayOpening.max-qinOffset.z);
export const apron=bounds(-31.6,-25.1,6.45,8.50);
export const floorPieces=[alley,span,quay,apron];
const box=(x:number,z:number,w:number,d:number,bottom:number,top:number)=>({x,z,w,d,bottom,top});
export type StreetBox=ReturnType<typeof box>;
export const gatePosts=[-.61,.61].flatMap(u=>[-1,1].map(v=>box(gateX+u,laneZ+v*gateHalf,gatePost,gatePost,0,2.86)));
export const gateHead=box(gateX,laneZ,1.56,3.89,2.61,3.02);
export const gateCheeks=[-1,1].map(v=>box(gateX,laneZ+v*1.86,1.42,.26,0,2.68));
// East end of the old songhouse quay, reused as the far silhouette. The
// lifted architrave names the destination and frames the left turn to the hall.
export const landingX=quayEnd-.05;
export const landingPosts=[-1,1].map(s=>box(landingX,laneZ+s*2.04,.25,.25,0,2.86));
export const landingHead=box(landingX,laneZ,.78,4.38,2.33,3.11);
export const shopFront=box(-28.35,5.19,6.35,2.52,-.62,3.18);
export const teaCounter=box(-26.08,7.02,1.57,.62,0,.91);
export const malletBench=box(-10.90,8.60,1.64,.54,0,.62);
export const vatPosts=[-11.95,-8.1].map(x=>box(x,8.53,.15,.15,0,2.68));
export const jars=[-30,-29.45].map((x,i)=>box(x,6.82,.48,.48,0,.69+i*.13));
export const lamps=[box(-30.85,12.17,.20,.20,0,2.49),box(-11.68,12.20,.20,.20,0,2.32)];
export const storefrontSolids=[shopFront,teaCounter,malletBench,...vatPosts,...jars,...lamps];
export const shadeCloths=[-11.50,-10.58,-9.62,-8.72].map((x,i)=>box(x,8.61,.73,.12,1.35+(i%2)*.21,2.48));
export const railSpans=[
  {a:quayEnd,b:-24.02,z:12.30}, {a:-24.02,b:bridge.west,z:12.30},
  ...[-1,1].flatMap(k=>[bridge.west,bridge.crownWest,bridge.crownEast].map((a,i)=>({a,b:[bridge.crownWest,bridge.crownEast,bridge.east][i],z:laneZ+k*(bridge.half-.09)}))),
  {a:bridge.east,b:-10.55,z:12.4},
];
export const railPosts=railSpans.flatMap(({a,b,z},i)=>{
  const n=Math.ceil((b-a)/1.62);
  return Array.from({length:n+1},(_,j)=>{const x=a+(b-a)*j/n,y=bridgeY(x);return box(x,z,.19,.19,y,y+.89);})
    .filter((p,j)=>j!==0||!railSpans.slice(0,i).some(r=>r.b===p.x&&r.z===z));
});
export const eastWaterEdge=bridge.east;
export const bridgeMark={x:-17,y:bridge.y,z:10.90},quayMark={x:-28.40,y:0,z:10.90};
