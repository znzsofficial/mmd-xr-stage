import {BufferGeometry,Color,Float32BufferAttribute} from 'three';

export type V=[number,number,number];
type UV=[number,number];
export type Finish='ashlar'|'toolstone'|'pavement'|'oak'|'arras'|'register'|'tablets'|'window'|'pigment'|'iron'|'light';
type Batch={p:number[];uv:number[];rgb:number[];idx:number[]};
const unit:UV[]=[[0,0],[1,0],[1,1],[0,1]];
// Static geometry is sorted by surface, not by individual stones or book leaves.
export class Masonry {
  private batches=new Map<Finish,Batch>();
  private colors=new Map<string,number[]>();
  quad(f:Finish,p:[V,V,V,V],tint:string,uv:UV[]=unit){
    let b=this.batches.get(f);if(!b){b={p:[],uv:[],rgb:[],idx:[]};this.batches.set(f,b);}
    let c=this.colors.get(tint);if(!c){c=new Color(tint).toArray();this.colors.set(tint,c);}
    const k=b.p.length/3;
    for(let i=0;i<4;i++){b.p.push(...p[i]);b.uv.push(...uv[i]);b.rgb.push(...c);}
    b.idx.push(k,k+1,k+2,k,k+2,k+3);
  }
  face(f:Finish,p:[V,V,V,V],col:string,axis:'xy'|'zy'|'xz'){
    const uv=p.map(([x,y,z]):UV=>axis==='xy'?[x,y]:axis==='zy'?[z,y]:[x,z]);
    const tile=f==='ashlar'?[3.32,1.92]:f==='oak'?[.9,1.18]:[.76,.76];
    if(f==='oak'&&Math.abs(uv[1][0]-uv[0][0])>Math.abs(uv[2][1]-uv[1][1]))for(const v of uv)[v[0],v[1]]=[v[1],v[0]];
    this.quad(f,p,col,uv.map(([u,v])=>[u/tile[0],v/tile[1]]));
  }
  box(f:Finish,x:number,y:number,z:number,w:number,h:number,d:number,col:string){
    const l=x-w/2,r=x+w/2,b=y-h/2,t=y+h/2,n=z-d/2,s=z+d/2;
    this.face(f,[[l,b,s],[r,b,s],[r,t,s],[l,t,s]],col,'xy');this.face(f,[[r,b,n],[l,b,n],[l,t,n],[r,t,n]],col,'xy');
    this.face(f,[[r,b,s],[r,b,n],[r,t,n],[r,t,s]],col,'zy');this.face(f,[[l,b,n],[l,b,s],[l,t,s],[l,t,n]],col,'zy');
    this.face(f,[[l,t,s],[r,t,s],[r,t,n],[l,t,n]],col,'xz');this.face(f,[[l,b,n],[r,b,n],[r,b,s],[l,b,s]],col,'xz');
  }
  // Axial extrusion of one voussoir, including its curved intrados and reveal.
  stone(points:[number,number][],z:number,depth:number,col:string,f:Finish='toolstone'){
    const n=points.map(([x,y]):V=>[x,y,z-depth/2]) as [V,V,V,V],s=points.map(([x,y]):V=>[x,y,z+depth/2]) as [V,V,V,V];
    this.face(f,s,col,'xy');this.face(f,[n[3],n[2],n[1],n[0]],col,'xy');
    for(let i=0;i<4;i++){const j=(i+1)%4;this.face(f,[s[i],n[i],n[j],s[j]],col,i%2===0?'xz':'zy');}
  }
  spindle(f:Finish,x:number,z:number,profile:[number,number][],col:string,sides=10){
    for(let j=0;j<profile.length-1;j++)for(let i=0;i<sides;i++){
      const point=(k:number,m:number):V=>[x+profile[m][1]*Math.cos(k*2*Math.PI/sides),profile[m][0],z+profile[m][1]*Math.sin(k*2*Math.PI/sides)];
      this.quad(f,[point(i+1,j),point(i,j),point(i,j+1),point(i+1,j+1)],col);
    }
  }
  build(){return Array.from(this.batches,([finish,b])=>{
    const geometry=new BufferGeometry();geometry.setAttribute('position',new Float32BufferAttribute(b.p,3));geometry.setAttribute('uv',new Float32BufferAttribute(b.uv,2));
    geometry.setAttribute('color',new Float32BufferAttribute(b.rgb,3));geometry.setIndex(b.idx);geometry.computeVertexNormals();geometry.computeBoundingSphere();return {finish,geometry};
  });}
}
