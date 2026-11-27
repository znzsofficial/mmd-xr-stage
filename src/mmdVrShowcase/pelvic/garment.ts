import { Box3, Triangle, Vector3, type BufferGeometry, type Material, type Mesh, type Object3D, type SkinnedMesh } from 'three';
import { createWandPose } from '../play/wandPose';
import type { WandModel } from '../play/wandSurface';
import { materialSlotKeys, sourceMaterialSlot } from '../mmdRuntime/materialSlotKey';
import { modelDrawRange } from '../mmdRuntime/modelDrawRange';
import { garmentKeys } from '../wardrobe/slots';
import {pelvicRailTravel} from './path';
import {PELVIC_LIMITS} from './stateTypes';
import type { PelvicFrame } from './contract';
import {createGarmentPrint,halfX,halfY,type GarmentPrint} from './garmentPrint';
import {unionPosedBox} from './garmentBounds';

// A name/tag only selects surfaces to CHECK. It is never evidence of an
// uncovered entrance. Unknown/merged materials still require manual review.
const clothing=/pelvic[-_: ]?blocker|skirt|shorts|trouser|pants|panties|panty|underwear|leggings|tights|hosiery|stocking|pantyhose|bodysuit|swimsuit|leotard|bikini|dress|kimono|coat|スカート|パンツ|ぱんつ|ショーツ|ズボン|タイツ|ストッキング|インナー|レオタード|ワンピース|水着|下着|裙|褲|裤|裆|襠|连衣|連衣|泳装|泳裝|胖次|袜|襪|丝|絲/i;
const visible=(o:Object3D)=>{for(let n:Object3D|null=o;n;n=n.parent)if(!n.visible)return false;return true;};
function garment(m:Material){const meta=m.userData.mmdMaterial;
  return m.userData.pelvicBlocker===true||[m.name,meta?.name,meta?.englishName,meta?.memo].some(x=>typeof x==='string'&&clothing.test(x));}
type Body={mesh:Mesh;source:SkinnedMesh|null;bones:Set<number>;shown:boolean};
type Layer={body:Body;mesh:Mesh;owner:Object3D;material:Material;key:string;start:number;end:number;pose:ReturnType<typeof createWandPose>|null;oversize:boolean;invalid:boolean;shown:boolean};
type Chunk={layer:Layer;start:number;end:number;rest:Box3;bones:number[];linear:boolean};
export type Obstruction='garment'|'unverified'|undefined;
/** An unsplit sparse renderer supplies its original positions. No CPU reader
 * may infer the displayed positions from a GPU-only storage attribute. */
export type GarmentPose={position:BufferGeometry['attributes'][string];sampleable:()=>boolean};
const chunksPerSample=128,trianglesPerSample=1400,maxPoseValues=131072;

/** Preindex topology ONCE in bounded slices. Cull only ordinary linear blends
 * by the union of transformed rest boxes (all weights are convex). SDEF, QDEF
 * and active morph positions are tested in the actual displayed pose. A scan
 * of immutable PMX topology may span samples, but never different poses. */
