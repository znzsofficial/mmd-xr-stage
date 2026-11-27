import {writeFile} from 'node:fs/promises';
import {join} from 'node:path';
import {makeSwatch} from '../../experiments/gpu-cloth/swatch.js';

// Each actor has a different torso/garment pigment and their own real VMD.
// The torso, waist and both legs ride the authored lower-body translation.
export const cast=[
  {name:'cyan.pmx',   color:[.03,.83,.83], motion:'step-left.vmd',  delta:[-2,0,0]},
  {name:'magenta.pmx',color:[.83,.03,.83], motion:'step-up.vmd',    delta:[0,2,0]},
  {name:'amber.pmx',  color:[.83,.83,.03], motion:'step-right.vmd', delta:[2,0,0]},
];
function clip(delta){
  const keys=[0,30,60,90,120], file=Buffer.alloc(54+keys.length*111+5*4);
  file.write('Vocaloid Motion Data 0002');file.write('layout take',30);file.writeUInt32LE(keys.length,50);
  keys.forEach((frame,index)=>{
    const at=54+index*111;
    Buffer.from('89ba94bc9067','hex').copy(file,at); // 下半身 in the VMD's Shift-JIS name field.
    file.writeUInt32LE(frame,at+15);
    delta.forEach((v,i)=>file.writeFloatLE(index%2 ? v : 0,at+19+i*4));
    file.writeFloatLE(1,at+43);
    for(let i=0;i<64;i++)file[at+47+i]=i%16<8 ? 20 : 107;
  });return file;
}
export async function writeCast(folder){
  for(const {name,color,motion,delta} of cast){
    const swatch=makeSwatch([color,color,[.9,.82,.5]]);
    await writeFile(join(folder,name),new Uint8Array(await swatch.arrayBuffer()));await writeFile(join(folder,motion),clip(delta));
  }
}
