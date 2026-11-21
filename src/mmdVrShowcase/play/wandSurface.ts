import { Box3, Matrix4, Triangle, Vector3, type BufferAttribute, type InterleavedBufferAttribute, type Material, type Object3D, type SkinnedMesh } from 'three';
import type {ContactCap} from './wandHead';
import {createWandPose} from './wandPose';
import {visibleTexel} from './wandOpacity';

export type WandModel={root:Object3D;mesh:SkinnedMesh;renderOrderMeshes:readonly SkinnedMesh[]};
export type WandHit={depth:number;axis:Vector3};
type Attr=BufferAttribute|InterleavedBufferAttribute;
type Cell={faces:number[];bones:number[];center:Vector3;radius:number;swing:number;qdef:boolean};
type Layer={mesh:SkinnedMesh;pose:ReturnType<typeof createWandPose>;cells:Cell[];owner:Object3D;material:Material};
const v=()=>new Vector3();
const rendered=(m:Material)=>m.visible&&m.colorWrite&&m.opacity>0&&m.opacity>=m.alphaTest;
const visible=(obj:Object3D)=>{for(let n:Object3D|null=obj;n;n=n.parent)if(!n.visible)return false;return true;};
const maxVertices=450_000,maxFaces=800_000;

/** Build material-scoped clusters incrementally; a large cold PMX must not
 * trigger a full topology scan in the XR frame in which the head approaches. */
function* build(model:WandModel){
  const source=model.mesh, meshes:SkinnedMesh[]=source.userData.mmdMorphSplitBodyMeshes??[source];
  const layers:Layer[]=[], p=v(),center=v(),lo=v(),hi=v();
  let vertices=0,faces=0;
  const cellSize=Math.max(1e-5,(source.geometry.boundingSphere?.radius||1)*.1);
  for(const mesh of meshes){
    const g=mesh.geometry,{position,skinWeight:w,skinIndex:ix,matricesSdefEnabled:sdef,matricesQdefEnabled:qdef}=g.attributes;
    if(!position || (vertices+=position.count)>maxVertices)return [];
    const total=g.index?.count??position.count, index=g.index;
    const pose=createWandPose(mesh,source),materials=Array.isArray(mesh.material)?mesh.material:[mesh.material],unbind=mesh.bindMatrix.clone().invert();
    const proxies=mesh===source&&model.renderOrderMeshes.length>0&&g.drawRange.count===0;
    const ranges=proxies?model.renderOrderMeshes.map(owner=>({owner,material:Array.isArray(owner.material)?owner.material[0]:owner.material,...owner.geometry.drawRange})):
      (Array.isArray(mesh.material)?g.groups:[{start:0,count:total,materialIndex:0}]).map(group=>({owner:mesh,material:materials[group.materialIndex??0],
        start:Math.max(g.drawRange.start,group.start),count:Math.min(g.drawRange.start+g.drawRange.count,group.start+group.count)-Math.max(g.drawRange.start,group.start)}));
    for(const {owner,material,start,count} of ranges){
      if(!material||count<=0)continue;
      type Bucket={faces:number[];bones:Set<number>;box:Box3;swing:number;qdef:boolean};
      const buckets=new Map<string,Bucket>(),end=Math.min(total,start+count);
      for(let j=start;j+2<end;j+=3){
        if((++faces&127)===0)yield;
        if(faces>maxFaces)return [];
        center.set(0,0,0);lo.setScalar(Infinity);hi.setScalar(-Infinity);
        for(let k=0;k<3;k++){
          p.fromBufferAttribute(position,index?.getX(j+k)??j+k);center.add(p);lo.min(p);hi.max(p);
        }
        center.multiplyScalar(1/(3*cellSize));const key=`${Math.floor(center.x)},${Math.floor(center.y)},${Math.floor(center.z)}`;
        let cell=buckets.get(key);if(!cell){cell={faces:[],bones:new Set(),box:new Box3(),swing:-1,qdef:false};buckets.set(key,cell);}
        cell.faces.push(j);cell.box.expandByPoint(lo).expandByPoint(hi);
        for(let k=0;k<3;k++){
          const i=index?.getX(j+k)??j+k;
          if((qdef?.getX(i)??0)>=.5)cell.qdef=true;
          else if((sdef?.getX(i)??0)>=.5){
            // SDEF = rotated (position-C) + weighted transformed RW0/RW1.
            // Bound these terms separately; an ordinary weighted rest box
            // cannot conservatively reject a bent SDEF elbow.
            cell.box.expandByPoint(p.fromBufferAttribute(g.attributes.matricesSdefRW0,i).applyMatrix4(unbind));
            cell.box.expandByPoint(p.fromBufferAttribute(g.attributes.matricesSdefRW1,i).applyMatrix4(unbind));
            cell.swing=Math.max(cell.swing,p.fromBufferAttribute(position,i).applyMatrix4(mesh.bindMatrix).distanceTo(center.fromBufferAttribute(g.attributes.matricesSdefC,i)));
          }
          if(ix&&w&&mesh.skeleton?.bones.length)for(let b=0;b<4;b++)if(w.getComponent(i,b)>0)cell.bones.add(ix.getComponent(i,b));
        }
      }
      const cells:Cell[]=[];for(const b of buckets.values()){
        cells.push({faces:b.faces,bones:[...b.bones],center:b.box.getCenter(v()),radius:b.box.getSize(p).length()*.5,swing:b.swing,qdef:b.qdef});
        if((cells.length&255)===0)yield;
      }
      if(cells.length)layers.push({owner,material,pose,mesh,cells});
    }
  }return layers;
}

