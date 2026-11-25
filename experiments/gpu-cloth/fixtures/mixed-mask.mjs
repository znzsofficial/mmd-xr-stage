import {encodeSwatch} from '../swatch.js';

// Four disconnected panels share the *same* hem position and bind length. In
// packet order: 60 far bodies, a near sphere, a near capsule, then both hands.
// Only the first hem may touch the sphere, only the second the capsule. Each
// other hem is accepted by one side only (in a different direction per body).
export function mixedMaskPmx(){
  const bone=[{name:'waist',p:[0,10,0],parent:-1}], body=[], joint=[], vertices=[], groups=[[],[],[]];
  function fixed(p,group,mask,h=0){body.push({name:'proxy '+body.length,b:0,p,r:.48,h,dyn:false,group,mask});}
  for(let k=0;k<60;k++)fixed([30+k,8,0],k%2?12:2,1<<(k%2?15:14));
  fixed([0,8,0],9,0xffff); // Nobody accepts this one, despite its position.
  fixed([-.22,8,0],2,1<<14);
  fixed([0,8,-.22],12,1<<15,.8);
  for(const [i,[group,accept]] of [[14,2],[15,12],[14,12],[15,2]].entries()){
    const top=[0,9,0],hem=[0,8,0],pin=bone.length,tip=pin+1;
    bone.push({name:`skirt pin ${i}`,p:top,parent:0},{name:`skirt hem ${i}`,p:hem,parent:pin});
    const a=body.length;
    body.push({name:`pin ${i}`,b:pin,p:top,r:.04,h:0,dyn:true,group:0,mask:0},
      {name:`hem ${i}`,b:tip,p:hem,r:.04,h:0,dyn:true,group,mask:1<<accept});
    joint.push([a,a+1,hem]);
    // One full-weight face per independent hem, in separate angular sample bins.
    const x=i%2?.18:-.18,z=i<2?.18:-.18;
    for(const [dx,dy] of [[-.06,-.03],[.06,-.03],[0,.06]]){
      groups[1].push(vertices.length);vertices.push({p:[x+dx,8+dy,z],normal:[0,0,1],b:tip});
    }
  }
  return encodeSwatch({bone,body,joint,vertices,groups},'mixed-mask.pmx');
}

// node experiments/gpu-cloth/fixtures/mixed-mask.mjs path/to/mixed-mask.pmx
if(import.meta.main){
  if(!process.argv[2])throw Error('Expected an output PMX path');
  const {writeFile}=await import('node:fs/promises');
  await writeFile(process.argv[2],new Uint8Array(await mixedMaskPmx().arrayBuffer()));
}
