import {exteriorBrush} from './foldLight';
import {restingCut,type CutBasis,type FoldStyle,type RimState} from '../vulvaForm';
import {sameEntranceCut,sameEntranceLoad,unloadedWall,type EntranceLoad} from './entranceWall';

export const exteriorBox={left:5,right:167,top:37,bottom:215} as const;
const origin={x:87,y:139},unit=33;
export function exteriorLens(yaw:number,radius:number){
  const co=Math.cos(yaw),si=Math.sin(yaw),scale=unit/radius;
  return (x:number,y:number,z:number)=>({x:origin.x+scale*(co*x+si*z),y:origin.y-scale*y});
}
type Tile={canvas:HTMLCanvasElement|OffscreenCanvas;paint:ReturnType<typeof exteriorBrush>;density:number;yaw:number;cut:CutBasis;load:EntranceLoad;style?:FoldStyle;rim?:RimState};
const tiles=new WeakMap<CanvasRenderingContext2D,Tile>();
export function drawVulva(ctx:CanvasRenderingContext2D,yaw:number,cut=restingCut,style:FoldStyle='natural',rim:RimState='off',displayLimit=Infinity,load=unloadedWall){
  // Includes the logical observation window's framing AND the destination
  // backing pixels. Keep enough subpixels in the smallest tile for a turned
  // crest; cap the largest at 648 × 712 (one depth/colour pair per surface).
  const m=ctx.getTransform(),scale=Math.min(displayLimit,Math.max(Math.hypot(m.a,m.b),Math.hypot(m.c,m.d)));
  const {left,right,top,bottom}=exteriorBox,s=Math.max(2,Math.min(4,Math.ceil(scale*2-1e-6)/2)),w=(right-left)*s,h=(bottom-top)*s;
  let t=tiles.get(ctx);if(!t||t.density!==s){
    const canvas=t?.canvas??(typeof OffscreenCanvas==='undefined'?document.createElement('canvas'):new OffscreenCanvas(w,h));
    canvas.width=w;canvas.height=h;
    const c=canvas.getContext('2d') as CanvasRenderingContext2D;
    t={canvas,paint:exteriorBrush(c,w,h,(origin.x-left)*s,(origin.y-top)*s,unit*s),density:s,yaw:NaN,cut:{...restingCut},load:{...unloadedWall}};tiles.set(ctx,t);
  }
  if(yaw!==t.yaw||style!==t.style||rim!==t.rim||!sameEntranceCut(cut,t.cut)||!sameEntranceLoad(load,t.load)){
    t.paint(yaw,cut,style,rim,load);Object.assign(t.cut,cut);Object.assign(t.load,load);t.yaw=yaw;t.style=style;t.rim=rim;
  }
  ctx.drawImage(t.canvas,left,top,right-left,bottom-top);
}
