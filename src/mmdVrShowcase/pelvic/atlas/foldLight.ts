import {createSealShell} from '../vulvaMesh';
import type {CutBasis,FoldStyle,RimState} from '../vulvaForm';
import {foldFinish} from '../vulvaFinish';
import {entranceBrush,unloadedWall} from './entranceWall';

const clamp=(v:number)=>Math.max(0,Math.min(1,v));
const srgb=(v:number)=>255*(v<.0031308?12.92*v:1.055*v**(1/2.4)-.055);

const hx=-.327,hy=.196,hz=.924,stride=10;
// Linear lookup avoids angular steps and exp in the CPU fragment loop.
const reflection=Float32Array.from({length:769},(_,i)=>Math.exp(-i/64));
function reflectionAt(distanceSq:number){
  if(distanceSq>=12)return 0;
  const t=distanceSq*64,i=Math.floor(t);
  return reflection[i]+(reflection[i+1]-reflection[i])*(t-i);
}
/** One depth-tested pass on the actual stage triangles. The broad matte fill
 * is smooth vertex colour. Only the short reflective arcs need fragment light. */
export function exteriorBrush(ctx:CanvasRenderingContext2D,w:number,h:number,ox:number,oy:number,unit:number){
  const shell=createSealShell(),g=shell.geom,idx=g.getIndex()!.array,pos=g.getAttribute('position'),norm=g.getAttribute('normal');
  const finish=foldFinish(),colors=g.getAttribute('color'),count=pos.count,ink=new Float32Array(count*3);
  const screen=new Float32Array(count*stride),depth=new Float32Array(w*h),image=ctx.createImageData(w,h),rgba=image.data;
  const lining=entranceBrush(w,h,ox,oy,unit);let inkRim:RimState|undefined;
  return (yaw:number,cut:CutBasis,style:FoldStyle,rim:RimState,load=unloadedWall)=>{
    shell.fitCut(cut,1,style,rim);depth.fill(-Infinity);rgba.fill(0);
    if(inkRim!==rim){for(let i=0;i<count;i++){ink[i*3]=srgb(colors.getX(i));ink[i*3+1]=srgb(colors.getY(i));ink[i*3+2]=srgb(colors.getZ(i));}inkRim=rim;}
    const co=Math.cos(yaw),si=Math.sin(yaw);
    lining(co,si,cut,load,depth,rgba);
    for(let i=0;i<count;i++){
      const k=stride*i,x=pos.getX(i),z=pos.getZ(i),m=finish[i],nx=norm.getX(i)+m.bx,ny=norm.getY(i)+m.by,nz=norm.getZ(i);
      screen[k]=ox+unit*(co*x+si*z);screen[k+1]=oy-unit*pos.getY(i);screen[k+2]=co*z-si*x;
      const inv=1/Math.sqrt(nx*nx+ny*ny+nz*nz||1),u=(co*nx+si*nz)*inv,v=ny*inv,f=(co*nz-si*nx)*inv;
      const light=.769+.233*clamp((-.57*u+.32*v+.755*f+.46)/1.46);
      const broad=m.broad*Math.max(0,u*hx+v*hy+f*hz)**7;
      const r=ink[3*i]*light,gr=ink[3*i+1]*light,bl=ink[3*i+2]*light;
      screen[k+3]=r+(255-r)*broad;screen[k+4]=gr+(245-gr)*broad;screen[k+5]=bl+(237-bl)*broad;
      screen[k+6]=u;screen[k+7]=v;screen[k+8]=f;screen[k+9]=m.wet;
    }
    for(let i=0;i<idx.length;i+=3){
      const p=stride*idx[i],q=stride*idx[i+1],s=stride*idx[i+2];
      const x=screen[p],y=screen[p+1],ux=screen[q]-x,uy=screen[q+1]-y,vx=screen[s]-x,vy=screen[s+1]-y,det=ux*vy-uy*vx;
      if(det>=-1e-7)continue;
      const x0=Math.max(0,Math.ceil(x+Math.min(0,ux,vx)-.5)),x1=Math.min(w-1,Math.floor(x+Math.max(0,ux,vx)-.5));
      const y0=Math.max(0,Math.ceil(y+Math.min(0,uy,vy)-.5)),y1=Math.min(h-1,Math.floor(y+Math.max(0,uy,vy)-.5));
      const reflective=Math.max(screen[p+9],screen[q+9],screen[s+9])>.006;
      // Filter the narrow axis by its footprint on this triangle. A small
      // glint can pass between two pixels on a slow turn; preserve its energy
      // rather than snapping it to a column or accumulating previous frames.
      let widthSq=.235**2,energy=1;
      if(reflective){
        const du=(screen[q+6]-screen[p+6])*hz-(screen[q+8]-screen[p+8])*hx;
        const dv=(screen[s+6]-screen[p+6])*hz-(screen[s+8]-screen[p+8])*hx;
        const gx=(du*vy-dv*uy)/det,gy=(dv*ux-du*vx)/det;
        widthSq+=Math.min(.16,(gx*gx+gy*gy)/6);energy=.235/Math.sqrt(widthSq);
      }
      for(let py=y0;py<=y1;py++)for(let px=x0;px<=x1;px++){
        const dx=px+.5-x,dy=py+.5-y,t=(dx*vy-dy*vx)/det,l=(ux*dy-uy*dx)/det,n=1-t-l;
        if(n<0||t<0||l<0)continue;
        const j=py*w+px,z=n*screen[p+2]+t*screen[q+2]+l*screen[s+2];if(z<depth[j])continue;
        depth[j]=z;const k=4*j;
        let wet=0;
        if(reflective){
          const u=n*screen[p+6]+t*screen[q+6]+l*screen[s+6],v=n*screen[p+7]+t*screen[q+7]+l*screen[s+7],f=n*screen[p+8]+t*screen[q+8]+l*screen[s+8];
          const inv=1/Math.sqrt(u*u+v*v+f*f||1),cosH=(hx*u+hy*v+hz*f)*inv;
          if(cosH>.5){const cross=(hz*u-hx*f)*inv,long=v*inv-hy,h=clamp((cosH-.5)/.36);
            wet=(n*screen[p+9]+t*screen[q+9]+l*screen[s+9])*energy*reflectionAt(cross*cross/widthSq+long*long/(.47*.47))*h*h*(3-2*h);}
        }
        const r=n*screen[p+3]+t*screen[q+3]+l*screen[s+3],gr=n*screen[p+4]+t*screen[q+4]+l*screen[s+4],bl=n*screen[p+5]+t*screen[q+5]+l*screen[s+5];
        rgba[k]=r+(255-r)*wet;rgba[k+1]=gr+(245-gr)*wet;rgba[k+2]=bl+(237-bl)*wet;rgba[k+3]=255;
      }
    }
    ctx.putImageData(image,0,0);
  };
}
