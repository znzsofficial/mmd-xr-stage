import { BufferAttribute } from 'three';
import { prepareOutline } from './endfieldOutlineBake.js';
import { bakeSkinTransmission } from './skinTransmissionBake.js';

const types={Float32Array,Uint32Array,Uint16Array,Uint8Array};

// No renderer/TSL setup. Rehydrate only the accessors the CPU bakes read.
export async function bakeEndfieldGeometry(input) {
  const attributes={};
  for(const [name,{bytes,type,itemSize,normalized}] of Object.entries(input.attrs)){
    attributes[name]=new BufferAttribute(new types[type](await bytes.arrayBuffer()),itemSize,normalized);
  }
  const geometry={attributes,index:attributes.index,groups:input.groups,morphAttributes:{}};
  const mesh={geometry,userData:{mmdMorphs:input.morphs},morphTargetInfluences:{length:input.influences},material:[]};
  const {direction,height,stats}=prepareOutline(mesh,input.roles,{headBones:input.headBones,edges:input.edges,pmxBytes:await input.pmx?.arrayBuffer()});
  const outline={directions:direction?.array,height,stats};
  let skin=null;
  if(input.fingers?.scale){
    const {mask,active}=bakeSkinTransmission(geometry,input.skin,input.fingers);
    if(active)skin=mask;
  }
  return {outline,skin};
}

if(typeof self!=='undefined')self.onmessage=async({data})=>{
  try {
    const result=await bakeEndfieldGeometry(data);
    self.postMessage(result,[result.skin?.buffer,result.outline?.directions?.buffer].filter(Boolean));
  } catch {self.postMessage({failed:true});}
};
