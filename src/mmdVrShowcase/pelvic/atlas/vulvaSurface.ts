import {paintFoldLight,studyCut} from './foldLight';
import {slitHalfLength,type CutBasis} from '../vulvaForm';

// Second lens on the same socket: +Z is out, the calibrated rim lies in XY.
// Reference dissection: expose one calibrated radius for the opening label.
// This plate is a study, never evidence of live contact. Its two tissue sheets
// are the same surface that opens on the stage.
export const exteriorBox={left:5,right:167,top:39,bottom:215} as const;
const origin={x:87,y:139},unit=33;
export function exteriorLens(yaw:number,radius:number){
  const co=Math.cos(yaw),si=Math.sin(yaw),scale=unit/radius;
  return (x:number,y:number,z:number)=>({x:origin.x+scale*(co*x+si*z),y:origin.y-scale*y});
}
function study(c:CanvasRenderingContext2D,yaw:number,cut:CutBasis){
  const co=Math.cos(yaw),si=Math.sin(yaw),face=Math.max(.001,Math.abs(co));
  // The aperture is still the unit rim. Shade the receding walls and their
  // overlapping mucosal folds inside it; no outline or concentric rings.
  c.save();c.translate(origin.x,origin.y);c.scale(unit*face,unit);c.transform(cut.xx,-cut.xy,-cut.yx,cut.yy+slitHalfLength,cut.x,-cut.y);c.beginPath();c.arc(0,0,1.014,0,2*Math.PI);c.clip();
  c.fillStyle='#ce8592';c.fillRect(-1.02,-1.02,2.04,2.04);
  // A receding median channel, softer rear wall and two curved cushions.
  // Elliptic washes overlap INSIDE the planar rim instead of tracing it.
  const shift=-.31*si/Math.max(face,.30);
  function wash(x:number,y:number,rx:number,ry:number,turn:number,color:string,opacity:number){
    c.save();c.translate(x,y);c.rotate(turn);c.scale(rx,ry);const g=c.createRadialGradient(0,0,0,0,0,1);
    g.addColorStop(0,`rgba(${color},${opacity})`);g.addColorStop(.48,`rgba(${color},${.83*opacity})`);g.addColorStop(1,`rgba(${color},0)`);
    c.fillStyle=g;c.fillRect(-1,-1,2,2);c.restore();
  }
  wash(shift,.03,1.12,1.31,-.16,'118,54,78',.85);
  wash(shift-.05,.03,.32,.81,.14,'101,47,70',.66);
  for(const side of [-1,1]){
    wash(side*.66+shift,.10*side,.36,.92,-side*.27,'243,172,179',.65);
    wash(side*.37+shift,.37*side,.22,.54,side*.44,'223,146,161',.47);
  }c.restore();
  paintFoldLight(c,yaw,origin.x,origin.y,unit,cut);
}
type Tile={canvas:HTMLCanvasElement|OffscreenCanvas;ctx:CanvasRenderingContext2D;yaw:number;cut?:CutBasis};
const tiles=new WeakMap<CanvasRenderingContext2D,Tile>();
export function drawVulva(ctx:CanvasRenderingContext2D,yaw:number,cut=studyCut){
  const {left,right,top,bottom}=exteriorBox,s=2,w=(right-left)*s,h=(bottom-top)*s;
  // Rasterise the many little gradients into ONE software-backed tile, not
  // hundreds of GPU paint commands. Only a turn invalidates the cached blit.
  let t=tiles.get(ctx);if(!t){const canvas=typeof OffscreenCanvas==='undefined'?document.createElement('canvas'):new OffscreenCanvas(w,h);t={canvas,ctx:canvas.getContext('2d',{willReadFrequently:true}) as CanvasRenderingContext2D,yaw:NaN};tiles.set(ctx,t);}
  if(t.canvas.width!==w||t.canvas.height!==h||t.yaw!==yaw||t.cut!==cut){
    if(t.canvas.width!==w)t.canvas.width=w;if(t.canvas.height!==h)t.canvas.height=h;
    t.ctx.setTransform(s,0,0,s,-left*s,-top*s);t.ctx.clearRect(left,top,right-left,bottom-top);study(t.ctx,yaw,cut);t.yaw=yaw;t.cut=cut;
  }
  ctx.drawImage(t.canvas,left,top,right-left,bottom-top);
}
