import {Vector3} from 'three';
import {packSamples} from './faceSamples.js';

// Area coverage, including large triangles whose centre and all three bones
// miss a grip. Thin layers in the same bind-space cell share a representative;
// never manufacture a panel across a slit or connect two unconnected bones.
export const MAX_HAND_SAMPLES=2048;
export function makeHandSamples(mesh,rig){
  if(mesh.userData?.mmdTslSparsePositionMorphs!==undefined||mesh.geometry.attributes.position.isStorageBufferAttribute)throw Error('Hand surface fitting requires original PMX geometry before TSL attach');
  const g=mesh.geometry,{position,skinWeight,skinIndex}=g.attributes,mats=[].concat(mesh.material);
  const mobile=new Float32Array(position.count);
  for(let i=0;i<mobile.length;i++)for(let j=0;j<4;j++){
    const node=rig.nodes[rig.byBone.get(skinIndex.getComponent(i,j))];
    if(node&&!node.pin)mobile[i]+=skinWeight.getComponent(i,j);
  }
  let cell=.024,bins=new Map();const a=new Vector3(),b=new Vector3(),c=new Vector3(),ab=new Vector3(),ac=new Vector3();
  function keep(sample){
    const x=sample.x/cell,y=sample.y/cell,z=sample.z/cell,i=Math.floor(x),j=Math.floor(y),k=Math.floor(z),key=`${i},${j},${k}`;
    const dist=(x-i-.5)**2+(y-j-.5)**2+(z-k-.5)**2;
    if(!bins.has(key)||bins.get(key).dist>dist){sample.dist=dist;bins.set(key,sample);}
  }
  function coarsen(){const old=bins;bins=new Map();cell*=1.35;for(const s of old.values())keep(s);}
  for(const gr of g.groups){if(!mats[gr.materialIndex]?.visible||mats[gr.materialIndex].opacity<.001)continue;
    for(let k=gr.start;k<gr.start+gr.count;k+=3){
      const ids=[g.index.getX(k),g.index.getX(k+1),g.index.getX(k+2)],wa=mobile[ids[0]],wb=mobile[ids[1]],wc=mobile[ids[2]];
      if(Math.max(wa,wb,wc)<.25)continue;
      a.fromBufferAttribute(position,ids[0]).multiplyScalar(rig.scale);b.fromBufferAttribute(position,ids[1]).multiplyScalar(rig.scale);c.fromBufferAttribute(position,ids[2]).multiplyScalar(rig.scale);
      ab.subVectors(b,a);ac.subVectors(c,a);const longest=Math.max(ab.length(),ac.length(),b.distanceTo(c));
      if(!Number.isFinite(longest)||b.crossVectors(ab,ac).lengthSq()<1e-16)continue;
      // Centroids of both orientations of the n² sub-triangles (max 64).
      const n=Math.min(8,Math.max(1,Math.ceil(longest/.032)));
      const sample=(i,j)=>{const v=i/n,w=j/n,u=1-v-w;if(u*wa+v*wb+w*wc<.25)return;
        keep({ids,bary:[u,v,w],x:a.x+ab.x*v+ac.x*w,y:a.y+ab.y*v+ac.y*w,z:a.z+ab.z*v+ac.z*w});};
      for(let i=0;i<n;i++)for(let j=0;j<n-i;j++){sample(i+1/3,j+1/3);if(i+j+1<n)sample(i+2/3,j+2/3);}
      if(bins.size>MAX_HAND_SAMPLES*2)coarsen();
    }
  }
  while(bins.size>MAX_HAND_SAMPLES)coarsen();
  return packSamples(mesh,rig,[...bins.values()]);
}
