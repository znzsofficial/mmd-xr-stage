import {Box3,Matrix4,Triangle,Vector3,type Material,type Object3D,type SkinnedMesh,type BufferGeometry} from 'three';
import {modelDrawRange} from '../../mmdRuntime/modelDrawRange';
import {createWandPose,type PositionMorphs} from '../wandPose';
import {visibleTexel} from '../wandOpacity';
import type {WandModel} from '../wandSurface';
import type {EggOffset,EggSite} from './remoteMotor';
import {eggUnitSize} from './eggSocket';

type Attr=BufferGeometry['attributes'][string];
export type EggPatch={indices:number[];weights:number[]};
/** The sparse renderer owns the original CPU attributes and its display offset. */
export type EggSurfaceBackend={position:Attr;uv:Attr;readonly morphs:PositionMorphs;
  sampleable(ids:number[]):boolean;apply(patch:EggPatch,worldDelta:Vector3):void;restore():void};
type Draw={mesh:SkinnedMesh;owner:Object3D;material:Material;start:number;end:number;position:Attr};
type Seat={draw:Draw;bary:Vector3;rest:Vector3;tri:Triangle;ids:number[]};
const v=()=>new Vector3();
const shown=(o:Object3D)=>{for(let p:Object3D|null=o;p;p=p.parent)if(!p.visible)return false;return true;};

/** Bind at a front-facing point on the authored outfit. Store the three actual
 * indices and barycentrics, then skin only those points for each display pose.
 * Never raycast the sparse output or the hidden, unsplit logical WebGL mesh. */
