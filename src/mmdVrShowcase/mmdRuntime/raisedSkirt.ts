import {Matrix4,Quaternion,Vector3,type Bone,type SkinnedMesh} from 'three';
import {fitAbdomenSupport} from './abdomenSupport';
import type {ThighShell} from './thighShell';
import {fitSkirtWeave,type WeaveColumn} from './skirtWeave';
import {fitHipPanelSlide,type HipSurface} from './hipPanelSlide';
import type {ClothCrossing} from './clothCrossing';
import {fitHipSkinDepth} from './hipSkinDepth';

const V=()=>new Vector3(),Q=()=>new Quaternion(),smooth=(a:number,b:number,x:number)=>{x=Math.max(0,Math.min(1,(x-a)/(b-a)));return x*x*(3-2*x);};
type Link={bone:Bone;child:Bone;raw:Quaternion;rawPos:Vector3;world:Quaternion;bindQ:Quaternion;along:number};

// A raised thigh sweeps through the front of the hanging skirt before the hem
// can settle on the abdomen. Carry that contact across the front panel on its
// own authored chains. The waist remains the hinge; no material or leg edits.
export function fitRaisedSkirt(mesh:SkinnedMesh,pelvis:number,hips:number[],knees:number[],allowed:Map<number,number>){
  const {bones,boneInverses}=mesh.skeleton,id=new Map(bones.map((b,i)=>[b,i])),rest=(i:number)=>V().setFromMatrixPosition(boneInverses[i].clone().invert());
  const center=rest(hips[0]).lerp(rest(hips[1]),.5),length=rest(hips[0]).distanceTo(rest(knees[0]));
  const x=rest(hips[0]).sub(rest(hips[1])).normalize(),up=V().set(0,1,0);up.addScaledVector(x,-x.dot(up)).normalize();const front=x.clone().cross(up).normalize();
  const base=new Matrix4().makeBasis(x,up,front).scale(V().setScalar(length)).setPosition(center),invBase=base.clone().invert();
  const children=(b:Bone)=>b.children.filter((v):v is Bone=>(v as Bone).isBone);
  const chains:(WeaveColumn&{links:Link[];side:number;arc:number})[]=[];
  for(const [i,mask]of allowed){const b=bones[i];if(allowed.has(id.get(b.parent as Bone)!))continue;
    const anchor=rest(i).applyMatrix4(invBase);if(anchor.y<-.16||anchor.y>.65||Math.abs(Math.atan2(anchor.x,anchor.z))>2.06)continue;
    const gain=smooth(.19,.93,anchor.z/Math.hypot(anchor.x,anchor.z));
    const links:Link[]=[];let bone=b,arc=0,permit=mask;
    for(let j=0;j<40;j++){const cc=children(bone);if(cc.length!==1)break;const child=cc[0],ci=id.get(child)!;
      if(!allowed.has(ci)&&children(child).length)break;
      const dist=rest(ci).distanceTo(rest(id.get(bone)!))/length;if(!(dist>.005&&dist<.40))break;
      const bindQ=Q().setFromRotationMatrix(new Matrix4().extractRotation(invBase.clone().multiply(boneInverses[id.get(bone)!].clone().invert())));
      links.push({bone,child,raw:Q(),rawPos:V(),world:Q(),bindQ,along:arc+dist*.5});arc+=dist;bone=child;
      if(!allowed.has(ci))break;permit&=allowed.get(ci)!;}
    if(links.length>=3&&arc>.16&&arc<(gain?1.35:1.8)&&(permit&(anchor.x>=0?1:2))){const bind=[...links.map(l=>l.bone),links[links.length-1].child].map(b=>rest(id.get(b)!).applyMatrix4(invBase));
      chains.push({links,gain,side:anchor.x>=0?0:1,angle:Math.atan2(anchor.x,anchor.z),bind,raw:bind.map(V),posed:bind.map(V),arc});}
  }
  if(chains.filter(c=>c.gain>0).length<3)return null;
  const weave=fitSkirtWeave(chains),pelvisToWorld=new Matrix4(),worldToPelvis=new Matrix4(),knee=V(),from=V(),deltaQ=Q(),parentQ=Q(),rot=new Matrix4();
  const near=V(),dir=V(),out=V(),old=V(),sideAxis=V(),axis=V(),hint=Q(),align=Q(),bodyQ=Q(),frameQ=Q(),modelToLap=new Matrix4(),lapToModel=new Matrix4();
  const thighs:HipSurface[]=[];
  const torso=new Set(bones.flatMap((b,i)=>[b.name,b.userData.mmdBoneName,b.userData.mmdEnglishBoneName].some(n=>typeof n==='string'&&/^(下半身|腰|上半身[2２3３]?|lowerbody|pelvis|hips|waist|upperbody[23]?|spine[0-3]?|chest)$/i.test(n.replace(/[ _.-]/g,'')))?[i]:[]));
  let support:ReturnType<typeof fitAbdomenSupport>|undefined,slide:ReturnType<typeof fitHipPanelSlide>|undefined,applied=false,armed=false,finished=false;const pressure=[0,0];
  function restore(){if(!applied)return;for(const {links} of chains){for(const l of links){l.bone.quaternion.copy(l.raw);l.bone.position.copy(l.rawPos);}links[0].bone.updateWorldMatrix(true,true);}mesh.skeleton.update();applied=false;}
  function clearSkin(p:Vector3){support!.outside(p,.047);
    for(const s of thighs){const depth=s.field.clearance(near.copy(p).applyMatrix4(s.toLocal),out);if(depth>-.022)p.addScaledVector(out.transformDirection(s.toLap),(depth+.022)*s.length);}}
  return {restore,clear(){restore();armed=false;},seed(contact:(side:number,bindToModel:Matrix4)=>boolean,shells:{field:ThighShell;crossing?:ClothCrossing;material?:unknown;toLocal:Matrix4;toModel:Matrix4;length:number}[]){restore();armed=false;thighs.length=0;
    pelvisToWorld.multiplyMatrices(bones[pelvis].matrixWorld,boneInverses[pelvis]).multiply(base);worldToPelvis.copy(pelvisToWorld).invert();
    if(V().set(0,0,1).transformDirection(pelvisToWorld).y<.72)return;
    const bindToModel=mesh.matrixWorld.clone().invert().multiply(pelvisToWorld).multiply(invBase);
    for(let s=0;s<2;s++){knee.setFromMatrixPosition(bones[knees[s]].matrixWorld).applyMatrix4(worldToPelvis);
      from.setFromMatrixPosition(bones[hips[s]].matrixWorld).applyMatrix4(worldToPelvis);knee.sub(from).normalize();
      // Both abducted thighs must be in front of and raised relative to the hips.
      if((s?-knee.x:knee.x)<.18||knee.y<-.42||knee.z<.22||!contact(s,bindToModel))return;
      pressure[s]=smooth(-.47,.02,knee.y)*.15+.85;}
    support??=fitAbdomenSupport(mesh,invBase,torso);if(!support)return;support.seed(worldToPelvis);
    if(!Number.isFinite(support.front(0,.28)))return;
    // Some long trains are driven by a cage *inside* the fitted waist.
    // Turning that cage over would pull the unrelated outer layers through
    // the abdomen. It is not a free fabric hinge on the front surface.
    let hinges=0,buried=0;for(const c of chains){if(c.gain<.7)continue;hinges++;
      const p=from.setFromMatrixPosition(c.links[0].bone.matrixWorld).applyMatrix4(worldToPelvis);
      if(p.z<support.front(p.x,p.y)-.012)buried++;}
    if(!hinges||buried*2>=hinges)return;
    lapToModel.copy(mesh.matrixWorld).invert().multiply(pelvisToWorld);modelToLap.copy(lapToModel).invert();
    const audit=new Map<unknown,ReturnType<typeof fitHipSkinDepth>>();for(const [side,s]of shells.entries()){
      const toLocal=s.toLocal.clone().multiply(lapToModel),toLap=modelToLap.clone().multiply(s.toModel);
      // The thigh may lie directly across the front of the gathered waist:
      // pushing that wing laterally would make it float away from the hip.
      // Test the measured upper shaft in the apron band at its actual waist
      // depth. This is a pose-local no-slide region, not a preset-name switch.
      const hinge=chains.filter(c=>c.side===side&&Math.abs(c.angle)>.55&&Math.abs(c.angle)<1.3);
      const waist=hinge.length?hinge.reduce((v,c)=>v+c.bind[0].y,0)/hinge.length:0;
      const face=support.front(0,waist+.1);const shaft=axis.set(0,1,0).transformDirection(toLap),origin=out.setFromMatrixPosition(toLap);
      const at=(face-origin.z)/shaft.z,along=origin.y+at*shaft.y,blocked=at>0&&at<1&&along>waist-.14&&along<waist+.17;
      if(!blocked&&!audit.has(s.material))audit.set(s.material,fitHipSkinDepth(mesh,s.material,hips,worldToPelvis));
      thighs.push({field:s.field,crossing:s.crossing,depth:blocked?undefined:audit.get(s.material)??undefined,toLocal,toLap,length:s.length/length});}
    slide??=fitHipPanelSlide(mesh,chains,invBase);armed=true;
  },present(){if(!armed||applied||!support)return;
    pelvisToWorld.multiplyMatrices(mesh.matrixWorld,lapToModel);worldToPelvis.copy(pelvisToWorld).invert();
    if(!support.valid(worldToPelvis)){armed=false;return;}
    finished=false;bodyQ.setFromRotationMatrix(rot.extractRotation(pelvisToWorld));
    for(const {links,gain,side,raw,posed,bind,arc}of chains){
      raw[links.length].setFromMatrixPosition(links[links.length-1].child.matrixWorld).applyMatrix4(worldToPelvis);
      for(const [j,l]of links.entries()){l.raw.copy(l.bone.quaternion);l.rawPos.copy(l.bone.position);l.world.setFromRotationMatrix(rot.extractRotation(l.bone.matrixWorld)).normalize();
        raw[j].setFromMatrixPosition(l.bone.matrixWorld).applyMatrix4(worldToPelvis);}
      from.copy(bind[0]);posed[0].copy(raw[0]);
      // A tuck, not a half turn: follow the waistband down briefly, roll
      // towards the abdomen and turn the distal (embroidered) face out again.
      const fold=Math.min(.43,arc*.73)*pressure[side];
      for(const [j,l]of links.entries()){
        const next=posed[j+1].copy(raw[j+1]);if(!gain)continue;
        const s=l.along/fold,angle=Math.PI*(smooth(.04,.29,s)-smooth(.66,.92,s));
        const d=dir.subVectors(bind[j+1],bind[j]),r=Math.hypot(d.y,d.z),dx=d.x;
        const surface=support.front(from.x+dx,from.y-r*Math.cos(angle));
        from.x+=dx;from.y-=r*Math.cos(angle);from.z+=r*Math.sin(angle);
        if(Number.isFinite(surface))from.z+=Math.min(.025,Math.max(-.025,surface+.074+.035*Math.sin(Math.PI*Math.min(1,s))-from.z));
        from.y=Math.min(from.y,bind[0].y+.20);next.lerp(from,gain);
      }
    }
    weave(clearSkin);
    for(const {links,gain,raw,posed,bind}of chains){if(!gain)continue;
      for(const [j,l]of links.entries()){
        const parent=l.bone.parent!;if(j)l.bone.position.copy(near.copy(posed[j]).applyMatrix4(pelvisToWorld).applyMatrix4(rot.copy(parent.matrixWorld).invert()));
        dir.subVectors(posed[j+1],posed[j]).normalize();
        const swingTo=(v:Vector3,frame:Quaternion)=>{
          const swing=Math.atan2(v.y*dir.z-v.z*dir.y,v.y*dir.y+v.z*dir.z);
          sideAxis.set(1,0,0).transformDirection(pelvisToWorld);hint.setFromAxisAngle(sideAxis,swing);
          v.transformDirection(pelvisToWorld).applyQuaternion(hint);axis.copy(dir).transformDirection(pelvisToWorld);
          return align.setFromUnitVectors(v,axis).multiply(hint).multiply(frame);};
        // Near a 180-degree fold, shortest-arc rotation alone has no stable
        // roll axis. Preserve the across-strip frame before aligning its tip.
        deltaQ.copy(swingTo(old.subVectors(raw[j+1],raw[j]).normalize(),l.world));
        frameQ.copy(bodyQ).multiply(l.bindQ);deltaQ.slerp(swingTo(old.subVectors(bind[j+1],bind[j]).normalize(),frameQ),gain);
        parentQ.setFromRotationMatrix(rot.extractRotation(parent.matrixWorld)).normalize();l.bone.quaternion.copy(parentQ.invert().multiply(deltaQ));l.bone.updateWorldMatrix(false,false);}
      links[0].bone.updateWorldMatrix(false,true);
    }mesh.skeleton.update();applied=true;},
    finish(cached=false){if(!applied||finished||!slide)return;slide(worldToPelvis,pelvisToWorld,thighs,cached);mesh.skeleton.update();finished=true;},
    get active(){return applied;},
    // The cage follows skin, but the face/lining may sit to either side of
    // its weighted bones. Test the drawn vertex against the same support.
    supportVertex(bind:Vector3,p:Vector3,delta:Vector3){if(!applied||!support)return;
      near.copy(bind).applyMatrix4(invBase);if(near.z<=0||near.y>.45)return;
      // Only the central apron may need the small hem-on-belt clearance.
      // At the hip a single across-thigh exit can turn an edge into a long
      // white sliver. Leave these side strips entirely to the woven cage.
      const central=1-smooth(.10,.24,Math.abs(near.x));if(!central)return;
      near.copy(p).add(delta).applyMatrix4(modelToLap);if(near.y<-.05||near.y>.83||near.z<-.09)return;
      old.copy(near);support.outside(near,.025);if(old.equals(near))return;
      old.add(near.sub(old).clampLength(0,.020*central));delta.copy(old.applyMatrix4(lapToModel)).sub(p);
    },};
}
