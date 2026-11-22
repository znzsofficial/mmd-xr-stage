import { Box3, Triangle, Vector3, type Material, type Mesh, type Object3D, type SkinnedMesh } from 'three';
import { createWandPose } from '../play/wandPose';
import type { WandModel } from '../play/wandSurface';
import { materialSlotKey, sourceMaterialSlot } from '../mmdRuntime/materialSlotKey';
import {pelvicRailTravel} from './path';
import {PELVIC_LIMITS} from './stateTypes';
import type { PelvicFrame } from './contract';

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
const chunksPerSample=128,trianglesPerSample=1400,maxPoseValues=131072;

/** Preindex topology ONCE in bounded slices. Cull only ordinary linear blends
 * by the union of transformed rest boxes (all weights are convex). SDEF, QDEF
 * and active morph positions are tested in the actual displayed pose. A scan
 * of immutable PMX topology may span samples, but never different poses. */
export function createGarmentGuard(root:Object3D,surface?:WandModel|null){
  const layers:Layer[]=[], chunks:Chunk[]=[],bodies:Body[]=[];
  function add(mesh:Mesh,source:SkinnedMesh|null,proxies:readonly SkinnedMesh[]=[]){
    const g=mesh.geometry,pos=g?.attributes.position;if(!pos)return;
    const total=g.index?.count??pos.count,oversize=pos.count>450_000||total>2_400_000;
    let pose:ReturnType<typeof createWandPose>|null=null,body:Body|undefined;
    const sourceMaterials=source?[source.material].flat():[mesh.material].flat();
    const range=(owner:Object3D,m:Material|undefined,start:number,end:number,localIndex=0)=>{
      if(!m||end<=start)return;
      const i=sourceMaterialSlot(owner,sourceMaterials,m,localIndex),author=sourceMaterials[i]??m;
      if(!garment(m)&&(author===m||!garment(author)))return;
      const key=materialSlotKey(author,i);
      if(source&&!oversize)pose??=createWandPose(mesh as SkinnedMesh,source);
      if(!body)bodies.push(body={mesh,source,bones:new Set(),shown:false});
      layers.push({body,mesh,owner,material:m,key,start,end:Math.min(total,end),pose,oversize,invalid:false,shown:false});
    };
    if(proxies.length&&g.drawRange.count===0){for(const p of proxies){const {start,count}=p.geometry.drawRange;
      range(p,Array.isArray(p.material)?p.material[0]:p.material,start,start+count);}return;}
    const {start,count}=g.drawRange;
    if(Array.isArray(mesh.material)){for(const group of g.groups)range(mesh,mesh.material[group.materialIndex??0],Math.max(start,group.start),Math.min(start+count,group.start+group.count),group.materialIndex??0);}
    else range(mesh,mesh.material,start,start+count);
  }
  if(surface){for(const body of (surface.mesh.userData.mmdMorphSplitBodyMeshes??[surface.mesh]) as SkinnedMesh[])
    add(body,surface.mesh,body===surface.mesh?surface.renderOrderMeshes:[]);}
  else root.traverse(o=>{const m=o as SkinnedMesh;if(m.isMesh)add(m,m.isSkinnedMesh?m:null);});
  const p=new Vector3(),a=new Vector3(),b=new Vector3(),c=new Vector3(), tri=new Triangle(a,b,c);
  const world=new Box3(),tmp=new Box3(),zone=new Box3(),worldZone=new Box3();
  function* build(){for(const layer of layers){if(layer.oversize)continue;const {mesh,start,end}=layer,g=mesh.geometry,{position,skinIndex,skinWeight,matricesSdefEnabled:sdef,matricesQdefEnabled:qdef}=g.attributes;
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
  function restart(){cursor=0;blocker=null;}
  function probe(frame:PelvicFrame):Obstruction{
    changed=false;at=0;finite=true;let any=false;
    for(const body of bodies)body.shown=false;
    for(const l of layers){const shown=rendered(l);if(l.shown!==shown){changed=true;l.shown=shown;}
       if(shown){if(l.oversize||l.invalid){restart();return 'unverified';}l.body.shown=true;any=true;}}
    if(!any){restart();return;}
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
    if(blocker)return 'garment';
    if(cursor===chunks.length)return;
    // A short exterior approach plus the recessed seat, in calibrated metres.
    // A lifted skirt well above this volume does not veto a clear port.
     const r=frame.radiusM;zone.min.set(-r,-r,-.35*r);zone.max.set(r,r,Math.max(.075*frame.scale,2*r,-pelvicRailTravel(frame,PELVIC_LIMITS.position[0])));
    worldZone.copy(zone).applyMatrix4(frame.world);
    let current:Layer|null=null,tested=0,visited=0;
    for(;cursor<chunks.length;cursor++){if(++visited>chunksPerSample)return 'unverified';
      const chunk=chunks[cursor],{layer:l}=chunk;if(!l.shown)continue;
      if(l!==current){current=l;l.pose?.begin();}
      const g=l.mesh.geometry;
      if(chunk.linear&&(l.pose?!l.pose.active.length:!l.mesh.morphTargetInfluences?.some(x=>x!==0))){
        world.makeEmpty();if(chunk.bones.length&&l.pose){for(const i of chunk.bones)world.union(tmp.copy(chunk.rest).applyMatrix4(l.pose.bone(i).world));}
        else world.copy(chunk.rest).applyMatrix4(l.mesh.matrixWorld);
        if(!world.intersectsBox(worldZone))continue;
      }
      // Stop at a chunk boundary. No partially examined chunk counts toward a
      // clear result; even a frame of all broad-phase rejects has bounded work.
      tested+=(chunk.end-chunk.start)/3;if(tested>trianglesPerSample)return 'unverified';
      for(let j=chunk.start;j+2<chunk.end;j+=3){
        for(let k=0;k<3;k++){const i=g.index?.getX(j+k)??j+k,out=k===0?a:k===1?b:c;
          if(l.pose)l.pose.vertex(i,out);else l.mesh.getVertexPosition(i,out).applyMatrix4(l.mesh.matrixWorld);
           out.applyMatrix4(frame.inverse);if(!Number.isFinite(out.x+out.y+out.z)){restart();return 'unverified';}}
        // Treat patterned/cutout garments conservatively, including backfaces.
         if(zone.intersectsTriangle(tri)){blocker=l;return 'garment';}
      }
    }
  }
  return Object.assign(probe,{garmentNames:[...new Set(layers.map(l=>l.key))],blockerName:()=>blocker?.key});
}
