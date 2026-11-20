import {BoxGeometry,BufferGeometry,Color,CylinderGeometry,Euler,Float32BufferAttribute,Matrix4,Quaternion,SphereGeometry,TorusGeometry,Vector3} from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {RoundedBoxGeometry} from 'three/addons/geometries/RoundedBoxGeometry.js';
import type {Slab} from './retreatLayout';

export type Finish='matte'|'wood'|'stone'|'metal'|'cloth'|'brocade'|'glow'|'city'|'garden'|'water'|'stream';
export type V=[number,number,number];
const repeat:Partial<Record<Finish,number>>={wood:1.35,stone:.94,cloth:.62,brocade:.52};
const zero:V=[0,0,0],unit:V=[1,1,1],tau=Math.PI*2;
/** One static indexed mesh per finish. Geometry order remains local to each
 * piece of furniture so the player-column narrow phase only visits nearby faces. */
export class Joinery {
  private batches=new Map<Finish,BufferGeometry[]>();
  private add(f:Finish,g:BufferGeometry,p:V,tint:string,rot:V=zero,size:V=unit,uv?:[number,number]){
    if(!g.index){const idx=Array.from({length:g.attributes.position.count},(_,i)=>i);g.setIndex(idx);}
    if(uv){const buf=g.attributes.uv;for(let i=0;i<buf.count;i++)buf.setXY(i,buf.getX(i)*uv[0],buf.getY(i)*uv[1]);}
    g.applyMatrix4(new Matrix4().compose(new Vector3(...p),new Quaternion().setFromEuler(new Euler(...rot)),new Vector3(...size)));
    const c=new Color(tint),rgb=new Float32Array(g.attributes.position.count*3);
    for(let i=0;i<rgb.length;i+=3)c.toArray(rgb,i);g.setAttribute('color',new Float32BufferAttribute(rgb,3));
    let batch=this.batches.get(f);if(!batch){batch=[];this.batches.set(f,batch);}batch.push(g);
  }
  box(f:Finish,p:V,w:number,h:number,d:number,col:string,r:V=zero){
    const g=new BoxGeometry(w,h,d),tile=repeat[f];
    if(tile){const a=g.attributes.uv;for(let i=0;i<24;i++){
      const face=Math.floor(i/8);let u=a.getX(i),v=a.getY(i);const du=face===0?d:w,dv=face===1?d:h;
      // Timber grain runs along a member, rather than across a two-metre plank.
      if(f==='wood'&&du>dv){[u,v]=[v*dv,u*du];}else{u*=du;v*=dv;}a.setXY(i,u/tile+p[0]*.31,v/tile+p[2]*.27);
    }}this.add(f,g,p,col,r);
  }
  slab(f:Finish,r:Slab,col:string){this.box(f,[r.x,(r.top+r.base)/2,r.z],r.w,r.top-r.base,r.d,col);}
  pad(f:Finish,p:V,w:number,h:number,d:number,rad:number,col:string,r:V=zero){this.add(f,new RoundedBoxGeometry(w,h,d,2,rad),p,col,r);}
  turn(f:Finish,p:V,top:number,base:number,h:number,col:string,r:V=zero,n=28){this.add(f,new CylinderGeometry(top,base,h,n),p,col,r);}
  orb(f:Finish,p:V,w:number,h:number,d:number,col:string,r:V=zero){this.add(f,new SphereGeometry(.5,24,14),p,col,r,[w,h,d]);}
  hoop(f:Finish,p:V,rad:number,tube:number,col:string,r:V=zero){this.add(f,new TorusGeometry(rad,tube,6,64),p,col,r);}
  line(f:Finish,a:V,b:V,rad:number,col:string){const start=new Vector3(...a),end=new Vector3(...b),v=end.clone().sub(start),len=v.length();const e=new Euler().setFromQuaternion(new Quaternion().setFromUnitVectors(new Vector3(0,1,0),v.normalize()));this.turn(f,start.lerp(end,.5).toArray(),rad,rad,len,col,[e.x,e.y,e.z],8);}
  grid(f:Finish,cols:number,rows:number,at:(u:number,v:number)=>V,col:string,uv:[number,number]=[1,1]){
    const pts:number[]=[],tex:number[]=[],idx:number[]=[];
    for(let j=0;j<=rows;j++)for(let i=0;i<=cols;i++){pts.push(...at(i/cols,j/rows));tex.push(i/cols,j/rows);if(i<cols&&j<rows){const a=j*(cols+1)+i;idx.push(a,a+1,a+cols+1,a+1,a+cols+2,a+cols+1);}}
    const g=new BufferGeometry();g.setAttribute('position',new Float32BufferAttribute(pts,3));g.setAttribute('uv',new Float32BufferAttribute(tex,2));g.setIndex(idx);g.computeVertexNormals();this.add(f,g,zero,col,zero,unit,uv);
  }
  medallion(f:Finish,p:V,r:number,col:string){
    // Separate polar UVs keep the painting right-side-up inside a round window.
    const pts:number[]=[...p],uv=[.5,.5],idx:number[]=[];
    for(let i=0;i<=80;i++){const a=tau*i/80,x=Math.cos(a),y=Math.sin(a);pts.push(p[0]+r*x,p[1]+r*y,p[2]);uv.push(.5+.5*x,.5+.5*y);if(i<80)idx.push(0,i+1,i+2);}
    const g=new BufferGeometry();g.setAttribute('position',new Float32BufferAttribute(pts,3));g.setAttribute('uv',new Float32BufferAttribute(uv,2));g.setIndex(idx);g.computeVertexNormals();this.add(f,g,zero,col);
  }
  finish(){return Array.from(this.batches,([finish,source])=>{
    const geometry=mergeGeometries(source,false)!;geometry.computeBoundingSphere();source.forEach(g=>g.dispose());return {finish,geometry};
  });}
}
