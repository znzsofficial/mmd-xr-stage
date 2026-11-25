import {Vector3} from 'three';

// Centroids of actual indexed material triangles. Each term is the sum, for
// this bone, of (bind vertex * skin weight / 3, skin weight / 3). Transforming
// these terms gives exactly the centroid of the three LBS vertices in the lab.
export function makeFaceSamples(mesh,rig){
  const {geometry:g}=mesh,{position,skinIndex,skinWeight}=g.attributes,ix=g.index;
  const mid=new Vector3(),a=new Vector3(),b=new Vector3(),c=new Vector3(),p=new Vector3();let top=-Infinity,bottom=Infinity;
  for(const n of rig.nodes){mid.add(n.rest);top=Math.max(top,n.rest.y);bottom=Math.min(bottom,n.rest.y);}mid.multiplyScalar(1/rig.nodes.length);
  const bins=new Map(),mats=[].concat(mesh.material);
  for(const gr of g.groups){if(!mats[gr.materialIndex]?.visible||mats[gr.materialIndex].opacity<.001)continue;
    for(let k=gr.start;k<gr.start+gr.count;k+=3){const ids=[ix.getX(k),ix.getX(k+1),ix.getX(k+2)];
      a.fromBufferAttribute(position,ids[0]);b.fromBufferAttribute(position,ids[1]);c.fromBufferAttribute(position,ids[2]);p.copy(a).add(b).add(c).multiplyScalar(rig.scale/3);
      const h=(top-p.y)/Math.max(.001,top-bottom),ang=Math.atan2(p.x-mid.x,p.z-mid.z);if(h<-.08||h>1.25)continue;
      let free=0;for(const id of ids)for(let j=0;j<4;j++){const n=rig.nodes[rig.byBone.get(skinIndex.getComponent(id,j))];if(n&&!n.pin)free+=skinWeight.getComponent(id,j)/3;}
      if(free<.55)continue;const score=b.sub(a).cross(c.sub(a)).lengthSq()*free;if(score<1e-14)continue;
      const key=gr.materialIndex*1024+Math.floor((ang+Math.PI)*5)*16+Math.max(0,Math.min(15,Math.floor(h*14)));
      if(!bins.has(key)||score>bins.get(key).score)bins.set(key,{k,ids,score});
    }}
  const candidates=[...bins.values()],limit=Math.min(640,candidates.length),faces=Array.from({length:limit},(_,i)=>candidates[Math.floor(i*candidates.length/limit)]);
  const terms=[],heads=[],byNode=rig.nodes.map(()=>[]);
  for(const [i,{ids}] of faces.entries()){
    const sum=new Map();for(const id of ids){p.fromBufferAttribute(position,id);
      for(let j=0;j<4;j++){const bone=skinIndex.getComponent(id,j),w=skinWeight.getComponent(id,j)/3;if(!w)continue;
        const t=sum.get(bone)??[0,0,0,0];t[0]+=p.x*w;t[1]+=p.y*w;t[2]+=p.z*w;t[3]+=w;sum.set(bone,t);}}
    let invMass=0;heads.push([terms.length/8,sum.size]);for(const [bone,t] of sum){const node=rig.byBone.get(bone);terms.push(...t,bone,node??-1,0,0);
      if(node!=null&&!rig.nodes[node].pin){invMass+=t[3]**2;byNode[node].push([i,t[3]]);}}
    heads[i].push(invMass,0);
  }
  const refs=[],ranges=byNode.flatMap(list=>{const off=refs.length/2;for(const v of list)refs.push(...v);return [off,list.length];});
  return {faces,terms:new Float32Array(terms),heads:new Float32Array(heads.flat()),refs:new Float32Array(refs),ranges:new Uint32Array(ranges),corners:cornersForFinish(mesh,rig)};
}

// A sampled panel can carry a long pleat away from the proxy. At the actual
// skinned corners limit residual corrections by the shortest incident edge.
// Equal skin bindings at a UV split use the same cap, including across draws.
function cornersForFinish(mesh,rig){
  const g=mesh.geometry,{position:p,skinIndex:si,skinWeight:sw}=g.attributes,limits=new Map(),ids=new Map(),a=new Vector3(),b=new Vector3();
  function corner(i){if(ids.has(i))return ids.get(i);let mobile=0;const weights=[];for(let k=0;k<4;k++){const id=si.getComponent(i,k),w=sw.getComponent(i,k);if(!w)continue;weights.push(id+':'+w);const n=rig.nodes[rig.byBone.get(id)];if(n&&!n.pin)mobile+=w;}
    const key=mobile>0?[p.getX(i),p.getY(i),p.getZ(i),...weights.sort()].join(','):null;ids.set(i,key);if(key&&!limits.has(key))limits.set(key,{len:Infinity,mobile});return key;}
  for(const gr of g.groups){for(let k=gr.start;k<gr.start+gr.count;k+=3){for(let j=0;j<3;j++){const i=g.index.getX(k+j),t=g.index.getX(k+(j+1)%3),u=corner(i),v=corner(t);if(!u&&!v)continue;
    const len=a.fromBufferAttribute(p,i).distanceTo(b.fromBufferAttribute(p,t))*rig.scale;if(len<1e-6)continue;for(const key of [u,v])if(key){const info=limits.get(key);info.len=Math.min(info.len,len);}}}}
  const data=[];for(const [i,key] of ids){if(!key)continue;const {len,mobile}=limits.get(key);if(!Number.isFinite(len))continue;
    data.push(p.getX(i),p.getY(i),p.getZ(i),Math.min(.015,len*.30)*Math.min(1,mobile),...Array.from({length:4},(_,k)=>si.getComponent(i,k)),...Array.from({length:4},(_,k)=>sw.getComponent(i,k)),i,0,0,0);}
  return new Float32Array(data);
}
