// A six-post canopy projects over a real standing bay in front of the mattress.
// Both curtain banks travel on that bay's lintel, not on the room entrance.
export const BED={x:13.65,z:-8.52,w:2.96,d:1.72};
export const CUP_TABLE={x:16.48,z:-4.26,w:.80,d:1.66};
export const TRUNK={x:10.81,z:-8.97,w:1.26,d:.62};
export const FRONT=2.14, POST=1.46;
export const layers=['silk','gauze'] as const;
export type Layer=typeof layers[number];
export type Draw=Record<Layer,number>; // 0 = gathered, 1 = closed
export const curtainTrack=(k:Layer)=>BED.z+FRONT-(k==='gauze'?.21:.055);
const half=1.42, pile=.23;
export const sheetWidth=(t:number)=>pile+(half+.003-pile)*t;
export const selvage=(side:number)=>BED.x+side*half;
export const sheetBottom=.065,sheetTop=2.17,sheetDepth=.074;
export function eachSheet(draw:Readonly<Draw>,hit:(x:number,z:number,width:number)=>boolean){
  for(const k of layers){const w=sheetWidth(draw[k]),z=curtainTrack(k);
    for(const s of [-1,1])if(hit(selvage(s)-s*w/2,z,w))return true;
  }return false;
}

// The ground picker and locomotion query outside React. Publish only this
// mounted room's metres of fabric, never a mesh, actor, or saved preference.
const gathered:Readonly<Draw>={silk:0,gauze:0};
export const fullSweep:Readonly<Draw>={silk:1,gauze:1};
let mounted:Draw|undefined;
export const readDrapes=():Readonly<Draw>=>mounted??gathered;
export function bindDrapes(draw:Draw){mounted=draw;return ()=>{if(mounted===draw)mounted=undefined;};}