export function createEggSurface(model:WandModel,gpu?:EggSurfaceBackend){
  const draws:Draw[]=[],source=model.mesh,poses=new WeakMap<SkinnedMesh,ReturnType<typeof createWandPose>>();
  for(const mesh of (source.userData.mmdMorphSplitBodyMeshes??[source]) as SkinnedMesh[]){
    const g=mesh.geometry,position=gpu?.position??g.attributes.position;
    const total=g.index?.count??position.count;
    const add=(owner:Object3D,material:Material,start:number,end:number)=>{
      if(material&&!material.userData.mmdTslOutlineMaterial&&!material.userData.mmdShadowOnlyRenderProxy&&end>start)
        draws.push({mesh,owner,material,start,end:Math.min(total,end),position});
    };
    const r=modelDrawRange(mesh);
    if(mesh===source&&r.count===0&&model.renderOrderMeshes.length){for(const owner of model.renderOrderMeshes){const p=modelDrawRange(owner);add(owner,[owner.material].flat()[0],p.start,p.start+p.count);}}
    else if(Array.isArray(mesh.material)){for(const group of g.groups)add(mesh,mesh.material[group.materialIndex??0],Math.max(r.start,group.start),Math.min(r.start+r.count,group.start+group.count));}
    else add(mesh,mesh.material,r.start,r.start+r.count);
  }
  const bounds=source.geometry.boundingBox?.clone()??new Box3().setFromBufferAttribute((gpu?.position??source.geometry.attributes.position) as import('three').BufferAttribute);
  const center=bounds.getCenter(v()),restBone=(re:RegExp)=>{
    const i=source.skeleton.bones.findIndex(b=>[b.name,b.userData.mmdBoneName,b.userData.mmdEnglishBoneName].some(n=>typeof n==='string'&&re.test(n)));
    return i>=0?v().setFromMatrixPosition(source.skeleton.boneInverses[i].clone().invert()).applyMatrix4(source.bindMatrix.clone().invert()):null;
  };
  const hip=restBone(/^(下半身|hips?|pelvis|lower body)$/i),neck=restBone(/^(首|neck)$/i),ankle=restBone(/^(左足首|left ankle|ankle_l)$/i);
  const h=neck&&ankle?(neck.y-ankle.y)*1.28:bounds.max.y-bounds.min.y;
  const unit=eggUnitSize(model.root)*model.root.scale.x/source.matrixWorld.getMaxScaleOnAxis();
  const chest=v().set((neck??center).x+.050*h,neck?neck.y-.085*h:bounds.min.y+.73*h,0);
  const waist=v().set((hip??center).x+.012*h,hip?hip.y-.038*h:bounds.min.y+.51*h,0);
  const a=v(),b=v(),c=v(),point=v(),normal=v(),up=v(),right=v(),basis=new Matrix4(),motion=v(),localMotion=v(),bindMotion=v();
  let key='',candidates:Seat[]=[],active:Seat|undefined,patch:EggPatch={indices:[],weights:[]},before:number[]=[];
  let written:Attr|null=null,touching=false,seatWeight=0;
  function refit(site:EggSite,x:number,y:number){
    candidates=[];const target=site==='chest'?chest:waist,px=target.x+x,py=target.y+y;
    for(const draw of draws){const {position:p,mesh,material}=draw,g=mesh.geometry,index=g.index;
      for(let j=draw.start;j+2<draw.end;j+=3){
        const i0=index?.getX(j)??j,i1=index?.getX(j+1)??j+1,i2=index?.getX(j+2)??j+2;
        const ax=p.getX(i0),bx=p.getX(i1),cx=p.getX(i2);
        if(px<Math.min(ax,bx,cx)||px>Math.max(ax,bx,cx))continue;
        const ay=p.getY(i0),by=p.getY(i1),cy=p.getY(i2);
        const det=(by-cy)*(ax-cx)+(cx-bx)*(ay-cy);if(Math.abs(det)<1e-12)continue;
        const w0=((by-cy)*(px-cx)+(cx-bx)*(py-cy))/det,w1=((cy-ay)*(px-cx)+(ax-cx)*(py-cy))/det,w2=1-w0-w1;
        if(Math.min(w0,w1,w2)<-1e-6)continue;
        const tri=new Triangle(v().fromBufferAttribute(p,i0),v().fromBufferAttribute(p,i1),v().fromBufferAttribute(p,i2));
        const rest=v().set(px,py,w0*tri.a.z+w1*tri.b.z+w2*tri.c.z);
        if(!visibleTexel(material,g,j,tri,rest,gpu?.uv))continue;
        candidates.push({draw,bary:v().set(w0,w1,w2),rest,tri,ids:[i0,i1,i2]});
      }
    }
    candidates.sort((l,r)=>r.rest.z-l.rest.z);
  }
  function select(seat:Seat|undefined){
    if(active===seat)return;restore();active=seat;patch={indices:[],weights:[]};if(!seat)return;
    // Include coincident UV-seam vertices. Compact WebGL bodies have their
    // own vertex numbering; the unsplit TSL source has one shared numbering.
    const {position:p,mesh,start,end}=seat.draw,r=unit*.093,index=mesh.geometry.index,visited=new Set<number>();
    seatWeight=0;
    for(let j=start;j<end;j++){const i=index?.getX(j)??j;if(visited.has(i))continue;visited.add(i);
      const d=point.fromBufferAttribute(p,i).distanceToSquared(seat.rest)/(r*r);if(d>=1)continue;
      const weight=(1-d)**2;patch.indices.push(i);patch.weights.push(weight);
      const corner=seat.ids.indexOf(i);if(corner>=0)seatWeight+=weight*seat.bary.getComponent(corner);}
    axes(seat.tri.a,seat.tri.b,seat.tri.c,seat.tri);
    bindMotion.copy(up).multiplyScalar(.016).addScaledVector(right,.006).addScaledVector(normal,.006);
  }
  function axes(a:Vector3,b:Vector3,c:Vector3,tri:Triangle){
    right.subVectors(b,a);up.subVectors(c,a);normal.crossVectors(right,up).normalize();
    const dx1=tri.b.x-tri.a.x,dx2=tri.c.x-tri.a.x,dy1=tri.b.y-tri.a.y,dy2=tri.c.y-tri.a.y;
    const sign=Math.sign(dx1*dy2-dx2*dy1);normal.multiplyScalar(sign);
    up.multiplyScalar(dx1*sign).addScaledVector(right,-dx2*sign).normalize();right.crossVectors(up,normal).normalize();
  }
  function pose(group:Object3D,site:EggSite,cm:EggOffset,ratio:number,wave:number){
    touching=false;
    const scale=source.matrixWorld.getMaxScaleOnAxis()*ratio;if(!(scale>0&&unit>0))return false;
    // X/Y refit across the surface; Z is the physical standoff. Cache each
    // centimetre of calibration, independent of animation and motor time.
    const x=Math.round(cm[0])*.01/scale,y=Math.round(cm[1])*.01/scale,next=`${site}:${x.toFixed(4)}:${y.toFixed(4)}`;
    if(key!==next){key=next;refit(site,x,y);}
    select(candidates.find(({draw:d})=>shown(d.owner)&&d.material.visible&&d.material.colorWrite&&d.material.opacity>0&&d.material.opacity>=d.material.alphaTest));
    if(!active)return false;
    if(gpu&&!gpu.sampleable(active.ids))return false;
    const {draw,ids,bary,tri}=active;
    let skin=poses.get(draw.mesh);if(!skin){skin=createWandPose(draw.mesh,source,gpu?.morphs,draw.position);poses.set(draw.mesh,skin);}
    skin.begin();skin.vertex(ids[0],a);skin.vertex(ids[1],b);skin.vertex(ids[2],c);
    point.copy(a).multiplyScalar(bary.x).addScaledVector(b,bary.y).addScaledVector(c,bary.z);
    // The bind triangle's +Y tangent follows the displayed skin, even with
    // a rolled spine or asymmetric breast/cloth weights.
    axes(a,b,c,tri);
    if(right.lengthSq()<.9)return false;
    group.quaternion.setFromRotationMatrix(basis.makeBasis(right,up,normal));group.scale.setScalar(unit*scale);
    group.position.copy(point);if(ratio!==1){point.setFromMatrixPosition(model.root.matrixWorld);group.position.sub(point).multiplyScalar(ratio).add(point);}
    const contact=Math.max(0,1-Math.abs(cm[2])/(1.8*group.scale.x));
    touching=contact>0;
    motion.copy(up).multiplyScalar(.016).addScaledVector(right,.006).addScaledVector(normal,.006).multiplyScalar(wave*group.scale.x*contact);
    group.position.addScaledVector(normal,group.scale.x*.013+cm[2]*.01).addScaledVector(motion,seatWeight);group.visible=true;
    return true;
  }
  function apply(wave:number){
    if(!active||!wave||motion.lengthSq()===0)return;
    if(gpu){gpu.apply(patch,motion);return;}
    const p=active.draw.position;
    // Apply the same displacement in bind axes; skinning carries it through
    // VMD. Original positions can belong to another held-pose display layer.
    localMotion.copy(bindMotion).setLength(motion.length()/active.draw.mesh.matrixWorld.getMaxScaleOnAxis()*Math.sign(wave));
    written=p;before.length=0;
    patch.indices.forEach((id,k)=>{point.fromBufferAttribute(p,id);before.push(point.x,point.y,point.z);point.addScaledVector(localMotion,patch.weights[k]);p.setXYZ(id,point.x,point.y,point.z);});
    p.needsUpdate=true;
  }
  function restore(){gpu?.restore();if(!written)return;
    patch.indices.forEach((id,k)=>written!.setXYZ(id,before[k*3],before[k*3+1],before[k*3+2]));written.needsUpdate=true;written=null;
  }
  return {pose,apply,restore,get touching(){return touching;}};
}
