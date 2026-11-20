import { BufferGeometry, Color, Float32BufferAttribute } from 'three';

export type V = [number, number, number];
type UV = [number, number];
export type Profile = [radius:number, height:number][];
export type Cell = keyof typeof cells;
// Pixel-centre bounds inside the extruded gutters of furnishingsBake.py.
const cells = {
  solid:[486,696,486,696], lotus:[9,9,502,502], calyx:[521,9,1014,502],
  paper:[1033,9,1526,502], blue:[9,521,502,662], wood:[9,681,456,854],
  bronze:[9,873,502,1014], lacquer:[521,521,1014,1014], fish:[1033,521,1526,1014], pairBird:[1032.5,520.5,1103.5,573.5],
} as const;
export const tau = 2*Math.PI;
const add=(a:V,b:V):V=>[a[0]+b[0],a[1]+b[1],a[2]+b[2]];
const sub=(a:V,b:V):V=>[a[0]-b[0],a[1]-b[1],a[2]-b[2]];
const dot=(a:V,b:V)=>a[0]*b[0]+a[1]*b[1]+a[2]*b[2];
const cross=(a:V,b:V):V=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
const unit=(a:V):V=>{const l=Math.hypot(...a)||1;return [a[0]/l,a[1]/l,a[2]/l];};
export const white='#ffffff';

/** Indexed, spatially local batches. Profile rings, pleats and bent rails share
 * vertices along their curvature; rims, corners and joinery keep hard normals. */
export class Surface {
  private positions:number[]=[]; private uvs:number[]=[]; private colors:number[]=[]; private index:number[]=[];
  private color=new Color();
  get empty(){return this.index.length===0;}
  private point(p:V,cell:Cell,[u,v]:UV){
    this.positions.push(...p);this.colors.push(this.color.r,this.color.g,this.color.b);
    const [l,t,r,b]=cells[cell];this.uvs.push((l+(r-l)*u)/1536,1-(b+(t-b)*v)/1024);
  }
  grid(n:number,m:number,at:(u:number,v:number)=>V,c=white,cell:Cell='solid',uv=(u:number,v:number):UV=>[u,v]){
    const start=this.positions.length/3;this.color.set(c);
    for(let j=0;j<=m;j++)for(let i=0;i<=n;i++)this.point(at(i/n,j/m),cell,uv(i/n,j/m));
    const stride=n+1;
    for(let j=0;j<m;j++)for(let i=0;i<n;i++){
      const a=start+j*stride+i,b=a+1,d=a+stride;this.index.push(a,b,d,b,d+1,d);
    }
  }
  quad(a:V,b:V,c:V,d:V,tint:string,cell:Cell='solid'){
    this.color.set(tint);const i=this.positions.length/3;
    this.point(a,cell,[0,0]);this.point(b,cell,[1,0]);this.point(c,cell,[1,1]);this.point(d,cell,[0,1]);
    this.index.push(i,i+1,i+2,i,i+2,i+3);
  }
  box([x,y,z]:V,w:number,h:number,d:number,c:string,cell:Cell='solid',yaw=0){
    const ca=Math.cos(yaw),sa=Math.sin(yaw);
    const p=(i:number,j:number,k:number):V=>[x+i*w*.5*ca+k*d*.5*sa,y+j*h*.5,z-i*w*.5*sa+k*d*.5*ca];
    for(const s of [-1,1]){
      this.quad(p(-s,-1,s),p(s,-1,s),p(s,1,s),p(-s,1,s),c,cell);
      this.quad(p(s,-1,s),p(s,-1,-s),p(s,1,-s),p(s,1,s),c,cell);
      this.quad(p(-1,s,s),p(1,s,s),p(1,s,-s),p(-1,s,-s),c,cell);
    }
  }
  /** Profile from bottom to lip then back down the inside. Use a nonzero foot
   * radius to leave undersides hollow; a fan closes serving dishes separately. */
  turn([x,y,z]:V,profile:Profile,c:string,cell:Cell='solid',n=20,depth=1){
    this.grid(n,profile.length-1,(u,v)=>{
      const [r,h]=profile[Math.round(v*(profile.length-1))],a=u*tau;
      return [x+r*Math.sin(a),y+h,z+depth*r*Math.cos(a)];
    },c,cell);
  }
  disk([x,y,z]:V,r:number,c:string,cell:Cell='solid',facing:'up'|'front'='up',n=48,aspect=1){
    this.color.set(c);const start=this.positions.length/3;this.point([x,y,z],cell,[.5,.5]);
    for(let i=0;i<n;i++){
      const a=i*tau/n,s=Math.cos(a),t=Math.sin(a);
      this.point(facing==='up'?[x+r*s,y,z-r*t*aspect]:[x+r*s,y+r*t*aspect,z],cell,[.5+.5*s,.5+.5*t]);
    }
    for(let i=0;i<n;i++)this.index.push(start,start+1+i,start+1+(i+1)%n);
  }
  /** Parallel transport keeps the facets of curved rails, handles and binding
   * cord from spiralling when their tangent changes from vertical to horizontal. */
  sweep(path:V[],r:number|number[],c:string,n=8,caps=false){
    let last:V|undefined;const frames=path.map((p,i)=>{
      const t=unit(sub(path[Math.min(path.length-1,i+1)],path[Math.max(0,i-1)]));
      const a:V=last??(Math.abs(t[1])>.85?[1,0,0]:[0,1,0]);const b=unit(cross(t,a));last=unit(cross(b,t));
      return [last,b] as [V,V];
    });
    const at=(u:number,v:number):V=>{
      const i=Math.round(v*(path.length-1)),[a,b]=frames[i],rr=typeof r==='number'?r:r[i],s=Math.cos(tau*u)*rr,t=Math.sin(tau*u)*rr;
      return add(path[i],[a[0]*s+b[0]*t,a[1]*s+b[1]*t,a[2]*s+b[2]*t]);
    };
    this.grid(n,path.length-1,at,c);
    if(caps)for(const v of [0,1]){
      const start=this.positions.length/3;this.point(path[v*(path.length-1)],'solid',[0,0]);
      for(let i=0;i<n;i++)this.point(at(i/n,v),'solid',[0,0]);
      for(let i=0;i<n;i++){
        const a=start+1+i,b=start+1+(i+1)%n;this.index.push(start,v?a:b,v?b:a);
      }
    }
  }
  finish(){
    const g=new BufferGeometry();g.setAttribute('position',new Float32BufferAttribute(this.positions,3));
    g.setAttribute('uv',new Float32BufferAttribute(this.uvs,2));g.setAttribute('color',new Float32BufferAttribute(this.colors,3));
    g.setIndex(this.index);g.computeVertexNormals();g.computeBoundingSphere();return g;
  }
}

export class Workshop {
  body=new Surface(); metal=new Surface(); paper=new Surface();
  finish(){return {body:this.body.finish(),metal:this.metal.empty?null:this.metal.finish(),paper:this.paper.empty?null:this.paper.finish()};}
}
export function arc(at:(a:number)=>V,segments:number,end=tau):V[]{return Array.from({length:segments+1},(_,i)=>at(end*i/segments));}
export function curve(a:V,b:V,c:V,d:V,n=8):V[]{return Array.from({length:n+1},(_,i)=>{const t=i/n,l=1-t;return [0,1,2].map(k=>l*l*l*a[k]+3*l*l*t*b[k]+3*l*t*t*c[k]+t*t*t*d[k]) as V;});}
