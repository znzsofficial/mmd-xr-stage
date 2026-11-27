import { Group, Matrix4, Mesh, MeshStandardMaterial, Vector3, type Bone, type Object3D, type SkinnedMesh } from 'three';
import { siliconeMount, siliconeTilt } from '../play/siliconeProfile';
import { createSiliconeHead, mountWandHead } from '../play/wandHead';
import type { PelvicFrame } from './contract';
import { placeWorld } from './drawing';
import { partnerSurfaces } from './partnerArt';
import { rod } from './path';

const sky=new Vector3(0,1,0);
const clamp=(x:number,min:number,max:number)=>Math.min(max,Math.max(min,x));

// Read only posed landmarks on the same skeleton as the calibrated anchor.
// Optional: manually registered actors can lack every one of these bones.
function landmarks(root:Object3D,anchor:Object3D){
  let bones:Bone[]=[];
  root.traverse(node=>{const sk=(node as SkinnedMesh).skeleton;
    if(sk&&((anchor===root&&!bones.length)||sk.bones.includes(anchor as Bone)))bones=sk.bones;});
  const joint=(pattern:RegExp)=>bones.find(b=>[b.userData.mmdBoneName,b.userData.mmdEnglishBoneName,b.name].some(n=>
    typeof n==='string'&&pattern.test(n.normalize('NFKC').toLowerCase().split(':').pop()!.replace(/^mixamorig/,'').replace(/[ ._-]/g,''))));
  return {neck:joint(/^(首|neck)$/)??joint(/^(頭|头|head)$/),knees:[
    joint(/^(左ひざ|左膝|left(knee|leg|lowerleg)|kneel|shinl)$/),
    joint(/^(右ひざ|右膝|right(knee|leg|lowerleg)|kneer|shinr)$/),
  ]};
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
    bend.copy(pole).addScaledVector(axis,-axis.dot(pole)).normalize();
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
  const group=new Group(),piece=new Group(),g=partnerSurfaces(),joints=landmarks(actor,anchor);
  const material=new MeshStandardMaterial({color:'#c6d2df',emissive:'#a1c6dd',emissiveIntensity:.72,roughness:.58,
    transparent:true,opacity:.38,depthTest:true,depthWrite:false});
  function mesh(key:keyof typeof g,name:string,parent:Object3D=group){
    const m=new Mesh(g[key],material);m.name=name;parent.add(m);return m;
  }
  group.name='pelvic:partner';group.visible=false;host.add(group);
  piece.name='pelvic:partner-piece';group.add(piece);
  const shaft=mesh('shaft','play:piece:dildo',piece);shaft.position.fromArray(siliconeMount);shaft.rotation.x=siliconeTilt;
  const unmountContact=mountWandHead(createSiliconeHead(shaft,shaft.geometry));
  mesh('pelvis','pelvic:partner-pelvis');const torso=mesh('torso','pelvic:partner-torso'),head=mesh('head','pelvic:partner-head',torso);
  head.position.set(0,.54,-.005);
  const limbs=[-1,1].map(sign=>{
    const side=sign<0?'left':'right',part=(key:keyof typeof g)=>mesh(key,`pelvic:partner-${side}-${key}`);
    return {sign,leg:createLimb(part('thigh'),part('shin'),.43,.423),arm:createLimb(part('upperArm'),part('forearm'),.306,.265),
      foot:part('foot'),hand:mesh(sign<0?'leftHand':'rightHand',`pelvic:partner-${side}-hand`)};
  });
  const world=new Matrix4(),inverse=new Matrix4(),entry=new Vector3(),root=new Vector3(),neck=new Vector3(),out=new Vector3(),side=new Vector3();
  const leg=new Vector3(),shoulder=new Vector3(),target=new Vector3(),pole=new Vector3(),joint=new Vector3(),scale=new Vector3();
  function draw(f:PelvicFrame,railWorld:Matrix4,floorY:number){
    entry.setFromMatrixPosition(f.world);out.setFromMatrixColumn(f.world,2).setY(0);
    if(joints.neck)joints.neck.getWorldPosition(neck);
    // With the actor on their back the port may point straight at the sky.
    // Face along the reclined actor rather than spinning on a vertical rail.
    if(joints.neck&&Math.abs(neck.y-entry.y)<.34*f.scale&&Math.hypot(entry.x-neck.x,entry.z-neck.z)>.21*f.scale){
      out.subVectors(entry,neck).setY(0);
    }else if(out.lengthSq()<.04){
      out.setFromMatrixColumn(f.world,0).cross(sky);
      if(out.lengthSq()<1e-6)out.setFromMatrixColumn(f.world,1).negate().setY(0);
    }
    out.normalize();side.crossVectors(sky,out);
    // The pubis surface reaches the anatomical shaft root, not its nozzle.
    root.copy(rod[0]).applyMatrix4(railWorld).addScaledVector(out,.091*f.scale);root.y+=.024*f.scale;
    world.makeBasis(side,sky,out).scale(scale.setScalar(f.scale)).setPosition(root);
    placeWorld(group,world);placeWorld(piece,railWorld);group.visible=true;
    inverse.copy(world).invert();entry.applyMatrix4(inverse);
    const floor=(floorY-root.y)/f.scale, low=clamp(1-(entry.y-floor-.20)/.59,0,1);
    // Blend between upright and leaning over a low actor without consulting
    // a preset ID: manual edits, new presets and a playing VMD take this path.
    torso.rotation.x=-.06-.91*low;head.rotation.x=-.17-.12*(1-low);
    if(joints.neck)neck.applyMatrix4(inverse);
    let width=.16+.08*low;
    for(const knee of joints.knees)if(knee){knee.getWorldPosition(joint).applyMatrix4(inverse);
      if(joint.y>entry.y+.08)width=Math.max(width,Math.min(.53,Math.abs(joint.x-entry.x)+.105));}
    for(const limb of limbs){
      const s=limb.sign;
      leg.set(s*.097,-.026,.014);
      target.set(entry.x+s*(.19+.10*low),floor+.052,entry.z+.26+.39*low);
      limb.foot.position.copy(limb.leg(leg,target,pole.set(s*(.48+.65*low),-.52,-1),floor+.056));
      limb.foot.rotation.y=-s*.13;
      shoulder.set(s*.175,.426,.005).applyQuaternion(torso.quaternion);
      const handY=(entry.y+.15)*(1-low)+(floor+.022)*low;
      const reach=joints.neck?clamp((neck.z-entry.z)*.77,-.50,-.10):-.14-.21*low;
      target.set(entry.x+s*width,Math.max(floor+.022,handY),entry.z+reach);
      limb.hand.position.copy(limb.arm(shoulder,target,pole.set(s*.84,.09,.68),floor+.044));
      limb.hand.rotation.set(-.70*(1-low),s*.11,0);
    }
  }
  return {group,piece,draw,dispose(){group.removeFromParent();unmountContact();for(const geometry of Object.values(g))geometry.dispose();material.dispose();}};
}