// Bounds for active morphs only. Share the loader's identical zero attributes.
const morphTravel=new WeakMap<Attr,number>();
function* measure(attr:Attr){let max=0;
  for(let i=0;i<attr.count;i++){const x=attr.getX(i),y=attr.getY(i),z=attr.getZ(i);max=Math.max(max,x*x+y*y+z*z);if((i&511)===511)yield;}
  morphTravel.set(attr,Math.sqrt(max));
}

export function createWandSurface(model:WandModel){
  let builder:ReturnType<typeof build>|null=build(model), layers:Layer[]=[];
  const pending=new WeakMap<Attr,ReturnType<typeof measure>>(), box=new Box3(),center=v(),a=v(),b=v(),c=v(),point=v();
  const tri=new Triangle(a,b,c),zero=v(),mid=v(),worldToCap=new Matrix4(),bestAxis=v();
  let lastLayer:Layer|null=null,lastFace=-1,nextLayer=0,nextCell=0,nextFace=0;
  function warm(deadline:number){
    if(builder)do {const s=builder.next();if(s.done){layers=s.value;builder=null;break;}}while(performance.now()<deadline);
    return !builder;
  }
  function face(l:Layer,j:number,cap:ContactCap,out:WandHit){
    const index=l.mesh.geometry.index;
    l.pose.vertex(index?.getX(j)??j,a).applyMatrix4(worldToCap);
    l.pose.vertex(index?.getX(j+1)??j+1,b).applyMatrix4(worldToCap);
    l.pose.vertex(index?.getX(j+2)??j+2,c).applyMatrix4(worldToCap);
    tri.closestPointToPoint(zero,point);
    const d=point.length();if(!(d<1)||1-d<=out.depth||!visibleTexel(l.material,l.mesh.geometry,j,tri,point))return;
    out.depth=1-d;
    if(d>1e-6)bestAxis.copy(point);else tri.getNormal(bestAxis);
    bestAxis.applyMatrix3(cap.normalToPart).normalize();
    if(bestAxis.lengthSq()===0)bestAxis.set(0,1,0);
    out.axis.copy(bestAxis);lastLayer=l;lastFace=j;
  }
  function query(pivot:Object3D,cap:ContactCap,out:WandHit,deadline:number){
    out.depth=0;if(!visible(model.root)||!warm(deadline)||!layers.length)return;
    pivot.updateWorldMatrix(true,false);
    worldToCap.copy(pivot.matrixWorld).invert().premultiply(cap.toUnit);
    center.copy(cap.center).applyMatrix4(pivot.matrixWorld);
    const radius=cap.radius*pivot.matrixWorld.getMaxScaleOnAxis()+.006; // allow the independent fingertip display offset in the broad phase
    const previous=lastLayer;const cachedFace=lastFace;lastLayer=null;
    // Validate the last contact against this pose even on complex rigs. An
    // interrupted or budget-limited search never authorizes an old hit.
    if(previous&&visible(previous.owner)&&rendered(previous.material)){
      previous.pose.begin();face(previous,cachedFace,cap,out);
    }
    const startLayer=nextLayer;let checked=0;
    do {
      const l=layers[nextLayer];
      if(visible(l.owner)&&rendered(l.material)){
        l.pose.begin();let margin=0,measured=true;
        for(const {attr,weight} of l.pose.active){
          let travel=morphTravel.get(attr);if(travel===undefined){
            let gen=pending.get(attr);if(!gen){gen=measure(attr);pending.set(attr,gen);}
            do {if(gen.next().done){pending.delete(attr);break;}}while(performance.now()<deadline);
            travel=morphTravel.get(attr);if(travel===undefined){measured=false;break;}
          }margin+=travel*Math.abs(weight);
        }
        // Absolute morphs and dual-quaternion skin do not obey the ordinary
        // convex palette bound. Visit their actual triangles within the same
        // rolling work budget instead of ever reporting a broad-phase hit.
        if(measured)for(;nextCell<l.cells.length;nextCell++,nextFace=0){
          const cell=l.cells[nextCell];
          if(!cell.qdef&&(!margin||l.mesh.geometry.morphTargetsRelative)){
            box.makeEmpty();const r=cell.radius+margin;
            let qLengthSq=1;
            if(cell.bones.length){for(const i of cell.bones){const bone=l.pose.bone(i);mid.copy(cell.center).applyMatrix4(bone.world);
              if(cell.swing>=0)qLengthSq=Math.max(qLengthSq,bone.rotation.lengthSq());
              const extent=r*bone.scale;box.expandByPoint(a.copy(mid).addScalar(-extent));box.expandByPoint(a.copy(mid).addScalar(extent));}}
            else {mid.copy(cell.center).applyMatrix4(l.mesh.matrixWorld);const extent=r*l.mesh.matrixWorld.getMaxScaleOnAxis();box.expandByPoint(a.copy(mid).addScalar(-extent));box.expandByPoint(a.copy(mid).addScalar(extent));}
            if(cell.swing>=0)box.expandByScalar((cell.swing+margin*l.mesh.bindMatrix.getMaxScaleOnAxis())*(qLengthSq>1.000001?1+4*qLengthSq:1.00001)*l.pose.outer.getMaxScaleOnAxis());
            if(box.distanceToPoint(center)>radius){if((++checked&63)===0&&performance.now()>=deadline){nextFace=0;nextCell++;return;}continue;}
          }
          for(;nextFace<cell.faces.length;nextFace++){
            face(l,cell.faces[nextFace],cap,out);
            if((++checked&31)===0&&performance.now()>=deadline){nextFace++;return;}
          }
        }
      }
      nextCell=nextFace=0;nextLayer=(nextLayer+1)%layers.length;
      if(performance.now()>=deadline)break;
    }while(nextLayer!==startLayer);
  }
  return {warm,query};
}
