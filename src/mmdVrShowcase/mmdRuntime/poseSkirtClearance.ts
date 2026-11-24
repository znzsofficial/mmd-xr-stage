import {BufferAttribute, Matrix3, Matrix4, Quaternion, Vector3, type Bone, type Material, type SkinnedMesh} from 'three';
import type {MmdModel} from '@yohawing/three-mmd-loader/parser';
import {ThighShell} from './thighShell';
import {fitClothStrain,type ClothPoint} from './clothStrain';
import {ClothCrossing} from './clothCrossing';
import {clothMorphGuard} from './clothMorphGuard';
import {fitRaisedSkirt} from './raisedSkirt';
import {fitKneelContact} from './kneelContact';

type Body=ReturnType<MmdModel['rigidBodies']>[number];
type Patch={mesh:SkinnedMesh; material:Material; positions:BufferAttribute; vertices:Vertex[]; faces:Vertex[]; touched:Vertex[]; shown:boolean; base:number};
type Vertex={index:number; rest:Vector3; shown:Vector3; posed:Vector3; direction:Vector3; extra:Vector3; localInverse:Matrix3; weld:number; transforms:Matrix4[]; weights:number[]; mask:number; gain:number;
  side:number; depth:number; near:boolean; gap:number; move:number; limit:number};
type Skin={mesh:SkinnedMesh; material:Material; faces:number[]; weighted:boolean[]; coverage:number};
type Fit={hip:number;knee:number; weights:Set<number>; colliders:Body[]; bind:Vector3; length:number; skin?:Skin};
type Shell={field:ThighShell;crossing:ClothCrossing;material:Material;toLocal:Matrix4;toModel:Matrix4;side:number;length:number};
const V=()=>new Vector3(), MAX_CLOTH=6500,MAX_FACES=6800;
const names=(b:Bone)=>[b.name,b.userData.mmdBoneName,b.userData.mmdEnglishBoneName].filter((v):v is string=>typeof v==='string').map(v=>v.normalize('NFKC').toLowerCase().replace(/[ _.-]/g,''));
const skirt=/skirt|スカート|裙/i,unrelated=/hair|髪|髮|裤|褲|trouser|pants/i;
const atBind=(mesh:SkinnedMesh,i:number)=>V().setFromMatrixPosition(mesh.skeleton.boneInverses[i].clone().invert());
const allows=(a:Body,b:Body)=>(a.mask&(1<<b.group))!==0&&(b.mask&(1<<a.group))!==0;
function uploadTouched({positions,touched}:Patch){
  if(!touched.length)return;
  let first=Infinity,end=0;
  for(const v of touched){first=Math.min(first,v.index*3);end=Math.max(end,v.index*3+3);}
  // Coalesce into any still-pending upload (occluded draws can stay off-camera
  // for many frames). Other display layers can own disjoint vertices too.
  for(const r of positions.updateRanges){first=Math.min(first,r.start);end=Math.max(end,r.start+r.count);}
  positions.clearUpdateRanges();positions.addUpdateRange(first,end-first);positions.needsUpdate=true;
}
function fitLegs(mesh:SkinnedMesh,raw:Body[]){
  const bones=mesh.skeleton.bones,labels=bones.map(names),legs:Fit[]=[];
  for(const side of ['left','right']){
    const prefix=side==='left'?'左':'右';
    const thighs=[prefix+'足',side+'thigh',side+'upleg',side+'upperleg'],knees=[prefix+'ひざ',prefix+'膝',side+'knee',side+'shin',side+'lowerleg'];
    const which=(keys:string[])=>labels.flatMap((all,i)=>all.some(s=>keys.includes(s)||s.endsWith('d')&&keys.includes(s.slice(0,-1)))?[i]:[]);
    const indices=which(thighs),hip=indices[0],knee=which(knees)[0];if(hip===undefined||knee===undefined)return null;
    const weights=new Set(indices),colliders=raw.filter(b=>b.mode==='static'&&weights.has(b.boneIndex));if(!colliders.length)return null;
    const bind=atBind(mesh,hip),length=atBind(mesh,knee).distanceTo(bind);if(!(length>1e-5&&Number.isFinite(length)))return null;
    legs.push({hip,knee,weights,colliders,bind,length});
  }
  return legs;
}

