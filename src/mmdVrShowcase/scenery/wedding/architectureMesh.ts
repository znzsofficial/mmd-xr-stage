import {BufferGeometry, Color, Float32BufferAttribute} from 'three';

export type V = [number,number,number];
type Uv = [number,number];
type Corners = [V,V,V,V];
type Square = [Uv,Uv,Uv,Uv];
export const A = {brick:0,lime:1,paving:2,tile:3,wood:4,lacquer:5,lotus:6,frieze:7,swallows:8,gate:9,hall:10,paper:11,hallFloor:12,granite:13,plain:14,boards:15} as const;
// Virtual cells: the red silk strips and plain tint all share printed cell 14.
export const COUPLET_RIGHT=16,COUPLET_LEFT=17;
const full:Square=[[0,0],[1,0],[1,1],[0,1]];
const white='#ffffff';
const colors=new Map<string,Color>();
function tint(s:string){let c=colors.get(s);if(!c){c=new Color(s);colors.set(s,c);}return c;}
export const mix=(a:V,b:V,t:number):V=>[a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t,a[2]+(b[2]-a[2])*t];
const dist=(a:V,b:V)=>Math.hypot(a[0]-b[0],a[1]-b[1],a[2]-b[2]);

/** Opaque static surfaces share one padded albedo atlas. Split repeats in the
 * mesh so mip derivatives stay continuous without fract() or a custom shader. */
export class Skin {
  private pos:number[]=[]; private uv:number[]=[]; private col:number[]=[]; private idx:number[]=[];
  constructor(private readonly wholePrint=false){}
  face(q:Corners,slot:number,color=white,uv:Square=full,shade?:(p:V)=>number){
    const i=this.pos.length/3,c=tint(color);
    const triangle=q[3]===q[0];
    for(let j=0;j<(triangle?3:4);j++){
      this.pos.push(...q[j]); const k=shade?.(q[j])??1;
      this.col.push(c.r*k,c.g*k,c.b*k);
      if(this.wholePrint)this.uv.push(...uv[j]);
      else{
        const cell=slot>=16?A.plain:slot;
        const x=slot>=16?(slot===COUPLET_RIGHT?170:340)+108*uv[j][0]:slot===A.plain?100*uv[j][0]:487*uv[j][0];
        this.uv.push(((cell%4)*512+12.5+x)/2048,1-(Math.floor(cell/4)*512+12.5+487*(1-uv[j][1]))/2048);
      }
    }
    this.idx.push(i,i+1,i+2);if(!triangle)this.idx.push(i,i+2,i+3);
  }
  surface(a:V,b:V,c:V,d:V,slot:number,color=white,repeatX=Infinity,repeatY=Infinity){
    const nx=Math.max(1,Math.round(dist(a,b)/repeatX)),ny=Math.max(1,Math.round(dist(a,d)/repeatY));
    if(nx===1&&ny===1){this.face([a,b,c,d],slot,color);return;}
    for(let j=0;j<ny;j++)for(let i=0;i<nx;i++){
      const l=i/nx,r=(i+1)/nx,k=j/ny,t=(j+1)/ny;
      const p=(u:number,v:number)=>mix(mix(a,b,u),mix(d,c,u),v);
      this.face([p(l,k),p(r,k),p(r,t),p(l,t)],slot,color);
    }
  }
  block(x:number,y:number,z:number,w:number,h:number,d:number,slot:number,color=white,rx=Infinity,ry=Infinity){
    const l=x-w/2,r=x+w/2,b=y-h/2,t=y+h/2,n=z-d/2,s=z+d/2;
    this.surface([l,b,s],[r,b,s],[r,t,s],[l,t,s],slot,color,rx,ry);
    this.surface([r,b,n],[l,b,n],[l,t,n],[r,t,n],slot,color,rx,ry);
    this.surface([r,b,s],[r,b,n],[r,t,n],[r,t,s],slot,color,rx,ry);
    this.surface([l,b,n],[l,b,s],[l,t,s],[l,t,n],slot,color,rx,ry);
    this.surface([l,t,s],[r,t,s],[r,t,n],[l,t,n],slot,color,rx,ry);
    this.surface([l,b,n],[r,b,n],[r,b,s],[l,b,s],slot,color,rx,ry);
  }
  /** Oriented prism; wood grain and its long, cut edges follow the member. */
  beam(a:V,b:V,w:number,h:number,slot=A.wood as number,color=white){
    const len=dist(a,b);if(len<.0001)return;
    const u:V=[(b[0]-a[0])/len,(b[1]-a[1])/len,(b[2]-a[2])/len];
    const flat=Math.hypot(u[0],u[2]);const v:V=flat>.001?[u[2]/flat,0,-u[0]/flat]:[1,0,0];
    const n:V=[u[1]*v[2]-u[2]*v[1],u[2]*v[0]-u[0]*v[2],u[0]*v[1]-u[1]*v[0]];
    const p=(base:V,i:number,j:number):V=>base.map((q,k)=>q+i*v[k]*w/2+j*n[k]*h/2) as V;
    const dirs=[[-1,-1],[1,-1],[1,1],[-1,1]];
    for(let i=0;i<4;i++){
      const [j,k]=dirs[i],[jj,kk]=dirs[(i+1)%4];
      this.face([p(b,j,k),p(a,j,k),p(a,jj,kk),p(b,jj,kk)],slot,color);
    }
    this.face([p(b,-1,-1),p(b,1,-1),p(b,1,1),p(b,-1,1)],slot,color);
    this.face([p(a,-1,1),p(a,1,1),p(a,1,-1),p(a,-1,-1)],slot,color);
  }
  /** A turned profile through (elevation, radius) pairs around the Y axis. */
  lathe(x:number,z:number,profile:number[][],slot:number,color=white,n=12){
    const at=(a:number,p:number[]):V=>[x+Math.cos(a)*p[1],p[0],z+Math.sin(a)*p[1]];
    for(let j=0;j<profile.length-1;j++)for(let i=0;i<n;i++){
      const a=i/n*Math.PI*2,b=(i+1)/n*Math.PI*2,l=profile[j],t=profile[j+1];
      this.face([at(b,l),at(a,l),at(a,t),at(b,t)],slot,color,[[0,i/n],[0,(i+1)/n],[1,(i+1)/n],[1,i/n]]);
    }
  }
  finish(){
    const g=new BufferGeometry();g.setAttribute('position',new Float32BufferAttribute(this.pos,3));g.setAttribute('uv',new Float32BufferAttribute(this.uv,2));
    g.setAttribute('color',new Float32BufferAttribute(this.col,3));g.setIndex(this.idx);g.computeVertexNormals();g.computeBoundingSphere();return g;
  }
}
