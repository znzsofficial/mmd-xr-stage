import {Matrix4, Vector3, type Material, type SkinnedMesh} from 'three';
import {clothMorphGuard} from './clothMorphGuard';

// Front depth of the displayed lower torso, in pelvis / thigh-length units.
// Include fitted waist clothing; exclude skirts, sleeves, the raised thighs
// and any fabric or accessory which does not actually follow the torso.
const W=33,H=41,X=.64,Y=-.22,DY=.032;
export function fitAbdomenSupport(mesh:SkinnedMesh,bindToPelvis:Matrix4,torso:Set<number>){
  const splits:SkinnedMesh[]=mesh.userData.mmdMorphSplitBodyMeshes??[],materials=[mesh.material].flat();
  const layers:{body:SkinnedMesh;material:Material;faces:number[];points:Map<number,Vector3>}[]=[];
  const p=new Vector3();let count=0;
  for(const body of splits.length?splits:[mesh]){const g=body.geometry,ix=g.index!,{position,skinIndex,skinWeight}=g.attributes;
    for(const group of g.groups){const faces:number[]=[],points=new Map<number,Vector3>(),checked=new Map<number,boolean>();
      const use=(i:number)=>{const cached=checked.get(i);if(cached!==undefined)return cached;
        p.fromBufferAttribute(position,i).applyMatrix4(bindToPelvis);let w=0;
        if(p.y>Y-.16&&p.y<1.18&&Math.abs(p.x)<.76&&p.z>-.12&&p.z<.56){for(let j=0;j<4;j++)if(torso.has(skinIndex.getComponent(i,j)))w+=skinWeight.getComponent(i,j);}
        const accept=w>.78;checked.set(i,accept);return accept;};
      for(let k=group.start;k<group.start+group.count;k+=3){const a=ix.getX(k),b=ix.getX(k+1),c=ix.getX(k+2);if(!use(a)||!use(b)||!use(c))continue;
        faces.push(a,b,c);for(const i of [a,b,c])if(!points.has(i))points.set(i,new Vector3());}
      const slot=body.userData.mmdMorphSplitBody?.materialIndex??group.materialIndex??0;
      if(faces.length&&materials[slot])layers.push({body,faces,points,material:materials[slot]});if((count+=faces.length)>60000)return null;
    }}
  const field=new Float32Array(W*H),radial=new Float32Array(W*H),m=new Matrix4();
  const relevant=new Map<SkinnedMesh,Set<number>>(),watched=new Map<number,Matrix4>();
  for(const {body,points}of layers){let ids=relevant.get(body);if(!ids)relevant.set(body,ids=new Set());
    for(const i of points.keys()){ids.add(i);const {skinIndex,skinWeight}=body.geometry.attributes;
      for(let j=0;j<4;j++){const b=skinIndex.getComponent(i,j);if(torso.has(b)&&skinWeight.getComponent(i,j)>.001&&!watched.has(b))watched.set(b,new Matrix4());}}}
  const morph=clothMorphGuard(mesh,relevant,new Set()),shown:boolean[]=[];
  function raster(dst:Float32Array,ax:number,ay:number,az:number,bx:number,by:number,bz:number,cx:number,cy:number,cz:number,range:number){
    const dx=bx-ax,ex=cx-ax,dy=by-ay,ey=cy-ay,det=dx*ey-ex*dy;if(Math.abs(det)<1e-8)return;
    const cell=2*range/(W-1),x0=Math.max(0,Math.ceil((Math.min(ax,bx,cx)+range)/cell)),x1=Math.min(W-1,Math.floor((Math.max(ax,bx,cx)+range)/cell));
    const y0=Math.max(0,Math.ceil((Math.min(ay,by,cy)-Y)/DY)),y1=Math.min(H-1,Math.floor((Math.max(ay,by,cy)-Y)/DY));
    for(let y=y0;y<=y1;y++)for(let x=x0;x<=x1;x++){const u=x*cell-range-ax,v=y*DY+Y-ay,s=(u*ey-v*ex)/det,t=(v*dx-u*dy)/det;
      if(s>=0&&t>=0&&s+t<=1){const j=y*W+x;dst[j]=Math.max(dst[j],az+s*(bz-az)+t*(cz-az));}}
  }
  function depth(field:Float32Array,x:number,y:number,range:number){const i=Math.floor((x+range)*(W-1)/(2*range)),j=Math.floor((y-Y)/DY);if(i<0||j<0||i>=W-1||j>=H-1)return -Infinity;
    const k=j*W+i;return Math.max(field[k],field[k+1],field[k+W],field[k+W+1]);}
  const arc=2.20;
  return {
    seed(worldToPelvis:Matrix4){field.fill(-Infinity);radial.fill(-Infinity);shown.length=0;if(morph.blocked())return;
      for(const [i,ref]of watched)ref.multiplyMatrices(worldToPelvis,mesh.skeleton.bones[i].matrixWorld);
      for(const {body,points,faces,material} of layers){shown.push(material.visible&&material.opacity>=.5);if(!shown[shown.length-1])continue;
      m.multiplyMatrices(worldToPelvis,body.matrixWorld);for(const [i,v] of points)body.getVertexPosition(i,v).applyMatrix4(m);
      for(let k=0;k<faces.length;k+=3){const a=points.get(faces[k])!,b=points.get(faces[k+1])!,c=points.get(faces[k+2])!;
        raster(field,a.x,a.y,a.z,b.x,b.y,b.z,c.x,c.y,c.z,X);
        const u=Math.atan2(a.x,a.z),v=Math.atan2(b.x,b.z),w=Math.atan2(c.x,c.z);if(Math.max(u,v,w)-Math.min(u,v,w)<1.25)
          raster(radial,u,a.y,Math.hypot(a.x,a.z),v,b.y,Math.hypot(b.x,b.z),w,c.y,Math.hypot(c.x,c.z),arc);
      }}},
    front(x:number,y:number){return depth(field,x,y,X);},
    valid(worldToPelvis:Matrix4){if(morph.blocked()||layers.some((l,i)=>shown[i]!==Boolean(l.material.visible&&l.material.opacity>=.5)))return false;
      for(const [i,ref]of watched){m.multiplyMatrices(worldToPelvis,mesh.skeleton.bones[i].matrixWorld);
        for(let j=0;j<16;j++)if(Math.abs(m.elements[j]-ref.elements[j])>1e-4)return false;}return true;},
    outside(p:Vector3,pad:number){const r=Math.hypot(p.x,p.z),surface=depth(radial,Math.atan2(p.x,p.z),p.y,arc);
      if(r<.05||!(surface+pad>r&&surface-r<.27))return;const s=(surface+pad)/r;p.x*=s;p.z*=s;},
  };
}
