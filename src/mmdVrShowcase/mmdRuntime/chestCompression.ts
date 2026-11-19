import {Matrix4,Vector3,type Bone,type SkinnedMesh} from 'three';
import type {TrackedPressure} from './trackedPressure';

const labels=(b:Bone)=>[b.userData.mmdBoneName,b.name,b.userData.mmdEnglishBoneName].filter((s):s is string=>typeof s==='string').map(s=>s.normalize('NFKC').toLowerCase().replace(/[ _.\-]/g,''));
function below(b:Bone,p:Bone){for(let n=b.parent;n;n=n.parent)if(n===p)return true;return false;}
function depth(b:Bone){let n=0;for(let p=b.parent;p;p=p.parent)n++;return n;}
type Pad={bone:Bone;center:Vector3;radius:number;offset:Vector3;goal:Vector3;raw:Vector3;rawScale:Vector3;target:Vector3;squeeze:number;axis:0|1|2;leaf:boolean;changed:boolean};

/** Display-only response of dedicated weighted chest bones. Arm capsules are
 * read-only probes. Raw local transforms are restored before VMD/Bullet sees them. */
export function fitChestCompression(mesh:SkinnedMesh){
  const {bones,boneInverses}=mesh.skeleton;if(!bones.length||bones.length!==boneInverses.length)return null;
  const ns=bones.map(labels),find=(...keys:string[])=>{for(const key of keys){const i=ns.findIndex(x=>x.includes(key));if(i>=0)return bones[i];}};
  const torso=find('上半身2','upperchest','chest')??find('上半身','upperbody');if(!torso)return null;
  const arms:{upper:Bone;lower:Bone;hand:Bone;finger?:Bone;points:Vector3[]}[]=[];
  for(const [jp,en] of [['左','left'],['右','right']]){
    const upper=find(jp+'腕',en+'arm',en+'upperarm'),lower=find(jp+'ひじ',jp+'肘',en+'elbow',en+'forearm',en+'lowerarm'),hand=find(jp+'手首',en+'wrist',en+'hand');
    if(!upper||!lower||!hand||!below(upper,torso)||!below(lower,upper)||!below(hand,lower))return null;
    const finger=find(jp+'中指1',en+'middle1',en+'middlefinger1');arms.push({upper,lower,hand,finger:finger&&below(finger,hand)?finger:undefined,points:Array.from({length:4},()=>new Vector3())});
  }
  const bind=(i:number)=>boneInverses[i].clone().invert(),rest=(b:Bone)=>new Vector3().setFromMatrixPosition(bind(bones.indexOf(b)));
  const l=rest(arms[0].upper),r=rest(arms[1].upper),width=l.distanceTo(r),mid=l.add(r).multiplyScalar(.5);
  if(!Number.isFinite(width)||width<1e-5)return null;
  const pads:Pad[]=[],torsoInverse=boneInverses[bones.indexOf(torso)],front=new Vector3(0,0,1).transformDirection(torsoInverse);
  const named=/(?:[左右]胸|[左右]乳|breast|bust|乳房)/i;
  const rigid=mesh.userData.mmdPhysics?.rigidBodies??[];
  // No invented attachment on a rigid torso. Reject bones which move an arm
  // or the head, even if a translated bone name happens to match.
  const neck=find('首','neck','頭','head');
  for(let i=0;i<bones.length;i++){
    const bone=bones[i],body=rigid.find((b:{boneIndex:number;name?:string})=>b.boneIndex===i&&named.test(b.name??''));
    if((!body&&!ns[i].some(s=>named.test(s)))||!below(bone,torso)||arms.some(a=>bone===a.upper||below(a.upper,bone)||below(bone,a.upper))||(neck&&(bone===neck||below(neck,bone)||below(bone,neck))))continue;
    const pos=rest(bone);if(body?.position?.every(Number.isFinite))pos.set(body.position[0],body.position[1],-body.position[2]);
    if(Math.abs(pos.x-mid.x)>.58*width||pos.y>mid.y+.1*width||pos.y<mid.y-.88*width||Math.abs(pos.z-mid.z)>.95*width)continue;
    const radius=Math.min(.36*width,Math.max(.14*width,Number(body?.size?.[0])||.23*width));
    const axis=new Vector3(0,0,1).transformDirection(boneInverses[i]);
    pads.push({bone,center:pos.applyMatrix4(boneInverses[i]),radius,offset:new Vector3(),goal:new Vector3(),raw:new Vector3(),rawScale:new Vector3(),target:new Vector3(),squeeze:0,axis:Math.abs(axis.x)>Math.max(Math.abs(axis.y),Math.abs(axis.z))?0:Math.abs(axis.y)>Math.abs(axis.z)?1:2,leaf:true,changed:false});
  }
  if(!pads.length||pads.length>24)return null;
  pads.sort((a,b)=>depth(a.bone)-depth(b.bone));for(const p of pads)p.leaf=!pads.some(c=>below(c.bone,p.bone));
  const inverse=new Matrix4(),parentInverse=new Matrix4(),center=new Vector3(),seg=new Vector3(),dir=new Vector3(),v=new Vector3(),nearest=new Vector3();
  const worldCenter=new Vector3(),handDir=new Vector3();
  let previous=NaN;
  return {
    restore(){for(const p of pads)if(p.changed){p.bone.position.copy(p.raw);p.bone.scale.copy(p.rawScale);p.bone.updateWorldMatrix(false,true);p.changed=false;}},
    reset(){previous=NaN;for(const p of pads){p.offset.set(0,0,0);p.squeeze=0;}},
    apply(seconds:number,physicsDt=0,reseed=false,armContact=true,hands?:TrackedPressure){
      const jump=reseed||!Number.isFinite(previous)||seconds<previous||seconds-previous>.25;
      const dt=jump?0:Math.min(.05,Math.max(0,physicsDt,seconds-previous));previous=seconds;
      inverse.copy(torso.matrixWorld).invert();
      const visualScale=torso.matrixWorld.getMaxScaleOnAxis();
      if(armContact)for(const {upper,lower,hand,finger,points:q} of arms){
        q[0].setFromMatrixPosition(upper.matrixWorld).applyMatrix4(inverse);q[1].setFromMatrixPosition(lower.matrixWorld).applyMatrix4(inverse);q[2].setFromMatrixPosition(hand.matrixWorld).applyMatrix4(inverse);
        if(finger)q[3].setFromMatrixPosition(finger.matrixWorld).applyMatrix4(inverse);else q[3].copy(q[2]).addScaledVector(v.subVectors(q[2],q[1]),.2);
      }
      // Read all undeformed centers first. Each target is absolute, so nested
      // bones don't add a parent's displacement again to the child's.
      for(const p of pads){center.copy(p.center).applyMatrix4(p.bone.matrixWorld).applyMatrix4(inverse);let penetration=0;
        if(armContact)for(const {points:q} of arms)for(let i=0;i<3;i++){
          seg.subVectors(q[i+1],q[i]);const t=Math.max(0,Math.min(1,v.subVectors(center,q[i]).dot(seg)/Math.max(1e-12,seg.lengthSq())));
          nearest.copy(q[i]).addScaledVector(seg,t);const d=p.radius+width*(i===0?.10:i===1?.085:.08)-nearest.distanceTo(center);
          if(d>penetration){penetration=d;dir.subVectors(center,nearest);}
        }
        if(hands?.mask && visualScale>0){
          worldCenter.copy(center).applyMatrix4(torso.matrixWorld);
          const depth=hands.overlap(worldCenter,p.radius*visualScale,handDir)/visualScale;
          if(depth>penetration){penetration=depth;dir.copy(handDir).transformDirection(inverse);}
        }
        const push=Math.min(p.radius*.50,penetration*.90),squash=Math.min(.22,penetration/p.radius*.38);
        if(push){dir.normalize();const anterior=dir.dot(front);dir.addScaledVector(front,-Math.max(0,anterior)-.55).normalize();p.goal.copy(dir).multiplyScalar(push);}else p.goal.set(0,0,0);
        const alpha=jump?1:-Math.expm1(-dt/(squash>p.squeeze?.024:.085));p.offset.lerp(p.goal,alpha);p.squeeze+=(squash-p.squeeze)*alpha;
        if(!push&&p.offset.lengthSq()<width*width*1e-10&&p.squeeze<.0001){p.offset.set(0,0,0);p.squeeze=0;}
        p.raw.copy(p.bone.position);p.rawScale.copy(p.bone.scale);
        p.target.setFromMatrixPosition(p.bone.matrixWorld).applyMatrix4(inverse).add(p.offset).applyMatrix4(torso.matrixWorld);
      }
      let changed=false;for(const p of pads){if(!p.squeeze&&!p.offset.lengthSq())continue;
        p.bone.position.copy(p.target).applyMatrix4(parentInverse.copy(p.bone.parent!.matrixWorld).invert());
        if(p.leaf){p.bone.scale.multiplyScalar(1+p.squeeze*.16);p.bone.scale.setComponent(p.axis,p.rawScale.getComponent(p.axis)*(1-p.squeeze));}
        p.changed=true;p.bone.updateWorldMatrix(false,true);changed=true;
      }return changed;
    },
    affectedBones:pads.map(p=>p.bone),
  };
}
