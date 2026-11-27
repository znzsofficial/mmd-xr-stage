import {parsePmxSectionInventory} from '@yohawing/three-mmd-loader/parser';

// Match the sparse packer's last-row-wins rule; an empty morph or a channel
// consisting only of zero offsets is not a display control. Scan lazily on
// the first actor tool that requests the list, without building a dense atlas.
export function hasDisplayedPositionOffset(morph,seen){
  const stamp=morph.index+1;
  for(let row=morph.count-1;row>=0;row--){
    const i=morph.vertex(row);
    if(i>=seen.length||seen[i]===stamp)continue;
    seen[i]=stamp;
    if(morph.component(row,0)||morph.component(row,1)||morph.component(row,2))return true;
  }
  return false;
}

// Walk the same validated PMX that produced this unsplit mesh. No second PMX
// loader, dense morph atlas or dependency on a private loader symbol.
export function* positionMorphs(bytes, vertexCount) {
  const data=ArrayBuffer.isView(bytes)?new Uint8Array(bytes.buffer,bytes.byteOffset,bytes.byteLength):new Uint8Array(bytes);
  const {counts,header,sections}=parsePmxSectionInventory(data);
  if(counts.vertices!==vertexCount)throw Error('PMX vertex layout changed');
  const section=sections.find(s=>s.name==='morphs'), view=new DataView(data.buffer,data.byteOffset,data.byteLength);
  const ix=header.indexSizes, stride=[ix.morph+4,ix.vertex+12,ix.bone+28,...Array(5).fill(ix.vertex+16),ix.material+113,ix.morph+4,ix.rigidBody+25];
  let pos=section.offset;
  for(let index=0;index<counts.morphs;index++){
    for(let name=0;name<2;name++)pos+=4+view.getInt32(pos,true);
    const type=view.getUint8(pos+1), count=view.getInt32(pos+2,true);pos+=6;
    if(type===1){
      const start=pos;
      yield {index,count,vertex(row){
        const at=start+row*stride[1];
        return ix.vertex===4?view.getUint32(at,true):ix.vertex===2?view.getUint16(at,true):view.getUint8(at);
      },component(row,axis){return view.getFloat32(start+row*stride[1]+ix.vertex+axis*4,true);}};
    }
    pos+=stride[type]*count;
  }
  if(pos!==section.offset+section.byteLength)throw Error('PMX morph layout changed');
}
