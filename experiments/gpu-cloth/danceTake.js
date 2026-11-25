import {Vector3} from 'three';

// A short paired take, in visible seconds. Both solvers get the same VMD
// segment and the exact same two palm paths, including their release order.
export function takeAt(t){
  if(t<4)return {phase:'dance',seconds:t};
  if(t<5)return {phase:'settle',seconds:4};
  if(t<6)return {phase:'lift',seconds:4};
  if(t<9)return {phase:'both',seconds:4};
  if(t<11.5)return {phase:'right',seconds:4};
  if(t<14)return {phase:'release',seconds:4};
  return {phase:'resume',seconds:4+Math.min(t-14,4)};
}
export const takeLength=18;
// Pair complete one-second windows, not arbitrary averages over two runs.
// A held pose can produce several windows at the same VMD time: consume
// each reference at most once. Unmatched windows do not enter the result.
export function compareTake(rows,clip,round){
  const data=rows.filter(r=>r.clip===clip&&r.take===round),refs=data.filter(r=>r.mode==='bullet'),pairs=[];
  for(const g of data.filter(r=>r.mode==='gpu')){
    const j=refs.findIndex(b=>b.phase===g.phase&&b.kind===g.kind&&b.views===g.views&&b.dimensions===g.dimensions&&b.refreshHz===g.refreshHz&&
      g.poseSeconds?.every((s,i)=>Math.abs(b.poseSeconds?.[i]-s)<.15));
    if(j>=0)pairs.push([refs.splice(j,1)[0],g]);
  }
  return ['dance','both','right','release','resume'].flatMap(phase=>{
    const group=pairs.filter(([b])=>b.phase===phase);if(!group.length)return [];
    const median=i=>{const a=group.map(p=>p[i].intervalP95Ms).sort((a,b)=>a-b);return (a[a.length>>1]+a[(a.length-1)>>1])/2;};
    return [{phase,pairs:group.length,bulletP95:median(0),gpuP95:median(1)}];
  });
}
const smooth=t=>(t=Math.max(0,Math.min(t,1)),t*t*(3-2*t));
export function takePalms(sites,t,out){
  const palms=[null,null];if(!sites||t<4.6)return palms;
  for(let i=0;i<2;i++){
    const release=i?11.5:9;if(t>=release+.45)continue;
    const away=smooth((t-release)/.45);
    palms[i]=out[i].copy(sites[i]);palms[i].y+=-.36+.22*smooth((t-4.6)/.4)+.19*smooth(t-5)-.16*away;
    palms[i].x+=(i?1:-1)*.08*away;
  }
  return palms;
}

// Pick left/right lower-front corners on mobile fabric once in bind space.
// Freeze their actually skinned positions after the first solver settles. Do
// not retarget the hands to follow the candidate, or take a GPU readback.
export function hemSites(mesh,rig){
  const {position:p,skinWeight:w,skinIndex:b}=mesh.geometry.attributes,v=new Vector3();
  const pins=rig.nodes.filter(n=>n.pin),center=pins.reduce((a,n)=>a.add(n.rest),new Vector3()).divideScalar(pins.length);
  const scores=[Infinity,Infinity],ids=[-1,-1],mats=[].concat(mesh.material),target=rig.nodes[rig.hem].rest.y;
  for(const group of mesh.geometry.groups){if(!mats[group.materialIndex]?.visible||mats[group.materialIndex].opacity<=.001)continue;
    for(let k=group.start;k<group.start+group.count;k++){
      const id=mesh.geometry.index.getX(k);v.fromBufferAttribute(p,id).multiplyScalar(rig.scale).sub(center);
      const i=Number(v.x>0),r=Math.hypot(v.x,v.z);if(r<.04||v.z<=0||Math.abs(v.x)<.055)continue;
      const score=Math.abs(v.y+center.y-target)+r*(1-(Math.abs(v.x)*.7+v.z*.714)/r);
      if(score>=scores[i])continue;
      let mobile=0;for(let j=0;j<4;j++){const n=rig.nodes[rig.byBone.get(b.getComponent(id,j))];if(n&&!n.pin)mobile+=w.getComponent(id,j);}
      if(mobile>.6){scores[i]=score;ids[i]=id;}
    }
  }
  return ids.includes(-1)?null:()=>ids.map(id=>mesh.getVertexPosition(id,new Vector3()).multiplyScalar(rig.scale));
}
