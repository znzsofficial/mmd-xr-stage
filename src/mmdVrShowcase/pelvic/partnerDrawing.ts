import { Group, MathUtils, Matrix4, Mesh, MeshStandardMaterial, Vector3, type Object3D } from 'three';
import { siliconeMount, siliconeTilt } from '../play/siliconeProfile';
import { createSiliconeHead, mountWandHead } from '../play/wandHead';
import type { PelvicFrame } from './contract';
import { placeWorld } from './drawing';
import { partnerSurfaces } from './partnerArt';
import { createPartnerStance } from './partnerStance';
import { rod } from './path';

const sky=new Vector3(0,1,0);
const clamp=(x:number,min:number,max:number)=>Math.min(max,Math.max(min,x));

// Keep a side-lying limb on the partner's side (+Z) of the displayed actor
// segment. The margin fades at its edge so a moving thigh doesn't kick the IK.
function clearSegment(p: Vector3, a: Vector3, b: Vector3, radius: number, weight = 1) {
  if (!Number.isFinite(a.x + b.x)) return;
  const dx = b.x - a.x, dy = b.y - a.y;
  const t = clamp(((p.x - a.x) * dx + (p.y - a.y) * dy) / Math.max(1e-8, dx * dx + dy * dy), 0, 1);
  const distance = Math.hypot(p.x - a.x - t * dx, p.y - a.y - t * dy);
  const shell = a.z + t * (b.z - a.z) + radius;
  p.z += weight * Math.max(0, shell - p.z) * (1 - MathUtils.smoothstep(distance, radius * .7, radius * 1.35));
}

// Each two-link solve preserves both bone lengths. If the preferred knee
// would pass through the floor, swivel around the hip→ankle line until the
// kneecap rests on it. The ankles and bracing palms have independent targets.
function createLimb(upper:Mesh,lower:Mesh,a:number,b:number){
  const axis=new Vector3(),bend=new Vector3(),vertical=new Vector3(),across=new Vector3(),mid=new Vector3(),end=new Vector3(),dir=new Vector3();
  function segment(mesh:Mesh,from:Vector3,to:Vector3){
    mesh.position.copy(from);dir.subVectors(to,from);mesh.scale.y=dir.length();
    mesh.quaternion.setFromUnitVectors(sky,dir.normalize());
  }
  return (start:Vector3,target:Vector3,pole:Vector3,minJointY:number)=>{
    axis.subVectors(target,start);const distance=axis.length();
    if(distance<1e-8)axis.set(0,-1,0);else axis.divideScalar(distance);
    const d=clamp(distance,Math.abs(a-b)+.001,a+b-.0001),along=(a*a-b*b+d*d)/(2*d),radius=Math.sqrt(Math.max(0,a*a-along*along));
    mid.copy(start).addScaledVector(axis,along);end.copy(start).addScaledVector(axis,d);
    bend.copy(pole).addScaledVector(axis,-axis.dot(pole));
    if(bend.lengthSq()<1e-8){
      if(Math.abs(axis.y)<.9)bend.copy(sky);else bend.set(1,0,0);
      bend.addScaledVector(axis,-axis.dot(bend));
    }
    bend.normalize();
    vertical.copy(sky).addScaledVector(axis,-axis.y);
    const rise=vertical.length();
    if(rise>.0001&&radius>.0001&&mid.y+radius*bend.y<minJointY){
      vertical.divideScalar(rise);across.crossVectors(axis,vertical);
      if(across.dot(pole)<0)across.negate();
      const lift=clamp((minJointY-mid.y)/(radius*rise),-1,1);
      bend.copy(vertical).multiplyScalar(lift).addScaledVector(across,Math.sqrt(1-lift*lift));
    }
    mid.addScaledVector(bend,radius);segment(upper,start,mid);segment(lower,mid,end);return end;
  };
}

/** A drawn companion to the existing contact piece, in the room only. The
 * pelvis follows the proximal shaft; neither an animation clock nor an actor
 * slot participates. The feet and hands brace against the target's pose. */