export function createGarmentGuard(root:Object3D,surface?:WandModel|null,pose?:GarmentPose|null){
  const keys=()=>surface?garmentKeys(surface.mesh):undefined;
  let registered=keys(),guard=indexGarmentGuard(root,surface,registered,pose);
  const probe=Object.assign((frame:PelvicFrame,withPrint=false):Obstruction=>{
    if(pose===null||pose&&!pose.sampleable())return 'unverified';
    if(registered!==keys()){registered=keys();guard=indexGarmentGuard(root,surface,registered,pose);probe.garmentNames=guard.garmentNames;}
    return guard(frame,withPrint);
  },{blockerName:()=>guard.blockerName(),print:()=>guard.print(),printReady:()=>guard.printReady(),garmentNames:guard.garmentNames});return probe;
}
function indexGarmentGuard(root:Object3D,surface?:WandModel|null,registered?:ReadonlySet<string>,base?:GarmentPose|null){
  const layers:Layer[]=[], chunks:Chunk[]=[],bodies:Body[]=[];
  function add(mesh:Mesh,source:SkinnedMesh|null,proxies:readonly SkinnedMesh[]=[]){
    const g=mesh.geometry,pos=g?.attributes.position;if(!pos)return;
    const total=g.index?.count??pos.count,oversize=pos.count>450_000||total>2_400_000;
    let pose:ReturnType<typeof createWandPose>|null=null,body:Body|undefined;
    const sourceMaterials=source?[source.material].flat():[mesh.material].flat(),keys=materialSlotKeys(sourceMaterials);
    const range=(owner:Object3D,m:Material|undefined,start:number,end:number,localIndex=0)=>{
      if(!m||end<=start||m.userData.mmdTslOutlineMaterial)return;
      const i=sourceMaterialSlot(owner,sourceMaterials,m,localIndex),author=sourceMaterials[i]??m;
      const key=keys[i];if(!registered?.has(key)&&!garment(m)&&(author===m||!garment(author)))return;
      if(source&&!oversize)pose??=createWandPose(mesh as SkinnedMesh,source,undefined,base?.position);
      if(!body)bodies.push(body={mesh,source,bones:new Set(),shown:false});
      layers.push({body,mesh,owner,material:m,key,start,end:Math.min(total,end),pose,oversize,invalid:false,shown:false});
    };
    const {start,count}=modelDrawRange(mesh);
    if(proxies.length&&count===0){for(const p of proxies){const r=modelDrawRange(p);
      range(p,Array.isArray(p.material)?p.material[0]:p.material,r.start,r.start+r.count);}return;}
    if(Array.isArray(mesh.material)){for(const group of g.groups)range(mesh,mesh.material[group.materialIndex??0],Math.max(start,group.start),Math.min(start+count,group.start+group.count),group.materialIndex??0);}
    else range(mesh,mesh.material,start,start+count);
  }
  if(surface){for(const body of (surface.mesh.userData.mmdMorphSplitBodyMeshes??[surface.mesh]) as SkinnedMesh[])
    add(body,surface.mesh,body===surface.mesh?surface.renderOrderMeshes:[]);}
  else root.traverse(o=>{const m=o as SkinnedMesh;if(m.isMesh)add(m,m.isSkinnedMesh?m:null);});
  const p=new Vector3(),a=new Vector3(),b=new Vector3(),c=new Vector3(), tri=new Triangle(a,b,c);
  const world=new Box3(),tmp=new Box3(),zone=new Box3(),printZone=new Box3(),worldZone=new Box3();
  const center=new Vector3(),extent=new Vector3();
  // The three box-normal axes of intersectsTriangle, in its centered space.
  function sides(p:Vector3){const x=p.x-center.x,y=p.y-center.y,z=p.z-center.z;
    if(!Number.isFinite(x+y+z))return 0;
    return (x < -extent.x?1:x>extent.x?2:0)|(y < -extent.y?4:y>extent.y?8:0)|(z < -extent.z?16:z>extent.z?32:0);}
  function* build(){for(const layer of layers){if(layer.oversize)continue;const {mesh,start,end}=layer,g=mesh.geometry,{skinIndex,skinWeight,matricesSdefEnabled:sdef,matricesQdefEnabled:qdef}=g.attributes;
    const position=base?.position??g.attributes.position;
    for(let lo=start;lo<end;lo+=96){const hi=Math.min(lo+96,end),rest=new Box3(),bones=new Set<number>();let linear=true;
       for(let j=lo;j<hi;j++){const i=g.index?.getX(j)??j;rest.expandByPoint(p.fromBufferAttribute(position,i));
         if(!Number.isFinite(p.x+p.y+p.z))layer.invalid=true;
        const sdefVertex=(sdef?.getX(i)??0)>=.5;
        if(sdefVertex||(qdef?.getX(i)??0)>=.5)linear=false;
        if(skinIndex&&skinWeight&&layer.pose)for(let k=0;k<4;k++)if(skinWeight.getComponent(i,k)!==0||(k<2&&sdefVertex))bones.add(skinIndex.getComponent(i,k));}
      for(const i of bones)layer.body.bones.add(i);
      chunks.push({layer,start:lo,end:hi,rest,bones:[...bones],linear});yield;
    }
  }}
  const builder=build();let ready=layers.length===0;
  const rendered=(l:Layer)=>visible(l.owner)&&l.material.visible&&l.material.opacity>0&&l.material.colorWrite;
  // Compare numerical values, not matrix/array identities, hashes, animation
  // time or GPU upload versions. Bullet and morphs mutate these in place even
  // on a paused timeline. The source (not a split mesh) owns the morph weights.
  const previous:number[]=[];
  let cursor=0,blocker:Layer|null=null,changed=false,finite=true,at=0;
  function record(n:number){if(!Number.isFinite(n))finite=false;if(previous[at]!==n){previous[at]=n;changed=true;}at++;}
  function recordArray(a:ArrayLike<number>){for(let i=0;i<a.length;i++)record(a[i]);}
  let print:ReturnType<typeof createGarmentPrint>|undefined,wanted=false,published:GarmentPrint|null=null,printed=false,inkCursor=0;
  function clearPrint(){inkCursor=0;published=null;printed=false;print?.reset();}
  function restart(){cursor=0;blocker=null;clearPrint();}
  function probe(frame:PelvicFrame,withPrint=false):Obstruction{
    if(wanted!==withPrint){wanted=withPrint;clearPrint();if(wanted)print??=createGarmentPrint();}
    changed=false;at=0;finite=true;let any=false;
    for(const body of bodies)body.shown=false;
    for(const l of layers){const shown=rendered(l);if(l.shown!==shown){changed=true;l.shown=shown;}
       if(shown){if(l.oversize||l.invalid){restart();return 'unverified';}l.body.shown=true;any=true;}}
    if(!any){restart();printed=true;return;}
    if(!ready){const stop=performance.now()+.8;for(let i=0;i<chunksPerSample;i++){if(builder.next().done){ready=true;break;}if(performance.now()>=stop)break;}
       if(!ready||layers.some(l=>l.shown&&l.invalid))return 'unverified';}
    recordArray(frame.world.elements);recordArray(frame.inverse.elements);record(frame.radiusM);record(frame.lengthM);record(frame.scale);
    for(const body of bodies){if(!body.shown)continue;
      const {mesh,source,bones}=body,sk=mesh as SkinnedMesh,weights=(source??mesh).morphTargetInfluences;
      if(at+49+bones.size*32+(weights?.length??0)>maxPoseValues){restart();return 'unverified';}
      mesh.updateWorldMatrix(true,false);recordArray(mesh.matrixWorld.elements);
      record(weights?.length??0);if(weights)recordArray(weights);
      if(source){recordArray(sk.bindMatrix.elements);recordArray(sk.bindMatrixInverse.elements);
        for(const i of bones){const bone=sk.skeleton?.bones[i],inv=sk.skeleton?.boneInverses[i];
          if(!bone||!inv){restart();return 'unverified';}recordArray(bone.matrixWorld.elements);recordArray(inv.elements);}}
    }
    if(!finite||!(frame.radiusM>0&&frame.scale>0&&frame.lengthM>0)){restart();return 'unverified';}
    if(changed||previous.length!==at)restart();
    previous.length=at;
    if((blocker||cursor===chunks.length)&&(!wanted||printed))return blocker?'garment':undefined;
    // A short exterior approach plus the recessed seat, in calibrated metres.
    // A lifted skirt well above this volume does not veto a clear port.
     const r=frame.radiusM;zone.min.set(-r,-r,-.35*r);zone.max.set(r,r,Math.max(.075*frame.scale,2*r,-pelvicRailTravel(frame,PELVIC_LIMITS.position[0])));
    // The accessory print has its own cursor. Turning the attachment on must
    // never delay or invalidate a previously verified outlet or a running take.
    if(!blocker&&cursor<chunks.length&&!scan(false,zone,r,frame))return 'unverified';
    if(wanted&&!printed){printZone.min.set(-r*halfX,-r*halfY,-.35*r);printZone.max.set(r*halfX,r*halfY,zone.max.z);
      if(scan(true,printZone,r,frame)){print!.commit();published=print!.value;printed=true;}}
    return blocker?'garment':undefined;
  }
  function scan(ink:boolean,query:Box3,r:number,frame:PelvicFrame){
    worldZone.copy(query).applyMatrix4(frame.world);
    query.getCenter(center);extent.subVectors(query.max,center);
    const finiteExtent=Number.isFinite(extent.x+extent.y+extent.z);
    let current:Layer|null=null,tested=0,visited=0;
    for(let i=ink?inkCursor:cursor;i<chunks.length;i++){
      if(ink)inkCursor=i;else cursor=i;
      if(++visited>chunksPerSample)return false;
      const chunk=chunks[i],{layer:l}=chunk;if(!l.shown)continue;
      if(l!==current){current=l;l.pose?.begin();}
      const g=l.mesh.geometry;
      if(chunk.linear&&(l.pose?!l.pose.active.length:!l.mesh.morphTargetInfluences?.some(x=>x!==0))){
        world.makeEmpty();if(chunk.bones.length&&l.pose){for(const i of chunk.bones)unionPosedBox(world,chunk.rest,l.pose.bone(i).world,tmp);}
        else unionPosedBox(world,chunk.rest,l.mesh.matrixWorld,tmp);
        if(!world.intersectsBox(worldZone))continue;
      }
      // Stop at a chunk boundary. No partially examined chunk counts toward a
      // clear result; even a frame of all broad-phase rejects has bounded work.
      tested+=(chunk.end-chunk.start)/3;if(tested>trianglesPerSample)return false;
      for(let j=chunk.start;j+2<chunk.end;j+=3){
        for(let k=0;k<3;k++){const i=g.index?.getX(j+k)??j+k,out=k===0?a:k===1?b:c;
          if(l.pose)l.pose.vertex(i,out);else l.mesh.getVertexPosition(i,out).applyMatrix4(l.mesh.matrixWorld);
           out.applyMatrix4(frame.inverse);if(!Number.isFinite(out.x+out.y+out.z)){if(ink)clearPrint();else restart();return false;}}
        // Treat patterned/cutout garments conservatively, including backfaces.
        if(finiteExtent&&(sides(a)&sides(b)&sides(c)))continue;
        if(query.intersectsTriangle(tri)){if(!ink){blocker=l;return true;}print!.triangle(a,b,c,r);}
      }
    }
    if(ink)inkCursor=chunks.length;else cursor=chunks.length;return true;
  }
  return Object.assign(probe,{garmentNames:[...new Set(layers.map(l=>l.key))],blockerName:()=>blocker?.key,print:()=>published,printReady:()=>printed});
}
