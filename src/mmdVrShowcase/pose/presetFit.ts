import { Bone, Matrix4, Quaternion, Vector3, type SkinnedMesh } from 'three';
import type { bindPoseClip } from './poseClip';
import type { PosePresetId } from './presetCatalog';
import { presetShapes, type Direction } from './presetShapes';
import { createPresetSurface, type Region } from './presetSurface';

type Limb = {base:Bone; joint:Bone; tip:Bone; pole:Vector3};
type Key = 'leftHand' | 'rightHand' | 'leftFoot' | 'rightFoot';
const keys = ['leftFoot','rightFoot','leftHand','rightHand'] as const;
const sides = ['left','right'] as const;
const pos = (b:Bone) => b.getWorldPosition(new Vector3());
const rot = (b:Bone) => b.getWorldQuaternion(new Quaternion()).normalize();
const between = (a:Bone, b:Bone) => pos(b).sub(pos(a));
const within = (b:Bone, parent:Bone) => { for(let n = b;n?.isBone;n=n.parent as Bone) if(n===parent)return true; return false; };
function basis(axis:Vector3, towards:Vector3) {
  const x=axis.clone().normalize(), z=x.clone().cross(towards).normalize();
  return new Quaternion().setFromRotationMatrix(new Matrix4().makeBasis(x,z.clone().cross(x),z)).normalize();
}
function transport(a:Vector3,b:Vector3,to:Vector3,towards:Vector3) {
  if(a.clone().cross(b).lengthSq()<1e-12 || to.clone().cross(towards).lengthSq()<1e-12)
    return new Quaternion().setFromUnitVectors(a.clone().normalize(),to.clone().normalize());
  return basis(to,towards).multiply(basis(a,b).invert());
}

/** Reuse the editor's single private evaluator. Only the common skeleton
 * driver can translate; all other joints turn around their real pivots. */
