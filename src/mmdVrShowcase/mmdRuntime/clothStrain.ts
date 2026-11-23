import {Vector3} from 'three';

export type ClothPoint={p:Vector3; d:Vector3; movable:boolean};
const vec=()=>new Vector3();
type Face={a:number;b:number;c:number};
// Minimum projection of the oriented area over the entire line segment, not
// just at t=1. A triangle can cross zero twice and end up front-facing again.
export function safeClothScale(){
  const e=vec(),f=vec(),u=vec(),v=vec(),n=vec(),q=vec();
  return (a:ClothPoint,b:ClothPoint,c:ClothPoint)=>{
    e.subVectors(b.p,a.p);f.subVectors(c.p,a.p);u.subVectors(b.d,a.d);v.subVectors(c.d,a.d);
    const n2=n.crossVectors(e,f).lengthSq(),e2=e.lengthSq(),f2=f.lengthSq(),g2=e.distanceToSquared(f),long=Math.max(e2,f2,g2);
    if(n2<1e-22*long*long||!long)return 1;
    const linear=(q.crossVectors(e,v).dot(n)+q.crossVectors(u,f).dot(n))/n2,quadratic=q.crossVectors(u,v).dot(n)/n2;
    const ordinary=n2>.0025*long*long,floor=ordinary?.28:.045,area=(t:number)=>1+t*(linear+quadratic*t);
    const eDot=e.dot(u)*2,fDot=f.dot(v)*2,gDot=q.subVectors(e,f).dot(n.subVectors(u,v))*2;
    const u2=u.lengthSq(),v2=v.lengthSq(),w2=u.distanceToSquared(v);
    const ok=(t:number)=>{
      const min=quadratic>0?Math.min(t,Math.max(0,-linear/(2*quadratic))):t;
      return area(min)>=floor&&area(t)>=floor&&
        // Squared edge length is convex. Make a tiny allowance for authored
        // needle triangles, without permitting an ordinary edge to double.
        t*(eDot+t*u2)<=2.24*e2+long*.004 && t*(fDot+t*v2)<=2.24*f2+long*.004 && t*(gDot+t*w2)<=2.24*g2+long*.004;
    };
    if(ok(1))return 1;
    let lo=0,hi=1;for(let i=0;i<13;i++){const mid=(hi+lo)*.5;if(ok(mid))lo=mid;else hi=mid;}return lo*.998;
  };
}

/** Topology is mounted once. Work is limited to faces incident to this
 * frame's (welded) moving points, including fixed neighbours at a hem/waist.
 * Vertices not originally admitted never acquire motion from this pass. */
export function fitClothStrain(points:ClothPoint[],faces:Face[],refreshFixed:(i:number)=>void){
  const incident:number[][]=points.map(()=>[]);faces.forEach(({a,b,c},i)=>{incident[a].push(i);incident[b].push(i);incident[c].push(i);});
  const seen=new Int32Array(faces.length),read=new Int32Array(points.length),parent=new Int32Array(points.length),scale=new Float64Array(points.length);
  const active:number[]=[],used:number[]=[],target=points.map(vec),weight=new Float64Array(points.length),mean=vec(),bound=safeClothScale();let frame=0;
  function root(i:number){while(parent[i]!==i){parent[i]=parent[parent[i]];i=parent[i];}return i;}
  function union(i:number,j:number){if(points[i].d.lengthSq()&&points[j].d.lengthSq())parent[root(i)]=root(j);}
  return ()=>{
    frame++;active.length=used.length=0;
    for(let i=0;i<points.length;i++)if(points[i].d.lengthSq()){
      active.push(i);parent[i]=i;scale[i]=1;
      for(const j of incident[i])if(seen[j]!==frame){seen[j]=frame;used.push(j);}
    }
    if(!used.length)return;
    for(const j of used){const {a,b,c}=faces[j];for(const i of [a,b,c])if(read[i]!==frame){read[i]=frame;if(!points[i].movable)refreshFixed(i);}
      union(a,b);union(a,c);union(b,c);}
    // Relax differential motion locally before calculating the strict common
    // bound. On a fully moving face a shared translation costs no area; at a
    // fixed boundary, zero is the only admissible common translation.
    for(let pass=0;pass<3;pass++){
      let relaxed=false;for(const i of active){target[i].set(0,0,0);weight[i]=0;}
      for(const j of used){const {a,b,c}=faces[j],pa=points[a],pb=points[b],pc=points[c],t=bound(pa,pb,pc);if(t===1)continue;
        relaxed=true;mean.set(0,0,0);if(pa.d.lengthSq()&&pb.d.lengthSq()&&pc.d.lengthSq())mean.copy(pa.d).add(pb.d).add(pc.d).multiplyScalar(1/3);
        for(const i of [a,b,c])if(points[i].d.lengthSq()){target[i].addScaledVector(points[i].d,t).addScaledVector(mean,1-t);weight[i]++;}
      }
      if(!relaxed)return;
      for(const i of active)if(weight[i])points[i].d.copy(target[i]).divideScalar(weight[i]);
    }
    for(const j of used){const {a,b,c}=faces[j],t=bound(points[a],points[b],points[c]);if(t===1)continue;
      const moved=points[a].d.lengthSq()?a:points[b].d.lengthSq()?b:c,r=root(moved);scale[r]=Math.min(scale[r],t);}
    for(const i of active)points[i].d.multiplyScalar(scale[root(i)]);
  };
}
