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
function rise(v:Vector3,dy:number){const y=Math.max(-1,Math.min(1,v.y+dy));return v.setY(0).normalize().multiplyScalar(Math.sqrt(1-y*y)).setY(y);}

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
  const measures=new Map<Limb,{upper:Vector3;a:number;b:number;end:Vector3;palmLength:number}>();
  for(const k of keys){
    const l=limb[k],hand=k.endsWith('Hand'),side=k.startsWith('left')?'left':'right';
    mark(l.tip,l.base,`${side}${hand?'Arm':'Leg'}`);regions.set(l.tip,k);
    const upper=rest(l.joint).sub(rest(l.base)),lower=rest(l.tip).sub(rest(l.joint)),a=upper.length(),b=lower.length();
    if(!(Math.min(a,b)>height*.008&&Math.max(a,b)<height*.60))return null;
    const digits=bones.filter(n=>within(n,l.tip)&&/中指[１1]|middle(?:finger)?0?1|人指[１1]|index(?:finger)?0?1|足先|つま先|toe(?:base)?/i.test(n.name));
    let end=hand?lower.clone():bindFront.clone();
    if(digits.length)end=rest(digits[0]).sub(rest(l.tip));
    if(end.lengthSq()<1e-12)end.copy(hand?lower:bindFront);
    const palmLength=hand && digits.length ? Math.min(.075*height,end.length()) : .047*height;
    measures.set(l,{upper:upper.normalize(),a,b,end:end.normalize(),palmLength});
  }
  const bodyInputs=bones.flatMap((b,i)=>{
    // PMX IK/append donors also live on independent root branches. Reset
    // them along with normal body tracks; retain eye/jaw/facial FK inputs.
    const facial= b!==head && within(b,head) || /両目|[左右]目|^(?:(?:left|right|both|all)?eyes?|eyes?(?:left|right|[lr])|jaw)$/i.test(b.name);
    return facial?[]:[i];
  });
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
  function groundChain(l:Limb,hand:boolean,jointRise:number,tipRise:number){
    const {a,b}=measures.get(l)!;
    chain(l,hand,rise(between(l.base,l.joint).normalize(),jointRise/a),
      rise(between(l.joint,l.tip).normalize(),(tipRise-jointRise)/b));
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
    const s=presetShapes[id]; clip.resetBodyToBind(bodyInputs);
    skin??=createPresetSurface(source,clip.mesh,regions);
    if(floor===undefined){
      const g=skin.minima(), foot=Math.min(g.leftFoot,g.rightFoot), ankle=Math.min(pos(limb.leftFoot.tip).y,pos(limb.rightFoot.tip).y);
      floor=Number.isFinite(foot)&&Math.abs(ankle-foot)<.13*height?foot:Math.abs(ankle)<.13*height?0:ankle-.03*height;
    }
    for(const b of [driver,torso,faceBone,...keys.flatMap(k=>[limb[k].base,limb[k].tip])])remember(b);
    const up=dir(s.trunk[0]),front=dir(s.trunk[1]);
    if(s.support==='seat'){
      // A long trunk with short arms needs to lean further back to put its
      // palms down. Reserve reach behind each shoulder and clearance below the seat.
      let maxRise=up.y;
      for(const side of sides){
        const arm=limb[`${side}Hand`], {a,b}=measures.get(arm)!;
        const offset=rest(arm.base).sub(home);
        const reachY=.92*(a+b)-.055*height-Math.max(0,offset.dot(bindFront));
        const trunkLength=offset.dot(bindUp);
        if(trunkLength>0)maxRise=Math.min(maxRise,reachY/trunkLength);
      }
      if(maxRise<up.y){
        rise(up,Math.max(.1,maxRise)-up.y);
        front.crossVectors(floorLeft,up).normalize();
      }
    }
    const tilt=transport(bindUp,bindFront,up,front);
    const lateral=up.clone().cross(front).normalize();
    if(s.pelvisTuck && torso!==driver){
      const tuck=new Quaternion().setFromAxisAngle(lateral,-s.pelvisTuck*Math.PI/180);
      orient(driver,tuck.multiply(tilt).multiply(boneQ.get(driver)!));
      orient(torso,tilt.clone().multiply(boneQ.get(torso)!));
    }else orient(driver,tilt.clone().multiply(boneQ.get(driver)!));
    const pitch=new Quaternion().setFromAxisAngle(lateral,s.headPitch*Math.PI/180);
    if(s.headTurn)pitch.premultiply(new Quaternion().setFromAxisAngle(up,s.headTurn*Math.PI/180));
    orient(faceBone,pitch.multiply(tilt).multiply(boneQ.get(faceBone)!));
    function digits(l:Limb,hand:boolean,sign:number){
      const override=!hand&&sign===-1?s.rightFoot:undefined;
      const pair=override??(hand?s.palm:s.foot);if(!pair)return;
      const m=measures.get(l)!, mirror=override||s.support==='side'?1:sign;
      orient(l.tip,transport(m.end,bindUp,dir(pair[0],mirror),dir(pair[1],mirror)).multiply(boneQ.get(l.tip)!));
    }
    for(const k of keys){
      const l=limb[k],hand=k.endsWith('Hand'),right=k.startsWith('right'),override=right&&(hand?s.rightArm:s.rightLeg);
      const pair=override||(hand?s.arm:s.leg),sign=right?-1:1;
      const upper=dir(pair[0],override?1:sign);
      if(id==='matingPress' && !hand){
        // Draw each knee toward its own shoulder, allowing room outside the ribcage.
        const shoulder=pos(limb[right?'rightHand':'leftHand'].base), thigh=pos(l.base);
        shoulder.addScaledVector(floorLeft,sign*.064*height);
        upper.copy(shoulder).setY(Math.max(shoulder.y,thigh.y)+.085*height).sub(thigh).normalize();
      }else if(id==='supineKneeHug' && k==='leftFoot'){
        // Bring one shin over the chest, within the span of both arms.
        const chest=pos(limb.leftHand.base).lerp(pos(limb.rightHand.base),.42);
        upper.copy(chest).addScaledVector(sky,.17*height).sub(pos(l.base)).normalize();
      }
      chain(l,hand,upper,dir(pair[1],override?1:sign));digits(l,hand,sign);
    }
    function grip(handSide:typeof sides[number],hold:NonNullable<typeof s.hold>){
      const heldSide=hold.targetLeg??handSide, leg=limb[`${heldSide}Foot`],arm=limb[`${handSide}Hand`];
      const shin=hold.segment==='shin',start=shin?leg.joint:leg.base,end=shin?leg.tip:leg.joint;
      const shaft=between(start,end),length=shaft.length(),along=shaft.normalize();
      const normal=dir(hold.normal,handSide==='left'?1:-1);
      normal.addScaledVector(along,-along.dot(normal)).normalize();
      const m=measures.get(arm)!;
      function wristAt(fraction:number){
        const center=pos(start).lerp(pos(end),fraction);
        const pad=skin!.outset(`${heldSide}Leg`,center,normal,height,.050);
        return center.addScaledVector(normal,pad+.009*height).addScaledVector(along,-.70*m.palmLength);
      }
      let wrist=wristAt(hold.fraction);
      if(hold.range){
        // Intersect this hand's reach sphere with the limb. A short arm can
        // grip nearer the knee without pulling the other hand off its patch.
        const shoulder=pos(arm.base).sub(wrist),reach=.98*(m.a+m.b);
        if(shoulder.lengthSq()>reach*reach){
          const axial=shoulder.dot(along),radialSq=shoulder.lengthSq()-axial*axial;
          const span=Math.sqrt(Math.max(0,reach*reach-radialSq));
          const nearest=Math.max(axial-span,Math.min(0,axial+span));
          const fraction=Math.max(hold.range[0],Math.min(hold.range[1],hold.fraction+nearest/length));
          wrist=wristAt(fraction);
        }
      }
      return {along,normal,wrist};
    }
    function contacts(){
      const g=skin!.minima();
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
    const c=contacts();
    function supportLevel(){
      if(s.support==='knees')return Math.max(c.leftLeg,c.rightLeg);
      if(s.support==='feet')return Math.max(c.leftFoot,c.rightFoot);
      if(s.support==='halfKneel')return Math.max(c.rightLeg,c.leftFoot);
      if(id==='sideLegLift')return Math.min(c.trunk,c.rightArm);
      return c.trunk;
    }
    const support=supportLevel();
    for(const side of sides){
      const sign=side==='left'?1:-1,leg=limb[`${side}Foot`],arm=limb[`${side}Hand`];
      const legFloor=c[`${side}Leg`],footFloor=c[`${side}Foot`];
      if(s.support==='knees'||s.support==='front'||s.support==='seat'||id==='sideForwardLeg'||
        (id==='sideLegLift'||id==='halfKneel')&&side==='right'){
        // Fit the two segments independently. A seated heel bears weight while
        // its knee stays raised; kneeling, prone and side supports plant both.
        groundChain(leg,false,s.support==='seat'?0:support-legFloor,support-footFloor);
        digits(leg,false,sign);
      }else if(id==='halfKneel'||id==='supineKneeHug'&&side==='right'){
        // Fit the planted sole without dragging its raised knee to the floor.
        // A short shin limits how high this knee can stay above the ankle.
        const ankleY=pos(leg.tip).y+support-footFloor, shin=measures.get(leg)!.b;
        const kneeY=Math.min(pos(leg.joint).y,ankleY+shin*(id==='halfKneel'?.98:.72));
        groundChain(leg,false,kneeY-pos(leg.joint).y,support-footFloor);
        digits(leg,false,sign);
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
      }else if(s.support==='seat'){
        const {a,b}=measures.get(arm)!;
        const palm=pos(arm.base).addScaledVector(floorFront,-.23*(a+b)).addScaledVector(floorLeft,sign*.16*(a+b));
        palm.y=support+pos(arm.tip).y-c[`${side}Hand`];
        reach(arm,true,palm,dir([.72,.15,-.66],sign));digits(arm,true,sign);
      }else if(id==='forearmKneel'||s.support==='front'||id==='sideForwardLeg'&&side==='right'){
        // Plant the two ends separately: wrist-only IK can put a palm down
        // with its elbow still in the air like the old all-fours pose.
        groundChain(arm,true,support-c[`${side}Arm`],support-c[`${side}Hand`]);
        digits(arm,true,sign);
      }else if(s.hold && (!s.hold.leftOnly || side==='left')){
        const {along,normal,wrist}=grip(side,s.hold),m=measures.get(arm)!;
        reach(arm,true,wrist,dir(s.hold.elbow,sign));
        orient(arm.tip,transport(m.end,bindUp,along,normal).multiply(boneQ.get(arm.tip)!));
      }else if(id==='coveredKneel'){
        // Cross the forearms in two bands. Measure the front of the posed
        // chest near the middle of each forearm, not just at the far wrist.
        const shoulders=pos(limb.leftHand.base).lerp(pos(limb.rightHand.base),.5);
        const band=shoulders.addScaledVector(up,-height*(sign===1?.077:.124));
        const m=measures.get(arm)!,outer=skin.outset('trunk',band.clone().addScaledVector(floorLeft,.065*height*sign),front,height,.10);
        const across=floorLeft.clone().multiplyScalar(-sign);
        const wrist=band.addScaledVector(across,.074*height).addScaledVector(front,outer+.014*height);
        reach(arm,true,wrist,dir([.90,-.28,.64],sign));
        orient(arm.tip,transport(m.end,bindUp,across,front).multiply(boneQ.get(arm.tip)!));
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
