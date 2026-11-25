import {Box3,Matrix4,Triangle,Vector3,type SkinnedMesh} from 'three';

type Face={tri:Triangle;box:Box3;center:Vector3;side:number};
type Node={box:Box3;faces?:Face[];left?:Node;right?:Node};
const byX=(a:Face,b:Face)=>a.center.x-b.center.x,byY=(a:Face,b:Face)=>a.center.y-b.center.y,byZ=(a:Face,b:Face)=>a.center.z-b.center.z;
function leaf(faces:Face[]):Node{const box=new Box3();for(const f of faces)box.union(f.box);return {box,faces};}
// Partition only branches reached by a closest-point query. The full posed
// skin is already captured; later queries cannot read a different frame.
function split(n:Node,p:Vector3){const fs=n.faces!;if(fs.length<=8)return;
  n.box.getSize(p);fs.sort(p.x>p.y?(p.x>p.z?byX:byZ):p.y>p.z?byY:byZ);
  const mid=fs.length>>1;n.left=leaf(fs.slice(0,mid));n.right=leaf(fs.slice(mid));n.faces=undefined;
}
const dirs=[[.21,.88,.43],[-.86,.32,.39],[.49,.19,-.85]].map(x=>new Vector3(...x).normalize());
// The same six parity rays are used for many garment vertices. Index the
// projected skin once. Positive and negative hits share the same 2D cell and
// barycentric test; no per-point traversal of six AABB trees.
function parityView(faces:Face[],n:Vector3){const x=new Vector3().set(Math.abs(n.y)>.8?1:0,Math.abs(n.y)>.8?0:1,0).cross(n).normalize(),y=n.clone().cross(x),N=18;
  type Projected={x:number;y:number;z:number;u:number;v:number;s:number;t:number;e:number;f:number};
  const bins:Projected[][]=Array.from({length:N*N},()=>[]);let x0=Infinity,y0=Infinity,x1=-Infinity,y1=-Infinity;
  for(const {tri}of faces)for(const p of [tri.a,tri.b,tri.c]){const u=p.dot(x),v=p.dot(y);x0=Math.min(x0,u);x1=Math.max(x1,u);y0=Math.min(y0,v);y1=Math.max(y1,v);}
  const col=(u:number)=>Math.max(0,Math.min(N-1,Math.floor((u-x0)*N/(x1-x0)))),row=(v:number)=>Math.max(0,Math.min(N-1,Math.floor((v-y0)*N/(y1-y0))));
  for(const {tri:{a,b,c}}of faces){const ax=x.dot(a),ay=y.dot(a),az=n.dot(a),bx=x.dot(b),by=y.dot(b),cx=x.dot(c),cy=y.dot(c),dx=bx-ax,dy=by-ay,ex=cx-ax,ey=cy-ay,det=dx*ey-dy*ex;if(Math.abs(det)<1e-12)continue;
    const f:Projected={x:ax,y:ay,z:az,u:ey/det,v:-ex/det,s:-dy/det,t:dx/det,e:n.dot(b)-az,f:n.dot(c)-az};
    const endX=col(Math.max(ax,bx,cx)),endY=row(Math.max(ay,by,cy));for(let j=row(Math.min(ay,by,cy));j<=endY;j++)for(let i=col(Math.min(ax,bx,cx));i<=endX;i++)bins[j*N+i].push(f);}
  const hits:number[]=[];return (p:Vector3)=>{const px=p.dot(x),py=p.dot(y),pz=p.dot(n);hits.length=0;
    for(const f of bins[row(py)*N+col(px)]){const u=px-f.x,v=py-f.y,i=u*f.u+v*f.v,j=u*f.s+v*f.t;if(i<0||j<0||i+j>1)continue;hits.push(f.z+i*f.e+j*f.f-pz);}
    hits.sort((a,b)=>a-b);let minus=0,plus=0,last=-Infinity;for(const h of hits){if(h-last<1e-7||Math.abs(h)<1e-8)continue;last=h;if(h>0)plus++;else minus++;}return (plus&minus&1)!==0;};
}
/** Only built for a raised, supported lap. Keep the complete selected draw for
 * parity (including holes and the opposite leg); classify the nearest face by
 * its actual thigh weights. Never cap a missing hip with a closed capsule. */
