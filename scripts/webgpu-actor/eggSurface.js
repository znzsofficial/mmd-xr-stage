import {BufferAttribute,Matrix3,Vector3} from 'three';
import {attribute,positionLocal,uniform} from 'three/tsl';
import {positionMorphs} from './positionMorphs.js';

// Preserve the actual TSL cloth position node as the input to the wearable
// pass. Either owner can arrive first, or retire independently of the other.
const layers=new WeakMap();
export function underlyingPosition(material){return layers.has(material)?layers.get(material).base:material.positionNode;}
export function setUnderlyingPosition(material,node){
  const layer=layers.get(material);
  if(layer){layer.base=node;material.positionNode=(node??positionLocal).add(layer.offset);}
  else material.positionNode=node;
  material.needsUpdate=true;
}

/** Lazy: no additional material graph, vertex buffer or PMX morph index in
 * the normal room. Only parse active morphs, and only on their first query. */
export function makeEggSurface(mesh,position,uv,bytes,rig,clothActive){
  const g=mesh.geometry,delta=uniform(new Vector3()),inverse=new Matrix3();
  const offset=attribute('eggWearWeight','float').mul(delta),modified=new Set();
  let weights,previous,morphs,sparseUnknown=false;
  function attrs(){
    if(morphs)return morphs;morphs=[];
    try{if(bytes)for(const morph of positionMorphs(bytes,position.count)){
      let indices;function read(i,axis){if(!indices){indices=new Map();for(let row=0;row<morph.count;row++)indices.set(morph.vertex(row),row);}
        const row=indices.get(i);return row===undefined?0:morph.component(row,axis);}
      morphs[morph.index]={count:position.count,getX:i=>read(i,0),getY:i=>read(i,1),getZ:i=>-read(i,2)};
    }}catch{sparseUnknown=true;}
    return morphs;
  }
  function mount(patch){
    if(!weights){weights=new BufferAttribute(new Float32Array(position.count),1);g.setAttribute('eggWearWeight',weights);}
    if(previous)for(const i of previous.indices)weights.setX(i,0);
    patch.indices.forEach((i,k)=>weights.setX(i,patch.weights[k]));weights.needsUpdate=true;previous=patch;
    for(const group of g.groups){const material=[mesh.material].flat()[group.materialIndex??0];if(!material||modified.has(material))continue;
      let used=false;for(let j=group.start;j<group.start+group.count;j++){if(weights.getX(g.index?.getX(j)??j)>0){used=true;break;}}
      if(!used)continue;const base=material.positionNode;layers.set(material,{base,offset});modified.add(material);setUnderlyingPosition(material,base);
    }
  }
  return {position,uv,get morphs(){return attrs();},sampleable(ids){
    if((!bytes||sparseUnknown)&&mesh.morphTargetInfluences?.some((w,i)=>w&&mesh.userData.mmdMorphs[i]?.type==='vertex'))return false;
    if(!rig||!clothActive())return true;
    const {skinIndex,skinWeight}=g.attributes;return ids.every(i=>{for(let k=0;k<4;k++)if(skinWeight.getComponent(i,k)>0&&rig.lookup[skinIndex.getComponent(i,k)])return false;return true;});
  },apply(patch,worldDelta){if(previous!==patch)mount(patch);
    delta.value.copy(worldDelta).applyMatrix3(inverse.setFromMatrix4(mesh.matrixWorld).invert());
  },restore(){delta.value.set(0,0,0);},dispose(){
    for(const material of modified){const {base}=layers.get(material);layers.delete(material);setUnderlyingPosition(material,base);}modified.clear();
    if(weights){g.deleteAttribute('eggWearWeight');weights.dispose();}previous=null;
  }};
}
