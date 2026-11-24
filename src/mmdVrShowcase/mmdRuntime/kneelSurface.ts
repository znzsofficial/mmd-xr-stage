import {Box3, Vector3} from 'three';

const V=()=>new Vector3();
export type KneeFace={a:Vector3;b:Vector3;c:Vector3;zone:number};
type Face=KneeFace&{box:Box3;n:Vector3;offset:number};
type Branch={box:Box3;faces?:Face[];left?:Branch;right?:Branch};

// Positive length only: a coplanar contact, point touch or extension of an
// edge is not a crossing. Coordinates here are in the posed mesh's space.
export function measureKneeSurface(faces:KneeFace[],unit:number){
  const e=V(),f=V(),n=V(),axis=V(),box=new Box3(),eps=unit*1e-8;
  function tree(fs:Face[]):Branch{
    const box=new Box3();for(const t of fs)box.union(t.box);
    if(fs.length<=10)return {box,faces:fs};
    box.getSize(e);const k=e.x>e.y&&e.x>e.z?'x':e.y>e.z?'y':'z';
    fs.sort((a,b)=>a.box.min[k]+a.box.max[k]-b.box.min[k]-b.box.max[k]);const mid=fs.length>>1;
    return {box,left:tree(fs.slice(0,mid)),right:tree(fs.slice(mid))};
  }
  const root=tree(faces.map(t=>{const n=V().crossVectors(e.subVectors(t.b,t.a),f.subVectors(t.c,t.a)).normalize();
    return {...t,box:new Box3().setFromPoints([t.a,t.b,t.c]),n,offset:n.dot(t.a)};}));
  function endpoint(d:number,h:number,u:number,v:number){return Math.abs(d)<=eps?u:d*h<0?u+(v-u)*d/(d-h):NaN;}
  function interval(d:number,h:number,j:number,u:number,v:number,w:number,out:number[]){
    const a=endpoint(d,h,u,v),b=endpoint(h,j,v,w),c=endpoint(j,d,w,u);
    out[0]=Math.min(Number.isNaN(a)?Infinity:a,Number.isNaN(b)?Infinity:b,Number.isNaN(c)?Infinity:c);
    out[1]=Math.max(Number.isNaN(a)?-Infinity:a,Number.isNaN(b)?-Infinity:b,Number.isNaN(c)?-Infinity:c);
  }
  const t=[0,0],s=[0,0],work:Branch[]=[];
  return (a:Vector3,b:Vector3,c:Vector3,lengths:Float64Array)=>{
    box.min.copy(a).min(b).min(c);box.max.copy(a).max(b).max(c);
    n.crossVectors(e.subVectors(b,a),f.subVectors(c,a)).normalize();const offset=n.dot(a);
    lengths.fill(0);work.push(root);
    while(work.length){const branch=work.pop()!;if(!box.intersectsBox(branch.box))continue;
      if(!branch.faces){work.push(branch.left!,branch.right!);continue;}
      for(const face of branch.faces){if(!box.intersectsBox(face.box))continue;
        const m=face.n,k=face.offset,da=m.dot(a)-k,db=m.dot(b)-k,dc=m.dot(c)-k;
        if(Math.min(da,db,dc)>=-eps||Math.max(da,db,dc)<=eps)continue;
        const ia=n.dot(face.a)-offset,ib=n.dot(face.b)-offset,ic=n.dot(face.c)-offset;
        if(Math.min(ia,ib,ic)>=-eps||Math.max(ia,ib,ic)<=eps)continue;
        axis.crossVectors(n,m).normalize();
        interval(da,db,dc,axis.dot(a),axis.dot(b),axis.dot(c),t);
        interval(ia,ib,ic,axis.dot(face.a),axis.dot(face.b),axis.dot(face.c),s);
        const length=Math.min(t[1],s[1])-Math.max(t[0],s[0]);if(length>unit*.0001)lengths[face.zone]+=length;
      }
    }
  };
}
