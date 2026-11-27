// Three original glTF signs. Two independent folders deliberately use the same
// buffer and texture basenames; their geometry and paint are different.
import {mkdir, writeFile} from 'node:fs/promises';
import {join} from 'node:path';
import {crc32, deflateSync} from 'node:zlib';

export const signs = [
  {name:'ruby.glb', width:.68, height:.86, channel:0, symbol:'+'},
  {name:'jade.gltf', width:.56, height:1.04, channel:1, symbol:'='},
  {name:'cobalt.gltf', width:.76, height:.74, channel:2, symbol:'×'},
];

function signPng({channel, symbol}) {
  const size=64, pixels=Buffer.alloc((1+size*3)*size);
  for(let y=0;y<size;y++)for(let x=0;x<size;x++) {
    const i=y*(1+size*3)+1+x*3, a=Math.abs(x-31.5), b=Math.abs(y-31.5);
    const ink=symbol==='+' ? Math.min(a,b)<5 : symbol==='=' ? Math.abs(b-9)<4 : Math.abs(a-b)<5;
    const white=ink && Math.max(a,b)<21;
    for(let c=0;c<3;c++)pixels[i+c]=white?248:c===channel?215:25;
  }
  function chunk(type, bytes){
    const out=Buffer.alloc(bytes.length+12);out.writeUInt32BE(bytes.length);out.write(type,4);bytes.copy(out,8);
    out.writeUInt32BE(crc32(out.subarray(4,-4)),out.length-4);return out;
  }
  const header=Buffer.alloc(13);header.writeUInt32BE(size);header.writeUInt32BE(size,4);header[8]=8;header[9]=2;
  return Buffer.concat([Buffer.from('89504e470d0a1a0a','hex'),chunk('IHDR',header),chunk('IDAT',deflateSync(pixels)),chunk('IEND',Buffer.alloc(0))]);
}

function glb(json, binary){
  const chunks=[[Buffer.from(JSON.stringify(json)),0x4e4f534a,32],[binary,0x004e4942,0]].map(([data,type,pad])=>{
    const size=Math.ceil(data.length/4)*4, out=Buffer.alloc(8+size,pad);
    out.writeUInt32LE(size);out.writeUInt32LE(type,4);data.copy(out,8);return out;
  });
  const header=Buffer.alloc(12);header.write('glTF');header.writeUInt32LE(2,4);header.writeUInt32LE(12+chunks[0].length+chunks[1].length,8);
  return Buffer.concat([header,...chunks]);
}

export async function writeSigns(folder) {
  for(const spec of signs){
    const {name,width:w,height:h}=spec, embedded=name.endsWith('.glb'), image=signPng(spec);
    const positions=Buffer.from(new Float32Array([-w/2,0,0,w/2,0,0,w/2,h,0,-w/2,h,0]).buffer);
    const uv=Buffer.from(new Float32Array([0,1,1,1,1,0,0,0]).buffer),indices=Buffer.from(new Uint16Array([0,1,2,0,2,3]).buffer);
    const geometry=Buffer.concat([positions,uv,indices]),data=embedded?Buffer.concat([geometry,image]):geometry;
    const json={asset:{version:'2.0'},scene:0,scenes:[{nodes:[0]}],nodes:[{name:name.split('.')[0],mesh:0}],
      meshes:[{primitives:[{attributes:{POSITION:0,TEXCOORD_0:1},indices:2,material:0}]}],
      accessors:[{bufferView:0,componentType:5126,count:4,type:'VEC3',min:[-w/2,0,0],max:[w/2,h,0]},
        {bufferView:1,componentType:5126,count:4,type:'VEC2'},{bufferView:2,componentType:5123,count:6,type:'SCALAR'}],
      bufferViews:[{buffer:0,byteLength:positions.length},{buffer:0,byteOffset:positions.length,byteLength:uv.length},
        {buffer:0,byteOffset:positions.length+uv.length,byteLength:indices.length}],
      buffers:[{byteLength:data.length,...(!embedded&&{uri:'../geometry/sign.bin'})}],
      materials:[{doubleSided:true,pbrMetallicRoughness:{baseColorTexture:{index:0},metallicFactor:0,roughnessFactor:1}}],
      textures:[{source:0}],images:[embedded?{bufferView:3,mimeType:'image/png'}:{uri:'../paint/sign%20face.png'}]};
    if(embedded){json.bufferViews.push({buffer:0,byteOffset:geometry.length,byteLength:image.length});await writeFile(join(folder,name),glb(json,data));}
    else {
      const root=join(folder,name.split('.')[0]);
      for(const dir of ['model','geometry','paint'])await mkdir(join(root,dir),{recursive:true});
      await Promise.all([writeFile(join(root,'model',name),JSON.stringify(json)),writeFile(join(root,'geometry','sign.bin'),geometry),writeFile(join(root,'paint','sign face.png'),image)]);
    }
  }
}