export function fitPresets(source:SkinnedMesh, clip:ReturnType<typeof bindPoseClip>,
  limbs:Partial<Record<Key,Limb>>, head?:Bone, torso?:Bone, neck?:Bone) {
  if(!head||!torso||!keys.every(k=>limbs[k]))return null;
  const limb=limbs as Record<Key,Limb>, bones=clip.mesh.skeleton.bones, indices=new Map(bones.map((b,i)=>[b,i]));
  const body=[head,torso,...keys.map(k=>limb[k].base)];
  let driver:Bone=head;
  while(driver?.isBone&&!body.every(b=>within(b,driver)))driver=driver.parent as Bone;
  const joints=[head,torso,...keys.flatMap(k=>[limb[k].base,limb[k].joint,limb[k].tip])];
  if(!driver?.isBone || new Set(joints).size!==joints.length ||
    ![driver,...joints,...(neck?[neck]:[])].every(b=>clip.hasUniqueInput(indices.get(b)!)))return null;
  const bindInverse=source.bindMatrix.clone().invert();
  const rest=(b:Bone)=>new Vector3().setFromMatrixPosition(bindInverse.clone().multiply(source.skeleton.boneInverses[indices.get(b)!].clone().invert()));
  const hip=()=>pos(limb.leftFoot.base).lerp(pos(limb.rightFoot.base),.5);
  const home=rest(limb.leftFoot.base).lerp(rest(limb.rightFoot.base),.5);
  const left=rest(limb.leftFoot.base).sub(rest(limb.rightFoot.base));
  const shoulders=rest(limb.leftHand.base).sub(rest(limb.rightHand.base));
  const sky=new Vector3(0,1,0), bindUp=rest(head).sub(home), height=bindUp.length()+home.distanceTo(rest(limb.leftFoot.tip));
  if(!Number.isFinite(height)||height<1e-6||!(left.length()>.005*height&&shoulders.dot(left)>0&&bindUp.y>.18*height))return null;
  const bindLeft=left.normalize().add(shoulders.normalize()).normalize();
  bindUp.addScaledVector(bindLeft,-bindLeft.dot(bindUp)).normalize();
  const bindFront=bindLeft.clone().cross(bindUp).normalize();
  const floorLeft=bindLeft.clone().setY(0).normalize(), floorFront=floorLeft.clone().cross(sky);
  if(floorFront.lengthSq()<.9 || bindFront.lengthSq()<.9)return null;
  const dir=(v:Direction,mirror=1)=>floorLeft.clone().multiplyScalar(v[0]*mirror).addScaledVector(sky,v[1]).addScaledVector(floorFront,v[2]).normalize();
  const boneQ=new Map<Bone,Quaternion>();
  const remember=(b:Bone)=>boneQ.set(b,rot(b));
  function orient(b:Bone,q:Quaternion) {clip.set(indices.get(b)!,b.position,b.parent!.getWorldQuaternion(new Quaternion()).invert().multiply(q).normalize());}
  const regions=new Map<Bone,Region>();
  function mark(from:Bone,to:Bone,part:Region) {for(let b=from;b?.isBone;b=b.parent as Bone){regions.set(b,part);if(b===to)break;}}
  for(const b of body)mark(b,driver,'trunk');
  const measures=new Map<Limb,{upper:Vector3;a:number;b:number;end:Vector3}>();
  for(const k of keys){
    const l=limb[k],hand=k.endsWith('Hand'),side=k.startsWith('left')?'left':'right';
    mark(l.tip,l.base,`${side}${hand?'Arm':'Leg'}`);regions.set(l.tip,k);
    const upper=rest(l.joint).sub(rest(l.base)),lower=rest(l.tip).sub(rest(l.joint)),a=upper.length(),b=lower.length();
    if(!(Math.min(a,b)>height*.008&&Math.max(a,b)<height*.60))return null;
    const digits=bones.filter(n=>within(n,l.tip)&&/中指[１1]|middle(?:finger)?0?1|人指[１1]|index(?:finger)?0?1|足先|つま先|toe(?:base)?/i.test(n.name));
    let end=hand?lower.clone():bindFront.clone();
    if(digits.length)end=rest(digits[0]).sub(rest(l.tip));
    if(end.lengthSq()<1e-12)end.copy(hand?lower:bindFront);
    measures.set(l,{upper:upper.normalize(),a,b,end:end.normalize()});
  }
  const faceBone=neck&&within(head,neck)&&within(neck,torso)?neck:head;
  let skin:ReturnType<typeof createPresetSurface>|undefined, floor:number|undefined;
  function chain(l:Limb,hand:boolean,upper:Vector3,lower:Vector3) {
    const m=measures.get(l)!;
    // Roll the upper limb around the measured shaft so the elbow/knee flexes
    // in its anatomical plane, including a widely abducted thigh.
    orient(l.base,transport(m.upper,bindFront.clone().multiplyScalar(hand?1:-1),upper,lower).multiply(boneQ.get(l.base)!));
    const shaft=between(l.joint,l.tip).normalize();
    orient(l.joint,new Quaternion().setFromUnitVectors(shaft,lower).multiply(rot(l.joint)));
  }
  function reach(l:Limb,hand:boolean,p:Vector3,pole:Vector3) {
    const {a,b}=measures.get(l)!,ray=p.clone().sub(pos(l.base)),dist=ray.length();if(dist<1e-8)return;
    ray.divideScalar(dist);const d=Math.max(Math.abs(a-b)+1e-7*height, Math.min(a+b,dist));
    const u=(a*a-b*b+d*d)/(2*d),v=Math.sqrt(Math.max(0,a*a-u*u));
    pole.addScaledVector(ray,-ray.dot(pole)).normalize();
    const joint=ray.clone().multiplyScalar(u).addScaledVector(pole,v);
    chain(l,hand,joint.clone().normalize(),ray.multiplyScalar(d).sub(joint).normalize());
  }
  return (id:PosePresetId)=>{
    const s=presetShapes[id]; clip.resetToBind();
    skin??=createPresetSurface(source,clip.mesh,regions);
    if(floor===undefined){
      const g=skin(), foot=Math.min(g.leftFoot,g.rightFoot), ankle=Math.min(pos(limb.leftFoot.tip).y,pos(limb.rightFoot.tip).y);
      floor=Number.isFinite(foot)&&Math.abs(ankle-foot)<.13*height?foot:Math.abs(ankle)<.13*height?0:ankle-.03*height;
    }
    for(const b of [driver,faceBone,...keys.flatMap(k=>[limb[k].base,limb[k].tip])])remember(b);
    const up=dir(s.trunk[0]),front=dir(s.trunk[1]);
    const tilt=transport(bindUp,bindFront,up,front);
    orient(driver,tilt.clone().multiply(boneQ.get(driver)!));
    const pitch=new Quaternion().setFromAxisAngle(up.clone().cross(front).normalize(),s.headPitch*Math.PI/180);
    orient(faceBone,pitch.multiply(tilt).multiply(boneQ.get(faceBone)!));
    function digits(l:Limb,hand:boolean,sign:number){
      const pair=hand?s.palm:s.foot;if(!pair)return;
      const m=measures.get(l)!;
      orient(l.tip,transport(m.end,bindUp,dir(pair[0],id==='side'?1:sign),dir(pair[1])).multiply(boneQ.get(l.tip)!));
    }
    for(const k of keys){
      const l=limb[k],hand=k.endsWith('Hand'),right=k.startsWith('right'),override=right&&(hand?s.rightArm:s.rightLeg);
      const pair=override||(hand?s.arm:s.leg),sign=right?-1:1;
      chain(l,hand,dir(pair[0],override?1:sign),dir(pair[1],override?1:sign));digits(l,hand,sign);
    }
    function contacts(){
      const g=skin!();
      // Sparse or synthetic actors need a contact even when only one limb has
      // drawn vertices. Otherwise prefer the actual weighted skin over a pad.
      const trunk=Math.min(hip().y,pos(head!).y,pos(limb.leftHand.base).y,pos(limb.rightHand.base).y);
      function pad(region:Region,y:number,fallback:number){g[region]=Math.min(y,Number.isFinite(g[region])?g[region]:y-height*fallback);}
      pad('trunk',trunk,.050);
      for(const side of sides){const leg=limb[`${side}Foot`],arm=limb[`${side}Hand`];
        pad(`${side}Leg`,pos(leg.joint).y,.024);pad(`${side}Foot`,pos(leg.tip).y,.024);
        pad(`${side}Arm`,pos(arm.joint).y,0);pad(`${side}Hand`,pos(arm.tip).y,.013);
      }return g;
    }
    const c=contacts(),support=s.support==='knees'?Math.max(c.leftLeg,c.rightLeg):s.support==='feet'?Math.max(c.leftFoot,c.rightFoot):c.trunk;
    for(const side of sides){
      const sign=side==='left'?1:-1,leg=limb[`${side}Foot`],arm=limb[`${side}Hand`];
      const legFloor=c[`${side}Leg`],footFloor=c[`${side}Foot`];
      if(s.support==='knees'){
        // A single vertical shift cannot plant two differently sized legs.
        // Fit each thigh to the common knee plane, each shin back to the instep.
        const {a,b}=measures.get(leg)!,kneeRise=support-legFloor;
        function rise(v:Vector3,dy:number){const y=Math.max(-1,Math.min(1,v.y+dy));return v.setY(0).normalize().multiplyScalar(Math.sqrt(1-y*y)).setY(y);}
        chain(leg,false,rise(between(leg.base,leg.joint).normalize(),kneeRise/a),rise(between(leg.joint,leg.tip).normalize(),(support-footFloor-kneeRise)/b));digits(leg,false,sign);
      }else if(id==='supine'||s.support==='feet'&&Math.abs(support-footFloor)>height*1e-5){
        const foot=pos(leg.tip); foot.y+=support-footFloor;
        reach(leg,false,foot,dir(id==='supine'?[.40,.96,-.24]:[.15,.15,1],sign));digits(leg,false,sign);
      }
      if(id==='allFours'||id==='supine'){
        const p=pos(arm.tip);p.y+=support-c[`${side}Hand`];
        reach(arm,true,p,dir([.48,.15,id==='allFours'?-1:.70],sign));digits(arm,true,sign);
      }else if(id==='straddle'||id==='standingLean'){
        const p=pos(leg.joint).lerp(pos(leg.base),id==='straddle'?.32:.19).addScaledVector(floorFront,.026*height);
        reach(arm,true,p,dir([.65,.23,-.80],sign));
      }
    }
    const low=Math.min(...Object.values(contacts())), shift=home.clone().sub(hip()).setY(floor-low);
    if(!Number.isFinite(shift.lengthSq()))return false;
    clip.set(indices.get(driver)!,driver.parent!.worldToLocal(pos(driver).add(shift)),driver.quaternion);
    // Verify the edit as a VMD input. In particular an unusual grant can
    // evaluate differently from an isolated FK scratch assignment.
    const expected=joints.map(pos);clip.evaluate();
    if(joints.some((b,i)=>!(pos(b).distanceTo(expected[i])<height*1e-4)))return false;
    for(const k of keys){const l=limb[k],ray=between(l.base,l.tip).normalize(),pole=between(l.base,l.joint);
      pole.addScaledVector(ray,-ray.dot(pole)); l.pole.copy(pole.lengthSq()>1e-12?pole.normalize():floorFront);}
    return true;
  };
}
