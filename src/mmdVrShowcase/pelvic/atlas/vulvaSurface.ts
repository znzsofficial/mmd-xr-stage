import {exteriorBrush} from './foldLight';
import {restingCut,type CutBasis,type FoldStyle,type RimState} from '../vulvaForm';

export const exteriorBox={left:5,right:167,top:37,bottom:215} as const;
const origin={x:87,y:139},unit=33;
export function exteriorLens(yaw:number,radius:number){
  const co=Math.cos(yaw),si=Math.sin(yaw),scale=unit/radius;
  return (x:number,y:number,z:number)=>({x:origin.x+scale*(co*x+si*z),y:origin.y-scale*y});
}
type Tile={canvas:HTMLCanvasElement|OffscreenCanvas;paint:ReturnType<typeof exteriorBrush>;yaw:number;cut?:CutBasis;style?:FoldStyle;rim?:RimState};
const tiles=new WeakMap<CanvasRenderingContext2D,Tile>();
export function drawVulva(ctx:CanvasRenderingContext2D,yaw:number,cut=restingCut,style:FoldStyle='natural',rim:RimState='off'){
  const {left,right,top,bottom}=exteriorBox,s=2,w=(right-left)*s,h=(bottom-top)*s;
  let t=tiles.get(ctx);if(!t){
    const canvas=typeof OffscreenCanvas==='undefined'?document.createElement('canvas'):new OffscreenCanvas(w,h);
    canvas.width=w;canvas.height=h;
    const c=canvas.getContext('2d') as CanvasRenderingContext2D;
    t={canvas,paint:exteriorBrush(c,w,h,(origin.x-left)*s,(origin.y-top)*s,unit*s),yaw:NaN};tiles.set(ctx,t);
  }
  const old=t.cut;
  if(yaw!==t.yaw||style!==t.style||rim!==t.rim||!old||Math.abs(cut.x-old.x)+Math.abs(cut.y-old.y)+Math.abs(cut.xx-old.xx)+Math.abs(cut.xy-old.xy)+Math.abs(cut.yx-old.yx)+Math.abs(cut.yy-old.yy)>1e-6){
    t.paint(yaw,cut,style,rim);t.cut=cut;t.yaw=yaw;t.style=style;t.rim=rim;
  }
  ctx.drawImage(t.canvas,left,top,right-left,bottom-top);
}