export function createPartnerDrawing(host:Object3D,actor:Object3D,anchor:Object3D){
  const group=new Group(),piece=new Group(),g=partnerSurfaces(),sampleStance=createPartnerStance(actor,anchor);
  const material=new MeshStandardMaterial({color:'#c6d2df',emissive:'#a1c6dd',emissiveIntensity:.72,roughness:.58,
    transparent:true,opacity:.38,depthTest:true,depthWrite:false});
  function mesh(key:keyof typeof g,name:string,parent:Object3D=group){
    const m=new Mesh(g[key],material);m.name=name;parent.add(m);return m;
  }
  group.name='pelvic:partner';group.visible=false;host.add(group);
  piece.name='pelvic:partner-piece';group.add(piece);
  const shaft=mesh('shaft','play:piece:dildo',piece);shaft.position.fromArray(siliconeMount);shaft.rotation.x=siliconeTilt;
  const unmountContact=mountWandHead(createSiliconeHead(shaft,shaft.geometry));
  const pelvis=mesh('pelvis','pelvic:partner-pelvis'),torso=mesh('torso','pelvic:partner-torso'),head=mesh('head','pelvic:partner-head',torso);
  torso.rotation.order='ZXY';
  head.position.set(0,.54,-.005);
  const limbs=[-1,1].map(sign=>{
    const side=sign<0?'left':'right',part=(key:keyof typeof g)=>mesh(key,`pelvic:partner-${side}-${key}`);
    return {sign,leg:createLimb(part('thigh'),part('shin'),.43,.423),arm:createLimb(part('upperArm'),part('forearm'),.306,.265),
      foot:part('foot'),hand:mesh(sign<0?'leftHand':'rightHand',`pelvic:partner-${side}-hand`)};
  });
  const world=new Matrix4(),inverse=new Matrix4(),root=new Vector3(),side=new Vector3(),scale=new Vector3();
  const leg=new Vector3(),shoulder=new Vector3(),target=new Vector3(),pole=new Vector3(),candidate=new Vector3(),bodyRight=new Vector3();
  function draw(f:PelvicFrame,railWorld:Matrix4,floorY:number){
    const {entry,hip,neck,left,out,sides,lateral,rear,roll}=sampleStance(f,group.visible);
    side.crossVectors(sky,out);
    root.copy(rod[0]).applyMatrix4(railWorld).addScaledVector(out,.091*f.scale);root.y+=.024*f.scale;
    // At full travel the unscaled shaft can end inside a wide hip or below
    // a prone actor. Fit the silhouette; the piece keeps its own world matrix.
    const gap=candidate.subVectors(root,hip).dot(out)/f.scale;
    root.addScaledVector(out,Math.max(0,.14-gap)*Math.max(rear,lateral)*f.scale);
    const lowerHip=.026*Math.cos(roll)+.097*Math.abs(Math.sin(roll));
    root.y=Math.max(root.y,floorY+(lowerHip+.096)*f.scale);
    world.makeBasis(side,sky,out).scale(scale.setScalar(f.scale)).setPosition(root);
    placeWorld(group,world);placeWorld(piece,railWorld);group.visible=true;
    inverse.copy(world).invert();entry.applyMatrix4(inverse);hip.applyMatrix4(inverse);neck.applyMatrix4(inverse);
    for(const joints of sides){
      joints.hip.applyMatrix4(inverse);joints.knee.applyMatrix4(inverse);joints.shoulder.applyMatrix4(inverse);
    }
    const floor=(floorY-root.y)/f.scale, low=clamp(1-(entry.y-floor-.20)/.59,0,1);
    const hasNeck=Number.isFinite(neck.x),headward=-Math.sign(roll);
    const lean=-.06-.91*low*(1-.70*rear);
    const sideLean=clamp(((hasNeck?MathUtils.lerp(hip.z,neck.z,.7):hip.z)+.27)/.43,.08,.60);
    pelvis.rotation.z=roll;torso.rotation.set(MathUtils.lerp(lean,sideLean,lateral),0,roll,'ZXY');
    head.rotation.x=-.17-.12*(1-low);
    bodyRight.copy(side).multiplyScalar(Math.cos(roll)).addScaledVector(sky,Math.sin(roll));
    const correspondence=bodyRight.dot(left);
    // During a turn, fade through the neutral brace while the two anatomical
    // side axes are edge-on. Choosing a different knee cannot snap the hand.
    const pairing=MathUtils.smoothstep(Math.abs(correspondence),.08,.65);
    const reach=hasNeck?clamp((neck.z-entry.z)*.77,-.50,-.10):-.14-.21*low;
    for(const limb of limbs){
      const s=limb.sign;
      const {hip:thigh,knee,shoulder:actorShoulder}=sides[s*correspondence>=0?0:1];
      const upperSide=s*Math.sign(roll)>0;
      leg.set(s*.097,-.026,.014).applyQuaternion(pelvis.quaternion);
      target.set(entry.x+s*(.19+.10*low),floor+.052,entry.z+.26+.39*low);
      pole.set(s*(.48+.65*low),-.52,-1);
      if(lateral){
        candidate.set(-headward * (upperSide ? .58 : .74), floor + (upperSide ? .182 : .052), upperSide ? .40 : .16);
        clearSegment(candidate,thigh,knee,.16,pairing);
        target.lerp(candidate,lateral);
        pole.lerp(candidate.set(-headward*.55, upperSide ? .42 : .12, .85), lateral);
      }
      // The calf is deeper than the ankle. On a nearly horizontal shin the
      // widest ring (37% down) still needs 6.5 cm, even with a planted heel.
      limb.foot.position.copy(limb.leg(leg,target,pole,floor+.075));
      limb.foot.rotation.y=-s*.13;
      shoulder.set(s*.175,.426,.005).applyQuaternion(torso.quaternion);
      let width=.16+.08*low,braceY=MathUtils.lerp(entry.y+.15,floor+.022,low);
      if(Number.isFinite(knee.x)){
        const tucked=MathUtils.smoothstep(knee.y-entry.y,-.16,-.08)*(1-MathUtils.smoothstep(knee.z-entry.z,.12,.22));
        const weight=tucked*pairing;
        width+=weight*Math.max(0,Math.min(.53,s*(knee.x-entry.x)+.115)-width);
        braceY+=weight*Math.max(0,knee.y-.025-braceY);
      }
      target.set(entry.x+s*width,Math.max(floor+.022,braceY),entry.z+reach);
      if(rear&&Number.isFinite(thigh.x)){
        candidate.copy(thigh);
        if(Number.isFinite(actorShoulder.x))candidate.lerp(actorShoulder,.2);
        // A rear kneeler has a reachable waist to brace beside. Keep each
        // hand outside its flank rather than reaching under the actor.
        candidate.x+=s*.10;candidate.y=Math.max(floor+.028,candidate.y+.025);candidate.z+=.045;
        target.lerp(candidate,rear*pairing);
      }
      // Lower arm braces ahead on the ground. The upper arm reaches toward
      // its own thigh, within an arm's length of this rolled shoulder.
      pole.set(s*.84,.09,.68);
      if(lateral){
        if(upperSide){
          candidate.set(headward*.16,floor+.296,hip.z+.15);
          if(Number.isFinite(knee.x)){
            candidate.x+=clamp(knee.x-hip.x,-.30,.30)*.45*pairing;
            candidate.y+=Math.max(0,Math.min(shoulder.y+.22,knee.y+.05)-candidate.y)*pairing;
          }
        }else candidate.set(headward*.64,floor+.026,.15);
        clearSegment(candidate,hip,neck,.18);
        clearSegment(candidate,thigh,knee,.13,pairing);
        target.lerp(candidate,lateral);
        pole.lerp(candidate.set(headward*.28, upperSide ? .41 : .16, 1), lateral);
      }
      limb.hand.position.copy(limb.arm(shoulder,target,pole,floor+.049));
      limb.hand.rotation.set(-.70*(1-low)*(1-lateral),s*.11-headward*lateral*.75,0);
    }
  }
  return {group,piece,draw,dispose(){group.removeFromParent();unmountContact();for(const geometry of Object.values(g))geometry.dispose();material.dispose();}};
}
