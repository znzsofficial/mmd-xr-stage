// The sternum is x=0, +x is the subject's left and +z is anterior. All lengths
// are relative to the half-width of the rib cage, independent of the PMX.
export type Ink = CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;
export type V = [number,number,number];
export type P = [number,number];
export type Side = -1|1;
export const TAU=2*Math.PI;
export const unit=(x:number)=>Number.isFinite(x)?Math.max(0,Math.min(1,x)):0;
export function camera(degrees:number){const a=degrees*Math.PI/180;return {c:Math.cos(a),s:Math.sin(a)};}
export type Camera=ReturnType<typeof camera>;
export function line(ctx:Ink,pts:P[]){ctx.beginPath();ctx.moveTo(...pts[0]);for(let i=1;i<pts.length;i++)ctx.lineTo(...pts[i]);}
export function ellipse(ctx:Ink,x:number,y:number,rx:number,ry:number,turn:number){ctx.beginPath();ctx.ellipse(x,y,rx,ry,turn,0,TAU);}

// Tissue-plate coordinates; the renderer maps this band between the actual
// upper and lower edges of the cut on the rounded, state-dependent mesh.
export function cutBounds(s:number):P{
  const u=.88*(1-s),h=Math.sqrt(Math.max(0,1-s*s-u*u)),cy=-.30*s-.17*Math.sin(Math.PI*s);
  return [cy+h,cy-h];
}
