import {Euler, Vector3} from 'three';
import {GRIP_RADIUS,trackedGrip} from './handMotion.js';
import {fitCoatBodies} from './coatFit.js';
const skirt=/skirt|裙|スカート/i;
const xyz=()=>new Vector3();
// The loader passes these 16-bit inclusion masks straight to Bullet. An invalid
// group must not alias a real one through JavaScript's modulo-32 shift.
const contactPair=(a,b)=>a.group>=0&&a.group<16&&b.group>=0&&b.group<16&&
  (a.mask&(1<<b.group))!==0&&(b.mask&(1<<a.group))!==0;

// One node per authored dynamic garment bone. Edges follow the actual PMX
// joints and skeleton, never infer neighbours from material names or UV seams.
export function fitRig(mesh){
  const {bones,boneInverses}=mesh.skeleton,{rigidBodies:bodies,joints}=mesh.userData.mmdPhysics??{};
  const fromBind=mesh.bindMatrix.clone().invert();
  if(!bodies?.length||!joints?.length)throw Error('这个模型没有可对照的刚体和关节');
  const bindPosition=i=>xyz().setFromMatrixPosition(boneInverses[i].clone().invert()).applyMatrix4(fromBind);
  const scale=.1, nodes=[],byBone=new Map(),byBody=new Map();
  const namedSkirts=bodies.map(b=>b.mode.startsWith('dynamic')&&bones[b.boneIndex]&&skirt.test([b.name,b.englishName,bones[b.boneIndex].name].join(' ')));
  const coats=namedSkirts.some(Boolean) ? undefined : fitCoatBodies(mesh,bodies,joints,bindPosition);
  bodies.forEach((b,i)=>{if(!namedSkirts[i]&&!coats?.has(i))return;if(byBone.has(b.boneIndex))throw Error('暂不支持同一裙骨绑定多个动态体');
    const index=nodes.length;byBone.set(b.boneIndex,index);byBody.set(i,index);
    nodes.push({bone:b.boneIndex,group:b.group,mask:b.mask,rest:bindPosition(b.boneIndex).multiplyScalar(scale),pin:false,adj:new Map()});});
  if(nodes.length<4||nodes.length>4096)throw Error('需要 4–4096 个可识别的动态裙骨');
  // A differently named dynamic body driving a fitted bone cannot remain in
  // Bullet alongside GPU displacement. Reject this rig instead of cutting it.
  if(bodies.some((b,i)=>b.mode.startsWith('dynamic')&&byBone.has(b.boneIndex)&&!byBody.has(i)))throw Error('裙骨与其他动态刚体共用');
  function edge(a,b,k){if(a===b||nodes[a].rest.distanceToSquared(nodes[b].rest)<1e-10)return;for(const [u,v] of [[a,b],[b,a]])if(!nodes[u].adj.has(v))nodes[u].adj.set(v,k);}
  for(const joint of joints){const a=byBody.get(joint.rigidBodyIndexA),b=byBody.get(joint.rigidBodyIndexB);
    if(a!=null&&b!=null)edge(a,b,1);else if(a!=null||b!=null){const other=bodies[a!=null?joint.rigidBodyIndexB:joint.rigidBodyIndexA];if(other?.mode==='static')nodes[a??b].pin=true;}}
  for(const [i,n] of nodes.entries()){const p=byBone.get(bones.indexOf(bones[n.bone].parent));if(p==null)n.pin=true;else edge(i,p,1);}
  const first=nodes.map(n=>[...n.adj.keys()]);for(let i=0;i<nodes.length;i++)for(const j of first[i])for(const k of first[j])if(i!==k)edge(i,k,.22);
  if(!nodes.some(n=>!n.pin&&n.adj.size)||!nodes.some(n=>n.pin))throw Error('无法识别相连的腰口和活动裙摆');
  const rest=new Float32Array(nodes.length*4),headers=new Uint32Array(nodes.length*4),links=[],lookup=new Uint32Array(bones.length);
  nodes.forEach((n,i)=>{rest.set([...n.rest.toArray(),Number(!n.pin)],4*i);headers.set([links.length/4,n.adj.size],4*i);lookup[n.bone]=i+1;
    for(const [j,k] of n.adj)links.push(j,n.rest.distanceTo(nodes[j].rest),k,0);});
  const capsules=[];
  for (const b of bodies){if(b.mode!=='static'||!bones[b.boneIndex]||!['sphere','capsule'].includes(b.shape)||!nodes.some(n=>!n.pin&&contactPair(n,b)))continue;
    if(capsules.length===62)throw Error('这个模型的身体碰撞体超出实验上限');
    // YXZ matches the pinned loader's legacyMmdEulerToQuaternion components.
    // Convert the authored centre and both endpoints from PMX left-handed space.
    const mid=new Vector3(...b.position),v=new Vector3(0,b.shape==='capsule'?b.size[1]/2:0,0).applyEuler(new Euler(...b.rotation,'YXZ'));
    const a=mid.clone().sub(v),c=mid.clone().add(v);a.z*=-1;c.z*=-1;
    const intoBone=boneInverses[b.boneIndex].clone().multiply(mesh.bindMatrix);
    capsules.push({a:a.applyMatrix4(intoBone),b:c.applyMatrix4(intoBone),bone:bones[b.boneIndex],r:b.size[0]*scale+.004,group:b.group,mask:b.mask});}
  // headers.zw: eligible slots in contactPacket order (up to 62 authored + two
  // unconditional hands). Bake once; moving a collider never changes its slot.
  nodes.forEach((n,i)=>{for(let k=0;k<capsules.length+2;k++)if(k>=capsules.length||contactPair(n,capsules[k]))headers[4*i+2+(k>>>5)]|=1<<(k&31);});
  const leaves=nodes.filter(n=>!n.pin&&!bones[n.bone].children.some(c=>byBone.has(bones.indexOf(c))));
  const hem=leaves.sort((a,b)=>(b.rest.z-.45*Math.abs(b.rest.x))-(a.rest.z-.45*Math.abs(a.rest.x)))[0];
  if(!hem)throw Error('没有可识别的前裙末端');let anchor=bones[hem.bone];while(byBone.has(bones.indexOf(anchor)))anchor=anchor.parent;
  if(!anchor?.isBone)throw Error('没有可用的裙腰父骨');
  const hemLocal=hem.rest.clone().multiplyScalar(1/scale).applyMatrix4(mesh.bindMatrix).applyMatrix4(boneInverses[bones.indexOf(anchor)]);
  return {scale,nodes,byBone,rest,headers,links:new Float32Array(links),lookup,capsules,hem:nodes.indexOf(hem),anchor,hemLocal};
}

