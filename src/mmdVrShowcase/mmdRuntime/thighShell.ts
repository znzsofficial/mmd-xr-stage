import {Vector3} from 'three';

// Two orthographic depth intervals, in units of hip-to-knee length. Each ray
// needs BOTH walls of the displayed skin. A sparse accessory or an open edge
// cannot supply a solid by itself. Never extrapolate a fitted capsule at the hip.
const N=39, T=47, U=.51, TOP=-.23, END=1.05;
const dx=2*U/(N-1),dy=(END-TOP)/(T-1);
const makeView=()=>({lo:new Float32Array(N*T).fill(Infinity),hi:new Float32Array(N*T).fill(-Infinity)});
type View=ReturnType<typeof makeView>;
export class ThighShell {
  private views=[makeView(),makeView()];
  private normal=new Vector3();
  add(a:Vector3,b:Vector3,c:Vector3){
    for(let v=0;v<2;++v){
      const au=v?a.x:a.z,bu=v?b.x:b.z,cu=v?c.x:c.z;
      const ad=v?a.z:a.x,bd=v?b.z:b.x,cd=v?c.z:c.x;
      const u1=bu-au,u2=cu-au,y1=b.y-a.y,y2=c.y-a.y,det=u1*y2-u2*y1;
      if(Math.abs(det)<1e-9)continue;
      const x0=Math.max(0,Math.ceil((Math.min(au,bu,cu)+U)/dx)),x1=Math.min(N-1,Math.floor((Math.max(au,bu,cu)+U)/dx));
      const y0=Math.max(0,Math.ceil((Math.min(a.y,b.y,c.y)-TOP)/dy)),yMax=Math.min(T-1,Math.floor((Math.max(a.y,b.y,c.y)-TOP)/dy));
      const {lo,hi}=this.views[v];
      for(let y=y0;y<=yMax;++y)for(let x=x0;x<=x1;++x){
        const u=x*dx-U-au,t=y*dy+TOP-a.y,s=(u*y2-u2*t)/det,f=(u1*t-u*y1)/det;
        if(s< -1e-7||f< -1e-7||s+f>1+1e-7)continue;
        const k=y*N+x,d=ad+s*(bd-ad)+f*(cd-ad);lo[k]=Math.min(lo[k],d);hi[k]=Math.max(hi[k],d);
      }
    }
  }
  // Positive distance is inside. A bystander outside either reliable view
  // vetoes the projection. Choose a locally front-facing exit (not a
  // near-tangent depth gradient across the silhouette).
  clearance(p:Vector3,out:Vector3){
    if(p.y<=TOP||p.y>=END||Math.abs(p.x)>=U||Math.abs(p.z)>=U)return -Infinity;
    const y=(p.y-TOP)/dy,j=Math.floor(y),fy=y-j;let best=Infinity,found=false;
    for(let v=0;v<2;v++){
      const x=((v?p.x:p.z)+U)/dx,i=Math.floor(x),fx=x-i,d=v?p.z:p.x,k=j*N+i;
      const view:View=this.views[v];
      for(let sign=-1;sign<=1;sign+=2){
        const buf=sign>0?view.hi:view.lo;
        // Ignore single-sided or sub-grid slivers rather than sealing the hip opening.
        if(!(view.hi[k]-view.lo[k]>.024 && view.hi[k+1]-view.lo[k+1]>.024 &&
          view.hi[k+N]-view.lo[k+N]>.024 && view.hi[k+N+1]-view.lo[k+N+1]>.024))continue;
        const a=buf[k],b=buf[k+1],c=buf[k+N],e=buf[k+N+1];
        const low=a+(b-a)*fx,high=c+(e-c)*fx,h=low+(high-low)*fy;
        const du=((b-a)*(1-fy)+(e-c)*fy)/dx,dt=(high-low)/dy;
        const n=this.normal.set(v?-du:1,-dt,v?1:-du).multiplyScalar(sign).normalize();
        const facing=Math.abs(v?n.z:n.x),depth=(h-d)*sign*facing;
        if(depth<-.068)return -Infinity;
        if(facing<.44)continue;
        if(depth<best){best=depth;out.copy(n);found=true;}
      }
    }
    return found?best:-Infinity;
  }
}
