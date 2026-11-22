import type {Point} from '../sectionProjection';

// Second lens on the same socket: +Z is out, the calibrated rim lies in XY.
// Project the silhouette of each transverse elliptical section analytically.
// No CPU triangle raster, ImageData upload, or fallback worker on first open.
export const exteriorBox={left:5,right:167,top:39,bottom:215} as const;
const origin={x:87,y:142},unit=29;
export function exteriorLens(yaw:number,radius:number){
  const co=Math.cos(yaw),si=Math.sin(yaw),scale=unit/radius;
  return (x:number,y:number,z:number)=>({x:origin.x+scale*(co*x+si*z),y:origin.y-scale*y});
}
type Row=readonly [y:number,x:number,z:number,rx:number,rz:number];
type Fold={rows:Row[];inner:boolean;side:number};
function lofts(){
  const folds:Fold[]=[];
  for(const side of [-1,1])for(const inner of [false,true]){
    const rows:Row[]=[];
    for(let i=0;i<=32;i++){
      const t=i/32,q=Math.sin(Math.PI*t)**(inner?.74:.65);
      if(inner){const wave=.065*Math.sin(t*32+side*.8)+.024*Math.sin(t*54);
        rows.push([-1.66+4.32*t,side*q*(.86+.22*Math.sin(t*4.8+side*.14)+wave),.01+q*(.19+.04*Math.sin(t*28)),.30*q,.41*q]);}
      else rows.push([-2.23+5.63*t,side*q**1.8*(1.43+.20*Math.sin(t*4.2)),-.30+.14*q,.69*q,.63*q]);
    }
    folds.push({side,inner,rows});
  }
  const hood:Row[]=[];for(let i=0;i<=20;i++){const t=i/20,q=Math.sin(Math.PI*t)**.72;
    hood.push([1.88+.94*t,0,.16+.17*q,.45*q,.21*q]);}
  folds.push({side:0,inner:true,rows:hood});return folds;
}
let shared:Fold[]|undefined;
const half=(a:Point,b:Point):Point=>({x:(a.x+b.x)/2,y:(a.y+b.y)/2});
function through(p:Path2D,points:Point[]){
  p.moveTo(points[0].x,points[0].y);
  for(let i=1;i<points.length-1;i++){const end=half(points[i],points[i+1]);p.quadraticCurveTo(points[i].x,points[i].y,end.x,end.y);}
  p.lineTo(points.at(-1)!.x,points.at(-1)!.y);
}
function study(c:CanvasRenderingContext2D,yaw:number){
  const co=Math.cos(yaw),si=Math.sin(yaw),at=exteriorLens(yaw,1),face=Math.max(.008,Math.abs(co));
  const folds=shared??=lofts();
  function oval(x:number,y:number,z:number,rx:number,ry:number){const q=at(x,y,z),p=new Path2D();p.ellipse(q.x,q.y,rx*unit*face,ry*unit,0,0,2*Math.PI);return p;}
  // Vestibular floor, urethral meatus, internal mucosa. A drawing of the rim
  // remains centred at calibrated zero even when the oblique cut reveals the wall.
  c.fillStyle='#b37583';c.fill(oval(0,.27,-.19,1.56,1.95));
  c.fillStyle='#794657';c.fill(oval(0,1.33,-.11,.103,.135));
  const opening=oval(0,0,0,1,1),o=at(0,0,0);
  const wash=c.createRadialGradient(o.x-2*si,o.y+unit*.09,unit*.12,o.x,o.y,unit);
  wash.addColorStop(0,'#48283d');wash.addColorStop(.66,'#734253');wash.addColorStop(1,'#be7988');
  c.fillStyle=wash;c.fill(opening);c.lineWidth=1;c.strokeStyle='#d99999';c.stroke(opening);
  c.save();c.clip(opening);c.strokeStyle='#a26978';c.lineWidth=.68;
  for(let j=0;j<3;j++)for(const sign of [-1,1]){const r=.71-.14*j,p=new Path2D();
    for(let k=0;k<=10;k++){const a=-.75+.15*k,q=at(sign*r*Math.cos(a),r*Math.sin(a),-.11*(j+1));if(!k)p.moveTo(q.x,q.y);else p.lineTo(q.x,q.y);}c.stroke(p);}
  c.restore();
  // Away-side lip, vestibule, and near-side lip exchange depth order on a turn.
  const rank=(f:Fold)=>-si*f.side*(f.inner?.90:1.53)+co*(f.side===0?.51:f.inner?.28:-.13);
  for(const f of [...folds].sort((a,b)=>rank(a)-rank(b))){
    const left:Point[]=[],right:Point[]=[],ridge:Point[]=[];
    for(const [y,x,z,rx,rz] of f.rows){const p=at(x,y,z),r=unit*Math.hypot(co*rx,si*rz);
      left.push({x:p.x-r,y:p.y});right.push({x:p.x+r,y:p.y});ridge.push(at(x-.24*rx,y,z+.82*rz));}
    const shape=new Path2D();through(shape,[...left,...right.reverse()]);shape.closePath();
    const mid=Math.floor(left.length/2),x1=left[mid].x,x2=right[mid].x,pigment=c.createLinearGradient(x1,0,Math.max(x1+.01,x2),0);
    const colors=f.inner?['#864f65','#d19298','#efb1a6','#ad697d','#824a60']:['#9c6878','#d59496','#e7b0a6','#ca8c91','#855b70'];
    for(const [i,k] of [0,.18,.42,.75,1].entries())pigment.addColorStop(k,colors[i]);
    c.fillStyle=pigment;c.fill(shape);c.strokeStyle=f.inner?'#a56e7b':'#ba8790';c.lineWidth=.55;c.stroke(shape);
    const p=new Path2D();through(p,ridge.slice(3,-3));c.strokeStyle=f.inner?'rgba(247,196,181,.53)':'rgba(251,214,188,.28)';c.lineWidth=f.inner?.85:.70;c.stroke(p);
  }
}
type Tile={canvas:HTMLCanvasElement;ctx:CanvasRenderingContext2D;yaw:number};
const tiles=new WeakMap<CanvasRenderingContext2D,Tile>();
export function drawVulva(ctx:CanvasRenderingContext2D,yaw:number){
  const {left,right,top,bottom}=exteriorBox,s=Math.min(2,Math.max(1,ctx.getTransform().a)),w=Math.round((right-left)*s),h=Math.round((bottom-top)*s);
  let t=tiles.get(ctx);if(!t){const canvas=document.createElement('canvas');t={canvas,ctx:canvas.getContext('2d')!,yaw:NaN};tiles.set(ctx,t);}
  if(t.canvas.width!==w||t.canvas.height!==h||t.yaw!==yaw){
    if(t.canvas.width!==w)t.canvas.width=w;if(t.canvas.height!==h)t.canvas.height=h;
    t.ctx.setTransform(s,0,0,s,-left*s,-top*s);t.ctx.clearRect(left,top,right-left,bottom-top);study(t.ctx,yaw);t.yaw=yaw;
  }
  ctx.drawImage(t.canvas,left,top,right-left,bottom-top);
}
