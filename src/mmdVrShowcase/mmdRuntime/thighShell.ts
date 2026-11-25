import type {Vector3} from 'three';

// Two orthographic depth intervals, in units of hip-to-knee length. Each ray
// needs BOTH walls of the displayed skin. A sparse accessory or an open edge
// cannot supply a solid by itself. Never extrapolate a fitted capsule at the hip.
const N=39, T=47, U=.51, TOP=-.23, END=1.05;
const dx=2*U/(N-1),dy=(END-TOP)/(T-1);
const makeView=()=>({lo:new Float32Array(N*T).fill(Infinity),hi:new Float32Array(N*T).fill(-Infinity),valid:new Uint8Array(N*T)});
type View=ReturnType<typeof makeView>;
export class ThighShell {
  private views=[makeView(),makeView()];
  private ready=false;
  add(a:Vector3,b:Vector3,c:Vector3){
    this.ready=false;
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
    // The posed leg surface stays fixed until reseeding; thousands of cloth
    // samples can land in the same cells. Classify both walls once per fit.
    if(!this.ready){for(const {lo,hi,valid} of this.views){for(let j=0;j<T-1;j++)for(let i=0;i<N-1;i++){
      const k=j*N+i;valid[k]=+(hi[k]-lo[k]>.024&&hi[k+1]-lo[k+1]>.024&&hi[k+N]-lo[k+N]>.024&&hi[k+N+1]-lo[k+N+1]>.024);
    }}this.ready=true;}
    const y=(p.y-TOP)/dy,j=Math.floor(y),fy=y-j;let best=Infinity,found=false;
    for(let v=0;v<2;v++){
      const x=((v?p.x:p.z)+U)/dx,i=Math.floor(x),fx=x-i,d=v?p.z:p.x,k=j*N+i;
      const view:View=this.views[v];
      if(!view.valid[k])continue;
      for(let sign=-1;sign<=1;sign+=2){
        const buf=sign>0?view.hi:view.lo;
        const a=buf[k],b=buf[k+1],c=buf[k+N],e=buf[k+N+1];
        const low=a+(b-a)*fx,high=c+(e-c)*fx,h=low+(high-low)*fy;
        const du=((b-a)*(1-fy)+(e-c)*fy)/dx,dt=(high-low)/dy;
        // The depth axis component has magnitude one before normalization.
        // Only write a vector for the winning wall, not every rejected wall.
        const nx=v?-du:1,ny=-dt,nz=v?1:-du,facing=1/Math.sqrt(nx*nx+ny*ny+nz*nz);
        const depth=(h-d)*sign*facing;
        if(depth<-.068)return -Infinity;
        if(facing<.44)continue;
        if(depth<best){best=depth;out.set(nx*sign*facing,ny*sign*facing,nz*sign*facing);found=true;}
      }
    }
    return found?best:-Infinity;
  }
}