export function fitHipSkinDepth(mesh:SkinnedMesh,material:unknown,hips:number[],worldToLap:Matrix4){
  const draws:SkinnedMesh[]=mesh.userData.mmdMorphSplitBodyMeshes?.length?mesh.userData.mmdMorphSplitBodyMeshes:[mesh],mats=[mesh.material].flat();
  const bones=mesh.skeleton.bones,names=(i:number)=>[bones[i]?.name,bones[i]?.userData.mmdBoneName,bones[i]?.userData.mmdEnglishBoneName].filter((x):x is string=>typeof x==='string').map(s=>s.normalize('NFKC').toLowerCase().replace(/[\s_.-]/g,'').replace(/d$/,''));
  const match=hips.map(i=>new Set(names(i))),sides=bones.map((_,i)=>{const labels=names(i);return match.findIndex(s=>labels.some(n=>s.has(n)));});
  const faces:Face[]=[],p=new Vector3(),rot=new Matrix4();
  for(const body of draws){const g=body.geometry,{skinIndex,skinWeight}=g.attributes,ix=g.index!,points=new Map<number,Vector3>();
    rot.multiplyMatrices(worldToLap,body.matrixWorld);
    const point=(i:number)=>{let v=points.get(i);if(!v){v=body.getVertexPosition(i,new Vector3()).applyMatrix4(rot);points.set(i,v);}return v;};
    for(const gr of g.groups){if(mats[body.userData.mmdMorphSplitBody?.materialIndex??gr.materialIndex??0]!==material)continue;
      if(faces.length+gr.count/3>8400)return null;
      for(let j=gr.start;j<gr.start+gr.count;j+=3){const a=ix.getX(j),b=ix.getX(j+1),c=ix.getX(j+2),tri=new Triangle(point(a),point(b),point(c));let left=0,right=0;
        for(const i of [a,b,c])for(let k=0;k<4;k++){const s=sides[skinIndex.getComponent(i,k)],w=skinWeight.getComponent(i,k);if(s===0)left+=w;if(s===1)right+=w;}
        faces.push({tri,box:new Box3().setFromPoints([tri.a,tri.b,tri.c]),center:tri.getMidpoint(new Vector3()),side:left>=1.5?0:right>=1.5?1:-1});}
    }}
  if(!faces.length)return null;
  const root=leaf(faces),pos=new Vector3();split(root,p);let best=Infinity,nearest=-1;
  function distance(n:Node){if(n.box.distanceToPoint(pos)>=best)return;if(n.faces&&n.faces.length>8)split(n,p);
    if(n.faces){for(const f of n.faces){const d=f.tri.closestPointToPoint(pos,p).distanceTo(pos);if(d<best){best=d;nearest=f.side;}}}
    else{const a=n.left!,b=n.right!;if(a.box.distanceToPoint(pos)<b.box.distanceToPoint(pos)){distance(a);distance(b);}else{distance(b);distance(a);}}}
  const views=dirs.map(d=>parityView(faces,d.clone().transformDirection(worldToLap)));
  const depth=(v:Vector3,side:number)=>{if(!root.box.containsPoint(v))return 0;pos.copy(v);for(const odd of views)if(!odd(pos))return 0;
    best=Infinity;nearest=-1;distance(root);return nearest===side?best:0;};
  // Order peak witnesses by a geometric upper bound. A nearest sampled skin
  // point is at least as far as the nearest triangle, even across UV seams.
  // Cache per-cell radius, add distance to cell centre (triangle inequality).
  const seen=new Set<Vector3>(),samples:Vector3[]=[];for(const f of faces)for(const p of [f.tri.a,f.tri.b,f.tri.c])if(!seen.has(p))seen.add(p);
  let n=0;const stride=Math.max(1,Math.floor(seen.size/900));for(const p of seen)if(n++%stride===0)samples.push(p);
  const cache=new Map<number,number>(),cell=new Vector3(),step=.045;
  function upper(v:Vector3){if(!root.box.containsPoint(v))return 0;const x=Math.round(v.x/step),y=Math.round(v.y/step),z=Math.round(v.z/step),key=(x+256)*1048576+(y+256)*1024+z+256;
    cell.set(x*step,y*step,z*step);let r=cache.get(key);if(r===undefined){let d=Infinity;for(const s of samples)d=Math.min(d,s.distanceToSquared(cell));r=Math.sqrt(d);if(cache.size<24000)cache.set(key,r);}return r+cell.distanceTo(v);}
  return Object.assign(depth,{upper});
}
