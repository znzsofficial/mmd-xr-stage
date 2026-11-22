import { type Bone, type SkinnedMesh, Vector3 } from 'three';
import { wandMorphNames } from '../play/wandResponse';
import type { fitChestCompression } from '../mmdRuntime/chestCompression';
import type { BodySupport } from './store';
import { sampleBody, type BodyProfile } from './data';

type Settings = Pick<BodyProfile,'morph'|'fullness'|'compression'|'rebound'>;
type Chest = ReturnType<typeof fitChestCompression>;
const norm=(s:string)=>s.normalize('NFKC').toLowerCase().replace(/[\s_.\-]/g,'');
const labels=(b:Bone)=>[b.name,b.userData.mmdBoneName,b.userData.mmdEnglishBoneName].filter((s):s is string=>typeof s==='string').map(norm);
const chestName=/(?:[左右](?:胸|乳)|(?:胸|乳)[左右]|breast|bust)/;
const spine=/^(?:上半身[0-9]*|upperbody[0-9]*|upperchest|chest|spine[0-9]*)$/;
function descendant(b:Bone,parent:Bone){for(let o=b.parent;o;o=o.parent)if(o===parent)return true;return false;}

function weightedBones(mesh:SkinnedMesh, targets:readonly Bone[]){
  const wanted=new Set(targets.map(b=>mesh.skeleton.bones.indexOf(b))), found=new Set<Bone>();
  const bodies:SkinnedMesh[]=mesh.userData.mmdMorphSplitBodyMeshes??[mesh];
  for(const body of bodies){
    if(!wanted.size)break;
    const {skinIndex,skinWeight,position}=body.geometry.attributes;
    if(body.skeleton!==mesh.skeleton || !position || skinIndex?.itemSize!==4 || skinWeight?.itemSize!==4 ||
      position.count!==skinIndex.count || position.count!==skinWeight.count)continue;
    for(let i=0;i<position.count&&wanted.size;i++)for(let j=0;j<4;j++){
      const k=skinIndex.getComponent(i,j);
      if(wanted.has(k)&&skinWeight.getComponent(i,j)>.01){found.add(mesh.skeleton.bones[k]);wanted.delete(k);}
    }
  }
  return found;
}

/** A base shape is a reversible display layer BELOW pressure and ABOVE the
 * evaluated animation / manual morph overrides. Its storage is per mesh. */
export function createBodyDisplay(mesh:SkinnedMesh,chest:Chest){
  const {bones,boneInverses}=mesh.skeleton, morphs=wandMorphNames(mesh);
  // A rig with missing arm chains may still have an explicitly named, weighted
  // breast branch. Only accept a branch directly below a spine or another
  // dedicated breast bone. Never stretch the spine or an unrelated joint.
  const names=new Map(bones.map(b=>[b,labels(b)]));
  const named=(b:Bone,r:RegExp)=>names.get(b)?.some(s=>r.test(s));
  const isolated=(b:Bone):boolean=>b.children.every(c=>!(c as Bone).isBone || (named(c as Bone,chestName)&&isolated(c as Bone)));
  const fitted=chest?.affectedBones??[];
  const candidates=fitted.length?fitted:bones.filter(b=>{
    if(!named(b,chestName)||!isolated(b))return false;
    let p=b.parent as Bone|null;while(p&&named(p,chestName))p=p.parent as Bone|null;
    return !!p&&!!named(p,spine);
  });
  const weighted=weightedBones(mesh,candidates);
  const pads=[...weighted].filter(b=>![...weighted].some(p=>p!==b&&descendant(b,p))).map(b=>{
    const i=bones.indexOf(b),parent=bones.indexOf(b.parent as Bone), inv=boneInverses[parent];
    // For incomplete rigs fall back to the bind segment's own length.
    const extent=chest?.width??(inv&&boneInverses[i]?new Vector3().setFromMatrixPosition(boneInverses[i].clone().invert()).applyMatrix4(inv).length()*2:0);
    const shift=new Vector3(0,0,1);if(inv)shift.transformDirection(inv);
    shift.multiplyScalar(Number.isFinite(extent)?extent*.035:0);
    return {b,shift,pos:new Vector3(),scale:new Vector3()};
  });
  const sides={left:false,right:false};
  for(const p of chest?.sides??[])if(weighted.has(p.bone))sides[p.side]=true;
  const support:BodySupport={morphs,bones:pads.length>0,sides,clothing:'authored-only'};
  type Slot={weights:number[];index:number;raw:number};
  let slots:Slot[]=[], appliedBones=false, appliedMorph=false, current:Settings|null=null;
  function bind(name:string|null){
    slots=[];
    if(name===null || !morphs.includes(name))return;
    const i=mesh.morphTargetDictionary![name], source=mesh.morphTargetInfluences;
    if(!source||!Number.isFinite(source[i]))return;
    slots.push({weights:source,index:i,raw:0});
    const bodies:SkinnedMesh[]=mesh.userData.mmdMorphSplitBodyMeshes??[];
    for(const body of bodies){
      const weights=body.morphTargetInfluences, index=body.userData.mmdMorphSplitBody?.morphTargetIndices?.indexOf(i)??-1;
      if(weights && index>=0 && Number.isFinite(weights[index]) && !slots.some(s=>s.weights===weights&&s.index===index))slots.push({weights,index,raw:0});
    }
  }
  let bound:string|null=null;
  function restore(){
    if(appliedMorph){for(const s of slots)s.weights[s.index]=s.raw;appliedMorph=false;}
    if(appliedBones){for(const p of pads){p.b.position.copy(p.pos);p.b.scale.copy(p.scale);p.b.updateWorldMatrix(false,true);}appliedBones=false;}
  }
  return {support,restore,
    configure(profile:BodyProfile|null){
      const next=profile?{morph:profile.morph,fullness:sampleBody(profile).fullness,compression:profile.compression,rebound:profile.rebound}:null;
      if(current?.fullness===next?.fullness && current?.morph===next?.morph && current?.compression===next?.compression && current?.rebound===next?.rebound)return false;
      // Only change the desired input here. Pressure (and a possible wand
      // overlay) may still sit above this frame: unwind LIFO in update().
      current=next; return true;
    },
    get settings(){return current;},
    apply(){
      restore();
      if(!current||!current.fullness)return false;
      if(current.morph!==bound){bound=current.morph;bind(bound);}
      if(current.morph!==null){
        if(!slots.length)return false;
        const raw=slots[0].weights[slots[0].index], value=raw+Math.max(0,1-raw)*current.fullness;
        for(const s of slots){s.raw=s.weights[s.index];s.weights[s.index]=value;} appliedMorph=true;
        return false; // no bone palette upload
      }
      for(const p of pads){p.pos.copy(p.b.position);p.scale.copy(p.b.scale);
        p.b.position.addScaledVector(p.shift,current.fullness);p.b.scale.multiplyScalar(1+.08*current.fullness);p.b.updateWorldMatrix(false,true);}
      appliedBones=pads.length>0; return appliedBones;
    },
  };
}