// Filter the physics step input, not just the rendered bones. Keep skeleton
// indices stable. Remap both ends of retained joints AND any impulse morphs.
export function skirtPhysicsFilter(rig){
  let source,js,kept,map,filtered,complete;
  return c=>{
    if(!c.rigidBodies)return c;
    if(source!==c.rigidBodies||js!==c.joints){
      source=c.rigidBodies;js=c.joints;map=new Int32Array(source.length).fill(-1);kept=[];
      const found=new Set();let duplicate=false;
      for(const [i,b] of source.entries()){
        if(b.motionType==='static'||!rig.byBone.has(b.boneIndex)){
          map[i]=kept.length;kept.push({...b,index:kept.length});
        }else{
          duplicate ||= found.has(b.boneIndex);found.add(b.boneIndex);
        }
      }
      complete=!duplicate&&found.size===rig.byBone.size;
      filtered=(js??[]).filter(j=>map[j.rigidBodyIndexA]>=0&&map[j.rigidBodyIndexB]>=0)
        .map((j,index)=>({...j,index,rigidBodyIndexA:map[j.rigidBodyIndexA],rigidBodyIndexB:map[j.rigidBodyIndexB]}));
    }
    // A rebind can supply a different set of valid external bodies. Fail
    // closed: don't let GPU displace half a rig and Bullet drive the other half.
    if(!complete)return c;
    return {...c,rigidBodies:kept,joints:filtered,morphImpulses:c.morphImpulses?.length?c.morphImpulses.filter(x=>map[x.rigidBodyIndex]>=0).map(x=>({...x,rigidBodyIndex:map[x.rigidBodyIndex]})):c.morphImpulses};
  };
}

export function skirtWorld(inner,rig,mode,counts){
  const filter=skirtPhysicsFilter(rig);
  return {name:'cloth-lab',disabled:false,get disposed(){return inner.disposed;},reset:c=>inner.reset(c),dispose:()=>inner.dispose(),step(c){
    const selected=mode()==='bullet'?c:filter(c);
    counts.bodies=selected.rigidBodies?.length??0;counts.joints=selected.joints?.length??0;
    return inner.step(selected);
  }};
}

export function contactPacket(rig,hands,buffer,worldToMesh,handMetric=1){
  const v=xyz();let i=0;
  for(const c of rig.capsules){for(let off=0;off<=4;off+=4){
    v.copy(off?c.b:c.a).applyMatrix4(c.bone.matrixWorld);if(worldToMesh)v.applyMatrix4(worldToMesh);v.multiplyScalar(rig.scale).toArray(buffer,i+off);
  }buffer[i+3]=c.r;i+=8;}
  for(let side=0;side<2;side++){const hand=hands?.[side];if(trackedGrip(hand))v.copy(hand);else v.set(0,-100,0);
    v.toArray(buffer,i);buffer[i+3]=GRIP_RADIUS*handMetric;v.toArray(buffer,i+4);i+=8;}
  return i/8;
}
