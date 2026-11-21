import {BufferGeometry,Color,Float32BufferAttribute} from 'three';

export type V=[number,number,number];
type UV=[number,number];
type BoxSide='west'|'east'|'north'|'south'|'top'|'base';
export type Finish='ashlar'|'toolstone'|'pavement'|'oak'|'arras'|'register'|'tablets'|'dusk'|'pigment'|'iron'|'light';
type Batch={p:number[];uv:number[];rgb:number[];idx:number[]};
const unit:UV[]=[[0,0],[1,0],[1,1],[0,1]];
const equal=(a:V,b:V)=>Math.abs(a[0]-b[0])<1e-9&&Math.abs(a[1]-b[1])<1e-9&&Math.abs(a[2]-b[2])<1e-9;
// Static geometry is sorted by surface, not by individual stones or book leaves.
export class Masonry {
  private batches=new Map<Finish,Batch>();
  private colors=new Map<string,number[]>();
  quad(f:Finish,p:[V,V,V,V],tint:string,uv:UV[]=unit){
    let b=this.batches.get(f);if(!b){b={p:[],uv:[],rgb:[],idx:[]};this.batches.set(f,b);}
    let c=this.colors.get(tint);if(!c){c=new Color(tint).toArray();this.colors.set(tint,c);}
    const k=b.p.length/3;
    for(let i=0;i<4;i++){b.p.push(...p[i]);b.uv.push(...uv[i]);b.rgb.push(...c);}
    // Fans, pointed inlays and turned caps may collapse one end of a quad.
    // A zero-area triangle provides neither a normal nor a player surface.
    if(!equal(p[0],p[1])&&!equal(p[1],p[2])&&!equal(p[0],p[2]))b.idx.push(k,k+1,k+2);
    if(!equal(p[0],p[2])&&!equal(p[2],p[3])&&!equal(p[0],p[3]))b.idx.push(k,k+2,k+3);
  }
  face(f:Finish,p:[V,V,V,V],col:string,axis:'xy'|'zy'|'xz'){
    const uv=p.map(([x,y,z]):UV=>axis==='xy'?[x,y]:axis==='zy'?[z,y]:[x,z]);
    const tile=f==='ashlar'?[3.32,1.92]:f==='oak'?[.9,1.18]:[.76,.76];
    if(f==='oak'&&Math.abs(uv[1][0]-uv[0][0])>Math.abs(uv[2][1]-uv[1][1]))for(const v of uv)[v[0],v[1]]=[v[1],v[0]];
    this.quad(f,p,col,uv.map(([u,v])=>[u/tile[0],v/tile[1]]));
  }
  box(f:Finish,x:number,y:number,z:number,w:number,h:number,d:number,col:string,omit:readonly BoxSide[]=[]){
    const l=x-w/2,r=x+w/2,b=y-h/2,t=y+h/2,n=z-d/2,s=z+d/2;
    if(!omit.includes('south'))this.face(f,[[l,b,s],[r,b,s],[r,t,s],[l,t,s]],col,'xy');
    if(!omit.includes('north'))this.face(f,[[r,b,n],[l,b,n],[l,t,n],[r,t,n]],col,'xy');
    if(!omit.includes('east'))this.face(f,[[r,b,s],[r,b,n],[r,t,n],[r,t,s]],col,'zy');
    if(!omit.includes('west'))this.face(f,[[l,b,n],[l,b,s],[l,t,s],[l,t,n]],col,'zy');
    if(!omit.includes('top'))this.face(f,[[l,t,s],[r,t,s],[r,t,n],[l,t,n]],col,'xz');
    if(Math.abs(b)>1e-7&&!omit.includes('base'))this.face(f,[[l,b,n],[r,b,n],[r,b,s],[l,b,s]],col,'xz'); // pavement owns the ground plane
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
