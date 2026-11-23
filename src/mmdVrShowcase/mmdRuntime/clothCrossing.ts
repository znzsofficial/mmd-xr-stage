import {Vector3} from 'three';

type Face={a:Vector3;b:Vector3;c:Vector3;normal:Vector3;lo:Vector3;hi:Vector3;stamp:number};
const V=()=>new Vector3();
// An interval on the common line of two planes. Degenerate/coplanar
// contacts aren't evidence that this displayed material actually crosses skin.
function interval(a:number,b:number,c:number,x:number,y:number,z:number,out:number[]){
  out[0]=Infinity;out[1]=-Infinity;
  const edge=(u:number,v:number,i:number,j:number)=>{
    let k;if(Math.abs(u)<1e-9)k=i;else if(u*v<0)k=i+(j-i)*u/(u-v);else return;
    out[0]=Math.min(out[0],k);out[1]=Math.max(out[1],k);
  };edge(a,b,x,y);edge(b,c,y,z);edge(c,a,z,x);
}
// Points in thigh-length units. Sparse two-dimensional bins; a box along
// the depth axis rejects the far wall before a triangle/triangle test.
export class ClothCrossing {
  private bins:Face[][]=Array.from({length:16*18},()=>[]);
  private n=V();private axis=V();private l=V();private r=V();private lo=V();private hi=V();
  private u=[0,0];private v=[0,0];private stamp=0;
  private x(v:number){return Math.min(15,Math.max(0,Math.floor((v+.6)*12)));}
  private y(v:number){return Math.min(17,Math.max(0,Math.floor((v+.3)*12)));}
  add(a:Vector3,b:Vector3,c:Vector3){
    const normal=V().crossVectors(this.l.subVectors(b,a),this.r.subVectors(c,a)).normalize();if(normal.lengthSq()<.9)return;
    const f:Face={a,b,c,normal,lo:V().copy(a).min(b).min(c),hi:V().copy(a).max(b).max(c),stamp:0};
    for(let y=this.y(f.lo.y);y<=this.y(f.hi.y);y++)for(let x=this.x(f.lo.x);x<=this.x(f.hi.x);x++)this.bins[y*16+x].push(f);
  }
  crosses(a:Vector3,b:Vector3,c:Vector3){
    const lo=this.lo.copy(a).min(b).min(c),hi=this.hi.copy(a).max(b).max(c),n=this.n.crossVectors(this.l.subVectors(b,a),this.r.subVectors(c,a)).normalize();
    if(n.lengthSq()<.9)return false;const offset=n.dot(a),stamp=++this.stamp;
    for(let y=this.y(lo.y);y<=this.y(hi.y);y++)for(let x=this.x(lo.x);x<=this.x(hi.x);x++)for(const f of this.bins[y*16+x]){
      if(f.stamp===stamp)continue;f.stamp=stamp;
      if(lo.x>f.hi.x||lo.y>f.hi.y||lo.z>f.hi.z||hi.x<f.lo.x||hi.y<f.lo.y||hi.z<f.lo.z)continue;
      const n2=f.normal,k=n2.dot(f.a),d=n2.dot(a)-k,e=n2.dot(b)-k,g=n2.dot(c)-k;
      if(Math.min(d,e,g)>=-1e-8||Math.max(d,e,g)<=1e-8)continue;
      const i=n.dot(f.a)-offset,j=n.dot(f.b)-offset,h=n.dot(f.c)-offset;
      if(Math.min(i,j,h)>=-1e-8||Math.max(i,j,h)<=1e-8)continue;
      const axis=this.axis.crossVectors(n,n2).normalize();interval(d,e,g,axis.dot(a),axis.dot(b),axis.dot(c),this.u);
      interval(i,j,h,axis.dot(f.a),axis.dot(f.b),axis.dot(f.c),this.v);
      if(Math.min(this.u[1],this.v[1])-Math.max(this.u[0],this.v[0])>.00015)return true;
    }
    return false;
  }
}
