import {shopBuildingBlocks,tideOfficeParts,watchClockParts} from './streetPlots';

// City metres. The board's front looks along local +Z; directions on the
// reverse are written for a pedestrian approaching from that side.
export const cityFingerposts = [
  {x:23.78,z:52.20,yaw:Math.PI,front:['诊所  →','教室 · 泳池 · 电玩厅  ↑'],back:['海站 · 站前公园  ↑','诊所  ←']},
  {x:23.87,z:60.56,yaw:Math.PI,front:['←  教室','泳池 · 电玩厅  →'],back:['站前公园  ↑','诊所  ↑']},
  {x:-1.43,z:60.63,yaw:Math.PI/2,front:['←  泳池 · 电玩厅','体育街'],back:['教室  ↑','海站 · 诊所  ↑']},
  {x:3.56,z:89.24,yaw:Math.PI,front:['←  电玩厅','夏日泳池  →'],back:['海站 · 诊所  ↑','教室  ↑']},
  {x:-1.85,z:84.62,yaw:Math.PI/2,front:['海站 · 教室  →','夏日泳池  ↑'],back:['←  海站 · 教室','电玩厅  ↑']},
] as const;

export const guideBoard = {w:1.86,h:.65,d:.09,y:1.86};
export const mapCase = {x:19.22,z:60.94,w:2.38,h:1.34,y:1.42,d:.17};
export const cityLamps = [{x:22.96,z:47.2},{x:31.8,z:60.66},{x:3.55,z:72.8},
  {x:-12.7,z:89.27},{x:22.5,z:89.27},{x:-26.67,z:79.6}];
export const cityStreetTrees = [
  {x:28.3,z:61.85,variant:1,scale:.72},{x:-2.65,z:65.8,variant:0,scale:.80},
  {x:-2.45,z:78.7,variant:2,scale:.76},{x:-19.4,z:83.3,variant:1,scale:.84},
  {x:12.8,z:89.93,variant:0,scale:.77},{x:33.0,z:84.30,variant:2,scale:.69},
];

const post=(x:number,z:number,w:number,top:number)=>({x,z,w,d:w,bottom:0,top});
export const cityStreetFurnitureBlocks = [
  ...shopBuildingBlocks,
  ...[...tideOfficeParts,...watchClockParts].map(({p:[x,y,z],s:[w,h,d]})=>({x,z,w,d,bottom:y-h/2,top:y+h/2})),
  {...mapCase,bottom:mapCase.y-mapCase.h/2,top:mapCase.y+mapCase.h/2},
  ...[-.90,.90].map(dx=>post(mapCase.x+dx,mapCase.z,.13,mapCase.y)),
  ...cityFingerposts.flatMap(({x,z,yaw})=>[
    post(x,z,.19,guideBoard.y),
    {x,z,w:yaw===Math.PI?guideBoard.w:guideBoard.d,d:yaw===Math.PI?guideBoard.d:guideBoard.w,
      bottom:guideBoard.y-guideBoard.h/2,top:guideBoard.y+guideBoard.h/2},
  ]),
  ...cityLamps.flatMap(({x,z})=>[post(x,z,.21,3.18),{x:x+.16,z,w:.51,d:.23,bottom:3.14,top:3.31}]),
  ...cityStreetTrees.map(({x,z,scale})=>post(x,z,.35*scale,2.6*scale)),
];
