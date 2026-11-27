import {isOutletMarker} from '../../src/mmdVrShowcase/bodyState/lactation/outletFit';
import {prepareMilkOutlets} from '../../src/mmdVrShowcase/bodyState/lactation/outlets';
import {positionMorphs} from './positionMorphs.js';

const missing=(_side,_point,_axis,_bare,detail)=>{if(detail)detail.state='missing';return false;};

export async function prepareFloorMilk(model,stale,bytes,clothActive){
  const {mesh}=model, metadata=mesh.userData.mmdMorphs;
  if(!bytes||!metadata?.some(m=>m.type==='vertex'&&(isOutletMarker(m.name)||isOutletMarker(m.englishName??''))))return missing;
  const count=mesh.geometry.attributes.position.count, attrs=[];
  if(count>200_000)return missing;
  try {
    let entries=0,deadline=performance.now()+4;
    for(const morph of positionMorphs(bytes,count)){
      if((entries+=morph.count)>1_200_000||metadata[morph.index]?.type!=='vertex')return missing;
      // The GPU packer selects the last authored offset of a repeated vertex.
      const rows=new Map();
      for(let i=0;i<morph.count;i++){
        if((i&4095)===0&&performance.now()>=deadline){
          await new Promise(resolve=>setTimeout(resolve,0));if(stale())return missing;
          deadline=performance.now()+4;
        }
        const v=morph.vertex(i);if(v>=count)return missing;rows.set(v,i);
      }
      const read=(v,axis)=>{const row=rows.get(v);return row===undefined?0:morph.component(row,axis);};
      attrs[morph.index]={count,vertices:Uint32Array.from(rows.keys()),getX:i=>read(i,0),getY:i=>read(i,1),getZ:i=>-read(i,2)};
    }
    const sample=await prepareMilkOutlets(model,stale,attrs);
    const uvIndices=metadata.flatMap((m,i)=>m.type==='uv'?[i]:[]);
    return (side,point,axis,bare,detail)=>{
      // GPU-only cloth displacement and moving opacity UVs aren't CPU skin
      // samples. Do not certify an uncovered port against a different pose.
      if(clothActive()||uvIndices.some(i=>mesh.morphTargetInfluences[i]!==0)){
        if(detail)detail.state='unverified';return false;
      }
      return sample(side,point,axis,bare,detail);
    };
  } catch {return missing;}
}
