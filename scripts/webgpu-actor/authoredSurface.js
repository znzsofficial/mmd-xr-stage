import {authoredSurface} from '../../src/mmdVrShowcase/play/authoredSurface';
import {hasDisplayedPositionOffset,positionMorphs} from './positionMorphs.js';

// The egg and wand use the same index space as the TSL compute dispatch. Keep
// the original attributes; read PMX offsets only if a surface query needs them.
export function bindAuthoredSurface(mesh,position,uv,bytes,rig,clothActive){
  const {skinIndex,skinWeight}=mesh.geometry.attributes;
  const meta=mesh.userData.mmdMorphs??[];
  const uvIndices=meta.flatMap((m,i)=>m.type==='uv'?[i]:[]);
  let morphs,unknown=!bytes;
  const drawable=new Set(),sparsePosition=mesh.geometry.attributes.position!==position && mesh.userData.mmdTslSparsePositionMorphs;
  function readMorphs(){
    if(morphs)return morphs;
    morphs=[];
    if(bytes)try{
      const seen=sparsePosition?new Uint32Array(position.count):null;
      for(const m of positionMorphs(bytes,position.count)){
        if(seen&&hasDisplayedPositionOffset(m,seen))drawable.add(m.index);
        let rows;
        function read(i,axis){
          if(!rows){rows=new Map();for(let row=0;row<m.count;row++)rows.set(m.vertex(row),row);}
          const row=rows.get(i);return row===undefined?0:m.component(row,axis);
        }
        morphs[m.index]={count:position.count,getX:i=>read(i,0),getY:i=>read(i,1),getZ:i=>-read(i,2)};
      }
    }catch{morphs=[];drawable.clear();unknown=true;}
    return morphs;
  }
  const active=i=>!!mesh.morphTargetInfluences?.[i];
  const source={position,uv,get morphs(){return readMorphs();},get morphIndices(){readMorphs();return drawable;},sampleable(ids,material){
    if(unknown&&meta.some((m,i)=>m.type==='vertex'&&active(i)))return false;
    if(material&&(material.transparent||material.alphaTest)&&uvIndices.some(active))return false;
    if(!rig||!clothActive())return true;
    return ids.every(i=>{for(let k=0;k<4;k++)if(skinWeight.getComponent(i,k)>0&&rig.lookup[skinIndex.getComponent(i,k)])return false;return true;});
  }};
  authoredSurface.set(mesh,source);
  return source;
}