// Fit in bind space, once per mounted rig and only on explicit manual-pose
// reseeds. Negative fits are cached too. No scan on entry, playback or XR ticks.
export function fitPoseSkirt(mesh:SkinnedMesh){
  const raw:Body[]|undefined=mesh.userData.mmdPhysics?.rigidBodies,bones=mesh.skeleton.bones;
  if(!Array.isArray(raw)||raw.length>2400||bones.length>3000)return null;
  const legs=fitLegs(mesh,raw);if(!legs)return null;
  const skirts=new Map<number,number>();
  for(const b of raw){
    if(!bones[b.boneIndex]||(b.mode!=='dynamic'&&b.mode!=='dynamicBone'))continue;
    const label=[b.name,b.englishName,...names(bones[b.boneIndex])].join(' ');
    if(!skirt.test(label)||unrelated.test(label))continue;
    const mask=legs.reduce((m,l,i)=>m|(l.colliders.some(c=>allows(b,c))?1<<i:0),0);if(mask)skirts.set(b.boneIndex,mask);
  }
  if(skirts.size<3)return null;
  const pelvis=bones.findIndex(b=>names(b).some(n=>['下半身','lowerbody','hips','pelvis'].includes(n)));if(pelvis<0)return null;
  const materialList=[mesh.material].flat(),splits:SkinnedMesh[]=mesh.userData.mmdMorphSplitBodyMeshes??[];
  const bodies=splits.length?splits:[mesh];if(bodies.length>100)return null;
  const patches:Patch[]=[],palette=new Map<number,Matrix4>(),seen=new Set<BufferAttribute>();
  let work=0,cloth=0;
  const middle=legs[0].bind.clone().lerp(legs[1].bind,.5),length=(legs[0].length+legs[1].length)*.5;
  const bindP=V();
  for(const body of bodies){
    const g=body.geometry,{position,skinIndex:si,skinWeight:sw,matricesSdefEnabled:sdef,matricesQdefEnabled:qdef}=g.attributes,ix=g.index;
    if(!(position instanceof BufferAttribute)||!(position.array instanceof Float32Array)||!ix||si?.itemSize!==4||sw?.itemSize!==4||body.skeleton!==mesh.skeleton||!body.bindMatrix.equals(mesh.bindMatrix)||seen.has(position))return null;
    seen.add(position);
    if((work+=ix.count)>650000||g.groups.length>160)return null;
    const claimed=new Set<number>();
    for(const group of g.groups){
      const slot=body.userData.mmdMorphSplitBody?.materialIndex??group.materialIndex??0,material=materialList[slot];if(!material)continue;
      if(group.count>ix.count||group.start<0||group.start+group.count>ix.count)return null;
      const indices=new Set<number>();for(let k=group.start;k<group.start+group.count;k++)indices.add(ix.getX(k));
      const legWeights=[new Map<number,number>(),new Map<number,number>()],coverage=[new Uint8Array(24),new Uint8Array(24)];
      const patch:Patch={mesh:body,material,positions:position,vertices:[],faces:[],touched:[],shown:false,base:1};
      for(const i of indices){
        bindP.fromBufferAttribute(position,i);const h=(middle.y-bindP.y)/length;
        if(h<-.4||h>1.38||Math.hypot(bindP.x-middle.x,bindP.z-middle.z)>1.35*length)continue;
        let left=0,right=0,legL=0,legR=0,total=0;
        for(let j=0;j<4;j++){const w=sw.getComponent(i,j),bone=si.getComponent(i,j),mask=skirts.get(bone)??0;total+=w;
          if(mask&1)left+=w;if(mask&2)right+=w;if(legs[0].weights.has(bone))legL+=w;if(legs[1].weights.has(bone))legR+=w;}
        if(Math.abs(total-1)>.002||sdef?.getX(i)||qdef?.getX(i))continue;
        for(let side=0;side<2;side++){
          const w=side?legR:legL;if(w<.04)continue;
          legWeights[side].set(i,w);const l=legs[side],t=(l.bind.y-bindP.y)/l.length;
          if(w<.55||t<.06||t>=.9)continue;
          const angle=Math.atan2(bindP.z-l.bind.z,bindP.x-l.bind.x)+Math.PI;
          coverage[side][8*Math.min(2,Math.floor((t-.06)/.28))+(Math.floor(angle*4/Math.PI)%8)]=1;
        }
        const mask=(left>=.46?1:0)|(right>=.46?2:0);if(!mask||legL+legR>.001||claimed.has(i))continue;
        if(++cloth>MAX_CLOTH)return null;
        const v:Vertex={index:i,rest:bindP.clone(),shown:V(),posed:V(),direction:V(),extra:V(),localInverse:new Matrix3(),weld:-1,transforms:[],weights:[],mask,gain:Math.min(1,Math.max(left,right)/.8),
          side:0,depth:-Infinity,near:false,gap:.012,move:0,limit:1};
        for(let j=0;j<4;j++){const w=sw.getComponent(i,j);if(w<=0)continue;const bone=si.getComponent(i,j);if(!bones[bone])return null;
          let m=palette.get(bone);if(!m){m=new Matrix4();palette.set(bone,m);}v.transforms.push(m);v.weights.push(w);}
        patch.vertices.push(v);claimed.add(i);
      }
      if(patch.vertices.length){
        const map=new Map(patch.vertices.map(v=>[v.index,v]));
        for(let k=group.start;k<group.start+group.count;k+=3){const a=map.get(ix.getX(k)),b=map.get(ix.getX(k+1)),c=map.get(ix.getX(k+2));if(!a||!b||!c)continue;
          patch.faces.push(a,b,c);if(patch.faces.length>MAX_CLOTH*8)return null;
          // A point lying outside a convex leg does not imply that the chord
          // to its neighbour clears it. Allow extra space only within an
          // admitted patch, proportional to the local panel's edge length.
          const edge=Math.max(a.rest.distanceToSquared(b.rest),b.rest.distanceToSquared(c.rest),c.rest.distanceToSquared(a.rest))/(length*length);
          const gap=Math.min(.045,.012+edge/1.5);a.gap=Math.max(a.gap,gap);b.gap=Math.max(b.gap,gap);c.gap=Math.max(c.gap,gap);
        }
        patches.push(patch);
      }
      for(let side=0;side<2;side++){
        const count=coverage[side].reduce((n,x)=>n+x,0),l=legs[side];
        // A leg surface wraps the limb at several heights. A garter, a strip of
        // armour or a waistband alone cannot define the target exterior.
        if(count<18||count<=(l.skin?.coverage??0))continue;
        const faces:number[]=[],weighted:boolean[]=[],map=legWeights[side];
        for(let k=group.start;k<group.start+group.count;k+=3){const a=ix.getX(k),b=ix.getX(k+1),c=ix.getX(k+2);
          if(map.has(a)&&map.has(b)&&map.has(c)){faces.push(a,b,c);weighted.push(map.get(a)!+map.get(b)!+map.get(c)!>=1.5);}}
        if(faces.length>=48&&faces.length<=MAX_FACES*3)l.skin={mesh:body,material,faces,weighted,coverage:count};
      }
    }
  }
  if(!patches.length||legs.some(l=>!l.skin))return null;
  return poseLayer(mesh,legs,pelvis,patches,palette,skirts);
}

