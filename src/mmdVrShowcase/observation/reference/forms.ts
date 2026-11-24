import {TAU,type V} from '../../bodyState/breast/art/geometry';
import {grid,VERTEX_STRIDE,type Mesh} from '../../bodyState/breast/art/mesh';

// Only illustration-space coordinates. No model, simulation or actor inputs.
export type Layer=readonly [Mesh,number];
export type Mark={at:V;zh:string;en:string};
export type Study={layers:Layer[];marks:Mark[]};
export const blend=(a:V,b:V,t:number):V=>[a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t,a[2]+(b[2]-a[2])*t];
/** Open sheet. grid's default seam normal is for a periodic ring; estimate
 * the two open-edge normals from one-sided tangents instead. */
export function sheet(rows:number,cols:number,vertex:(u:number,t:number)=>V,paint:(u:number,t:number)=>V,flip=1):Layer{
  const m=grid(rows,cols,vertex,paint),v=m.data;
  for(let row=0;row<rows;row++)for(const col of [0,cols-1]){
    const at=(j:number,i:number)=>(j*cols+i)*VERTEX_STRIDE,k=at(row,col),diff=(a:number,b:number):V=>[v[b]-v[a],v[b+1]-v[a+1],v[b+2]-v[a+2]];
    v.set(unit(cross(diff(at(row,Math.max(0,col-1)),at(row,Math.min(cols-1,col+1))),
      diff(at(Math.max(0,row-1),col),at(Math.min(rows-1,row+1),col)))),k+3);
  }
  return [m,flip];
}
export function oval(center:V,r:V,color:V,form:(p:V)=>V=p=>p):Layer{
  return [grid(21,33,(u,t)=>{const a=u*TAU,b=(t-.5)*Math.PI,h=Math.cos(b);
    const p=form([r[0]*Math.sin(a)*h,r[1]*Math.sin(b),r[2]*Math.cos(a)*h]);
    return [center[0]+p[0],center[1]+p[1],center[2]+p[2]];},()=>color),1];
}
type Knot=readonly [number,number,number,number]; // centre and local radius
const cross=(a:V,b:V):V=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
const unit=(v:V):V=>{const n=Math.hypot(...v)||1;return [v[0]/n,v[1]/n,v[2]/n];};
export function strand(knots:Knot[],pigment:V,flatten=1):Layer{
  const rows=knots.length*4,cols=13;
  function sample(t:number):Knot{
    const x=Math.min(1,Math.max(0,t))*(knots.length-1),i=Math.min(knots.length-2,Math.floor(x)),u=x-i;
    const a=knots[Math.max(0,i-1)],b=knots[i],c=knots[i+1],d=knots[Math.min(i+2,knots.length-1)];
    const at=(k:number)=>b[k]+.5*u*(c[k]-a[k]+u*(2*a[k]-5*b[k]+4*c[k]-d[k]+u*(3*(b[k]-c[k])+d[k]-a[k])));
    return [at(0),at(1),at(2),Math.max(.0005,at(3))];
  }
  let old:V=[0,0,1];
  const rings=Array.from({length:rows},(_,i)=>{const t=i/(rows-1),p=sample(t),a=sample(t-.001),b=sample(t+.001);
    const tangent=unit([b[0]-a[0],b[1]-a[1],b[2]-a[2]]),axis=cross(tangent,old);
    const h=unit(Math.hypot(...axis)<.001?cross(tangent,[0,1,0]):axis),v=unit(cross(h,tangent));old=v;
    return {p,h,v};});
  return [grid(rows,cols,(u,t)=>{const {p,h,v}=rings[Math.round(t*(rows-1))],a=u*TAU,
    coord=(k:number)=>p[k]+p[3]*(h[k]*Math.sin(a)+v[k]*Math.cos(a)*flatten);return [coord(0),coord(1),coord(2)];},()=>pigment),1];
}
