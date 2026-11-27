import {BufferAttribute,type SkinnedMesh} from 'three';
import {authoredSurface} from '../play/authoredSurface';
import type {PositionDeltas} from '../play/wandPose';

/** Classify a channel only when it first has weight. Normal-only, material,
 * face and lip channels cannot invalidate an unchanged leg/cloth position.
 * On an unsupported active channel, withdraw rather than reuse stale skin. */
export function clothMorphGuard(source:SkinnedMesh,relevant:Map<SkinnedMesh,Set<number>>,writes:Set<SkinnedMesh>){
  const base=new Map<SkinnedMesh,number>();
  const layers=Array.from(relevant,([mesh,ids])=>{
    const g=mesh.geometry,points=Int32Array.from(ids),position=g.attributes.position,relative=g.morphTargetsRelative;
    // The display temporarily edits the base attribute. Keep the unedited
    // reference for an absolute target instead of comparing against a shown hem.
    const rest=!relative&&g.morphAttributes.position?.length?Float64Array.from(points,i=>position.getX(i)):null;
    const restY=rest&&Float64Array.from(points,i=>position.getY(i)),restZ=rest&&Float64Array.from(points,i=>position.getZ(i));
    const sparse=authoredSurface.get(mesh);
    return {mesh,g,points,position,relative,rest,restY,restZ,sparse,cache:new Map<number,{attr:PositionDeltas;version:number;touches:boolean}>()};
  });
  function blocked(){let work=0;
    for(const {mesh,g,points,position,relative,rest,restY,restZ,cache,sparse} of layers){
      if(sparse&&!sparse.sampleable([]))return true;
      const targets=sparse?.morphs??g.morphAttributes.position,local=mesh.morphTargetInfluences;
      if(!targets?.length){base.set(mesh,1);continue;}
      if(relative!==g.morphTargetsRelative||targets.length>512||!local||local.length<targets.length)return true;
      const split=mesh!==source,remap=mesh.userData.mmdMorphSplitBody?.morphTargetIndices,global=source.morphTargetInfluences;
      if(split&&(!remap||remap.length!==targets.length))return true;
      let sum=0;
      for(let j=0;j<targets.length;j++){
        const w=local[j],k=split?remap[j]:j;
        if(!Number.isFinite(w)||split&&(!Number.isInteger(k)||k<0||(global&&k>=global.length)))return true;
        sum+=w;
        if(!w&&(!split||!global?.[k]))continue;
        const attr=targets[j];if(sparse&&!attr)continue; // PMX bone, UV and material channels have no position rows
        if(!attr||attr.count!==position.count||!sparse&&(!(attr instanceof BufferAttribute)||attr.itemSize!==3))return true;
        const version=attr instanceof BufferAttribute?attr.version:0;
        let record=cache.get(j);
        if(record?.attr!==attr||record.version!==version){
          if((work+=points.length)>120_000)return true;
          let touches=false;
          for(let n=0;n<points.length;n++){const i=points[n],x=attr.getX(i),y=attr.getY(i),z=attr.getZ(i);
            if(!Number.isFinite(x+y+z)|| (relative ? x!==0||y!==0||z!==0 : !rest||x!==rest[n]||y!==restY![n]||z!==restZ![n])){touches=true;break;}}
          record={attr,version,touches};cache.set(j,record);
        }
        if(record.touches)return true;
      }
      // Absolute targets blend (target-base). A face-only absolute channel
      // therefore still scales our edit of BASE by 1-sum(w). Compensate only
      // while the inverse is well conditioned; a full absolute shape owns it.
      const b=relative||!writes.has(mesh)?1:1-sum;if(!(b>=.5&&Number.isFinite(b)))return true;base.set(mesh,b);
    }
    return false;
  }
  return {blocked,base:(mesh:SkinnedMesh)=>base.get(mesh)??1};
}