function poseLayer(mesh:SkinnedMesh,legs:Fit[],pelvis:number,patches:Patch[],palette:Map<number,Matrix4>,skirts:Map<number,number>){
  const {bones,boneInverses}=mesh.skeleton, shell:Shell[]=[];
  const checked=new Map<number,Matrix4>(),relevant=new Map<SkinnedMesh,Set<number>>();
  const addPoints=(body:SkinnedMesh,indices:Iterable<number>)=>{let ids=relevant.get(body);if(!ids)relevant.set(body,ids=new Set());for(const i of indices)ids.add(i);};
  for(const l of legs){const s=l.skin!;addPoints(s.mesh,s.faces);const g=s.mesh.geometry.attributes;
    for(const i of new Set(s.faces))for(let j=0;j<4;j++)if(g.skinWeight.getComponent(i,j)>0)checked.set(g.skinIndex.getComponent(i,j),new Matrix4());}
  const local=new Matrix4(),modelInverse=new Matrix4(),skinMat=new Matrix4(),inverse=new Matrix3(),delta=V(),normal=V(),q=V(),displace=V(),u=V(),w=V(),cross=V();
  // UV splits and coincident trim/lining with the *same* skin weights must
  // receive one displacement. Nearby folds and different bindings stay apart.
  const nodes:(ClothPoint&{mesh:SkinnedMesh;index:number;count:number;blocked:boolean})[]=[],welds=new Map<string,number>();
  const byMesh=new Map<SkinnedMesh,Map<number,Vertex>>();
  for(const patch of patches){let map=byMesh.get(patch.mesh);if(!map)byMesh.set(patch.mesh,map=new Map());
    const {skinIndex,skinWeight}=patch.mesh.geometry.attributes;
    for(const v of patch.vertices){map.set(v.index,v);const binding:string[]=[];
      for(let j=0;j<4;j++)if(skinWeight.getComponent(v.index,j))binding.push(`${skinIndex.getComponent(v.index,j)}:${skinWeight.getComponent(v.index,j)}`);
      const k=`${v.rest.x}/${v.rest.y}/${v.rest.z}/${binding.sort().join('/')}`;
      let id=welds.get(k);if(id===undefined){id=nodes.length;welds.set(k,id);nodes.push({p:V(),d:V(),movable:true,mesh:patch.mesh,index:v.index,count:0,blocked:false});}
      v.weld=id;nodes[id].count++;
    }
  }
  const movableCount=nodes.length,edges:{a:number;b:number;c:number}[]=[];
  for(const [body,map] of byMesh){const ix=body.geometry.index!,fixed=new Map<number,number>();
    const id=(i:number)=>{const admitted=map.get(i);if(admitted)return admitted.weld;let n=fixed.get(i);if(n!==undefined)return n;
      n=nodes.length;fixed.set(i,n);nodes.push({p:V(),d:V(),movable:false,mesh:body,index:i,count:0,blocked:true});return n;};
    for(let k=0;k<ix.count;k+=3){const a=ix.getX(k),b=ix.getX(k+1),c=ix.getX(k+2);if(map.has(a)||map.has(b)||map.has(c))edges.push({a:id(a),b:id(b),c:id(c)});}
  }
  const limitStrain=fitClothStrain(nodes,edges,i=>{const n=nodes[i];n.mesh.getVertexPosition(n.index,n.p);});
  const position=(v:Vertex,out:Vector3)=>out.copy(v.posed).addScaledVector(v.direction,v.move);
  for(const [body,map] of byMesh)addPoints(body,map.keys());
  for(const n of nodes)if(!n.movable)addPoints(n.mesh,[n.index]);
  const morph=clothMorphGuard(mesh,relevant,new Set(byMesh.keys()));
  const roll=fitRaisedSkirt(mesh,pelvis,legs.map(l=>l.hip),legs.map(l=>l.knee),skirts);
  function bindDisplacement(v:Vertex,base:number,d:Vector3){const e=skinMat.elements;e.fill(0);
    for(let j=0;j<v.weights.length;j++){const m=v.transforms[j].elements,w=v.weights[j];for(let k=0;k<12;k++)e[k]+=w*m[k];}
    inverse.setFromMatrix4(skinMat);if(Math.abs(inverse.determinant())<.08){d.set(0,0,0);return;}
    v.localInverse.copy(inverse).invert();if(base!==1)v.localInverse.multiplyScalar(1/base);
    if(!(delta.copy(d).applyMatrix3(v.localInverse).lengthSq()<(legs[0].length*.24)**2))d.set(0,0,0);
  }
  const kneel=fitKneelContact<Vertex>(mesh,pelvis,legs,skirts,patches,nodes,edges,(v,i,d)=>bindDisplacement(v,patches[i].base,d));
  // Bind-frame positions are authoritative. The same attribute is shared by
  // body/colour/shadow/outline draws; the CPU skin and the renderer see it too.
  let suspended=false,measured=false,kneelValid=false;
  function restorePositions(){if(suspended)return;for(const patch of patches)for(const {index,rest} of patch.touched)patch.positions.setXYZ(index,rest.x,rest.y,rest.z);suspended=true;}
  function restore(){roll?.restore();restorePositions();}
  function clear(){roll?.clear();restorePositions();for(const patch of patches){uploadTouched(patch);patch.touched.length=0;}shell.length=0;measured=false;}
  function boneToModel(i:number,m:Matrix4){return m.multiplyMatrices(modelInverse,bones[i].matrixWorld);}
  function seed(){
    clear();if(morph.blocked())return;
    modelInverse.copy(mesh.matrixWorld).invert();
    const pelvisDeform=boneToModel(pelvis,local).clone().multiply(boneInverses[pelvis]);
    for(let side=0;side<legs.length;side++){
      const l=legs[side],s=l.skin!;if(!s.material.visible||s.material.opacity<.04)continue;
      const hip=V().setFromMatrixPosition(boneToModel(l.hip,local)),knee=V().setFromMatrixPosition(boneToModel(l.knee,local));
      const y=knee.sub(hip).normalize(),restAxis=atBind(mesh,l.knee).sub(l.bind).transformDirection(pelvisDeform);
      if(y.dot(restAxis)>.968)continue; // straight/resting leg, including a rotated actor
      const x=V().set(1,0,0).transformDirection(boneToModel(l.hip,local).multiply(boneInverses[l.hip]));x.addScaledVector(y,-x.dot(y)).normalize();if(x.lengthSq()<.95)continue;
      const z=V().crossVectors(x,y),toModel=new Matrix4().makeBasis(x,y,z).scale(V().setScalar(l.length)).setPosition(hip),toLocal=toModel.clone().invert();
      const field=new ThighShell(),crossing=new ClothCrossing(),points=new Map<number,Vector3>();
      for(const i of new Set(s.faces))points.set(i,s.mesh.getVertexPosition(i,V()).applyMatrix4(toLocal));
      for(let i=0;i<s.faces.length;i+=3){const a=points.get(s.faces[i])!,b=points.get(s.faces[i+1])!,c=points.get(s.faces[i+2])!;
        field.add(a,b,c);if(s.weighted[i/3])crossing.add(a,b,c);}
      shell.push({field,crossing,material:s.material,toModel,toLocal,side,length:l.length});
    }
    for(const [i,m] of checked)boneToModel(i,m);
    if(shell.length===2)roll?.seed((side,deform)=>{
      const s=shell[side],l=legs[side],hip=V().setFromMatrixPosition(s.toModel),axis=V().set(0,1,0).transformDirection(s.toModel);
      const down=atBind(mesh,l.knee).sub(l.bind).transformDirection(deform),sweep=new Quaternion().setFromUnitVectors(down,axis),mid=l.bind.clone().lerp(legs[1-side].bind,.5);
      // The final thigh may already be above the fabric. Test its actual skin
      // through the raising arc against the originally hanging front sheet.
      for(const t of [0,.33,.67]){const turn=new Matrix4().makeRotationFromQuaternion(new Quaternion().slerp(sweep,t));
        const m=s.toLocal.clone().multiply(new Matrix4().makeTranslation(hip.x,hip.y,hip.z)).multiply(turn).multiply(new Matrix4().makeTranslation(-hip.x,-hip.y,-hip.z)).multiply(deform);
        for(const patch of patches){if(!patch.material.visible||patch.material.opacity<.04)continue;
          for(let i=0;i<patch.faces.length;i+=3){const a=patch.faces[i],b=patch.faces[i+1],c=patch.faces[i+2];if(!(a.mask&b.mask&c.mask&(1<<side)))continue;
            if((a.rest.x-mid.x)*(l.bind.x-mid.x)<0||(a.rest.z-mid.z)*(legs[0].bind.x-legs[1].bind.x)<0)continue;
            if(s.crossing.crosses(q.copy(a.rest).applyMatrix4(m),u.copy(b.rest).applyMatrix4(m),w.copy(c.rest).applyMatrix4(m)))return true;}}
      }return false;
    },shell);
    if(shell.length)kneel?.seed();
  }
  function present(){
    if(!shell.length)return;
    if(morph.blocked()||shell.some(s=>!legs[s.side].skin!.material.visible||legs[s.side].skin!.material.opacity<.04)){clear();return;}
    modelInverse.copy(mesh.matrixWorld).invert();
    for(const [i,m] of checked){const a=boneToModel(i,local).elements,b=m.elements;
      for(let k=0;k<16;k++)if(Math.abs(a[k]-b[k])>1e-4){clear();return;}}
    roll?.present();
    const contact=!roll?.active&&!!kneel?.valid();let unchanged=measured&&contact===kneelValid;kneelValid=contact;
    for(const [i,m] of palette){local.copy(mesh.bindMatrixInverse).multiply(bones[i].matrixWorld).multiply(boneInverses[i]).multiply(mesh.bindMatrix);
      if(unchanged&&!m.equals(local))unchanged=false;m.copy(local);}
    for(const patch of patches){const visible=patch.material.visible&&patch.material.opacity>=.04,b=morph.base(patch.mesh);if(patch.shown!==visible||patch.base!==b)unchanged=false;patch.shown=visible;patch.base=b;}
    if(unchanged){if(suspended)for(const patch of patches)for(const {index,shown} of patch.touched)patch.positions.setXYZ(index,shown.x,shown.y,shown.z);
      suspended=false;roll?.finish(true);return;}
    restorePositions();measured=true;
    for(let i=0;i<movableCount;i++){nodes[i].d.set(0,0,0);nodes[i].blocked=false;}
    let moved=false;
    for(const patch of patches){
      uploadTouched(patch);patch.touched.length=0;
      if(!patch.shown){for(const v of patch.vertices){const node=nodes[v.weld];node.blocked=true;patch.mesh.getVertexPosition(v.index,node.p);}continue;}
      for(const v of patch.vertices){
        const p=v.posed.set(0,0,0);for(let j=0;j<v.weights.length;j++)p.addScaledVector(q.copy(v.rest).applyMatrix4(v.transforms[j]),v.weights[j]);
        nodes[v.weld].p.copy(p);
        v.depth=-Infinity;v.move=0;v.limit=1;v.extra.set(0,0,0);
        for(const s of shell){if(!(v.mask&(1<<s.side)))continue;
          const depth=s.field.clearance(q.copy(p).applyMatrix4(s.toLocal),normal);
          if(depth>v.depth){v.depth=depth;v.side=s.side;v.direction.copy(normal).transformDirection(s.toModel);}
        }
        v.near=v.depth>.0015;
      }
      let crosses=false;
      for(let i=0;!crosses&&i<patch.faces.length;i+=3){const a=patch.faces[i],b=patch.faces[i+1],c=patch.faces[i+2];if(Math.max(a.depth,b.depth,c.depth)<-.065)continue;
        for(const s of shell)if(a.mask&b.mask&c.mask&(1<<s.side)){
          if(s.crossing.crosses(q.copy(a.posed).applyMatrix4(s.toLocal),u.copy(b.posed).applyMatrix4(s.toLocal),w.copy(c.posed).applyMatrix4(s.toLocal))){crosses=true;break;}}}
      // An independently drawn layer lying fully inside a garment/hip region
      // is not necessarily a visible penetration. Leave it exactly as drawn.
      if(!crosses){for(const v of patch.vertices)nodes[v.weld].blocked=true;continue;}
      for(let i=0;i<patch.faces.length;i+=3){const a=patch.faces[i],b=patch.faces[i+1],c=patch.faces[i+2];
        // Activate neighbouring exterior vertices only across an actual local
        // contact (or a penetrating triangle midpoint), never an entire ring.
        if(Math.max(a.depth,b.depth,c.depth)>.0015){a.near=b.near=c.near=true;continue;}
        if(Math.max(a.depth,b.depth,c.depth)<-.065)continue;
        const mask=a.mask&b.mask&c.mask;
        for(const s of shell){if(!(mask&(1<<s.side)))continue;
          q.copy(a.posed).add(b.posed).add(c.posed).multiplyScalar(1/3).applyMatrix4(s.toLocal);
          if(s.field.clearance(q,normal)>.002){a.near=b.near=c.near=true;break;}}
      }
      for(const v of patch.vertices){if(!v.near||v.depth<=-v.gap)continue;
        // Retain a little separation between the authored outer panel and
        // lining: depths on one side of the skin must not all collapse onto
        // exactly the same contact plane.
        const move=Math.min(.146,v.gap+v.depth+.009*(1-Math.min(1,Math.max(0,v.depth)/.14)))*legs[v.side].length*v.gain;
        if(!(move>0))continue;
        // Reject a push into the other thigh in a tightly closed/crossed pose.
        let opposed=false;for(const s of shell){if(s.side===v.side)continue;
          const start=s.field.clearance(q.copy(v.posed).applyMatrix4(s.toLocal),normal);
          const end=s.field.clearance(q.copy(v.posed).addScaledVector(v.direction,move).applyMatrix4(s.toLocal),normal);
          if(end>Math.max(.006,start+.004)){opposed=true;break;}}
        if(!opposed)v.move=move;
      }
      // Correct the *chord*, not just its endpoints. A spring grid's sparse
      // triangles can span the curved surface even when every vertex lies
      // outside. Give a short common translation to a triangle on contact;
      // adjoining faces share the largest local residual, never sum it.
      const midpoint=V();
      function residual(a:Vertex,b:Vertex,c:Vertex|null){
        const mask=a.mask&b.mask&(c?.mask??3);
        midpoint.copy(position(a,u)).add(position(b,w));if(c)midpoint.add(position(c,q));midpoint.multiplyScalar(c?1/3:.5);
        for(const s of shell){if(!(mask&(1<<s.side)))continue;
          const d=s.field.clearance(q.copy(midpoint).applyMatrix4(s.toLocal),normal);if(!(d>-.002))continue;
          const amount=Math.min(.053,d+.013)*s.length;
          displace.copy(normal).transformDirection(s.toModel).multiplyScalar(amount);
          if(a.extra.lengthSq()<amount*amount)a.extra.copy(displace);if(b.extra.lengthSq()<amount*amount)b.extra.copy(displace);
          if(c&&c.extra.lengthSq()<amount*amount)c.extra.copy(displace);
        }
      }
      for(let i=0;i<patch.faces.length;i+=3){const a=patch.faces[i],b=patch.faces[i+1],c=patch.faces[i+2];
        if(!(a.move||b.move||c.move))continue;
        residual(a,b,c);residual(a,b,null);residual(b,c,null);residual(c,a,null);
      }
      for(const v of patch.vertices){if(!v.extra.lengthSq())continue;
        delta.copy(v.direction).multiplyScalar(v.move).add(v.extra);v.move=Math.min(legs[v.side].length*.155,delta.length());v.direction.copy(delta).normalize();}
      for(let i=0;i<patch.faces.length;i+=3){const a=patch.faces[i],b=patch.faces[i+1],c=patch.faces[i+2];if(!(a.move||b.move||c.move))continue;
        u.subVectors(b.posed,a.posed);w.subVectors(c.posed,a.posed);cross.crossVectors(u,w);
        const e0=u.length(),e1=w.length(),e2=b.posed.distanceTo(c.posed);
        delta.copy(a.direction).multiplyScalar(a.move);u.addScaledVector(b.direction,b.move).sub(delta);w.addScaledVector(c.direction,c.move).sub(delta);
        // Back off a strongly reversed or overstretched fold, rather than
        // thinning a leg or moving an entire hem to make a metric look better.
        const pad=legs[0].length*.023;
        const flip=displace.crossVectors(u,w).dot(cross)<-.55*displace.length()*cross.length();
        if(u.length()>1.75*e0+pad||w.length()>1.75*e1+pad||u.distanceTo(w)>1.75*e2+pad||flip){
          a.limit=Math.min(a.limit,.87);b.limit=Math.min(b.limit,.87);c.limit=Math.min(c.limit,.87);}
      }
      for(const v of patch.vertices){if(!v.move)continue;nodes[v.weld].d.addScaledVector(v.direction,v.move*v.limit);moved=true;}
    }
    if(moved){
      for(let i=0;i<movableCount;i++){const n=nodes[i];if(n.blocked)n.d.set(0,0,0);else n.d.divideScalar(n.count);}
      // A point that cannot represent the proposed displacement in bind space
      // must be fixed BEFORE the face checks; dropping it afterwards would
      // invalidate the common cluster scale at its neighbours.
      for(const patch of patches)for(const v of patch.vertices){const d=nodes[v.weld].d;if(d.lengthSq())bindDisplacement(v,patch.base,d);}
      limitStrain();
    }
    if(roll?.active){
      // Bound-space seams share the same point. A hidden incident material
      // must not be pulled out through the visible part of the gathered hem.
      for(const patch of patches)for(const v of patch.vertices)nodes[v.weld].blocked=false;
      for(const patch of patches)if(!patch.shown)for(const v of patch.vertices)nodes[v.weld].blocked=true;
      for(const patch of patches)if(patch.shown)for(const v of patch.vertices){const n=nodes[v.weld];if(n.blocked)continue;n.blocked=true;
        delta.copy(n.d);roll.supportVertex(v.rest,n.p,delta);if(delta.equals(n.d))continue;
        n.d.copy(delta);moved=true;
      }
      // The belly fit can start a previously untouched seam. Each duplicate
      // needs its own absolute-morph factor and skin inverse before upload.
      for(const patch of patches)for(const v of patch.vertices){const d=nodes[v.weld].d;if(d.lengthSq())bindDisplacement(v,patch.base,d);}
    }else if(contact&&kneel?.present())moved=true;
    if(moved){
      for(const patch of patches){for(const v of patch.vertices){const d=nodes[v.weld].d;if(!d.lengthSq())continue;
          v.shown.copy(d).applyMatrix3(v.localInverse).add(v.rest);patch.positions.setXYZ(v.index,v.shown.x,v.shown.y,v.shown.z);patch.touched.push(v);}
        uploadTouched(patch);
      }
    }
    suspended=false;roll?.finish();
  }
  return {seed,present,restore,clear};
}
