import {Matrix4} from 'three';
import {clearMmdVrControllerColliders,setMmdVrControllerColliderMatrix} from '../../src/mmdVrShowcase/xr/contact/controllerSlots';
import {clearMmdVrHandColliders,setMmdVrHandColliderMatrix} from '../../src/mmdVrShowcase/xr/contact/handSlots';
import {HAND_JOINTS,handContactLayout,handReferenceRadius} from '../../src/mmdVrShowcase/xr/contact/handContactProfile';

// This floor has an identity XR origin. Supply the same world-space matrices
// that XRSpace normally publishes; the runtime owns visual/model conversion.
export function trackedContacts(){
  const m=new Matrix4(),offsets=HAND_JOINTS.map(()=>new Matrix4()),owners=Array(4).fill(null);
  let lastRadius,parkNext=true;
  function clear(){clearMmdVrControllerColliders();clearMmdVrHandColliders();}
  function source(list,index,side,hand){
    const old=owners[index];if(old && Array.prototype.includes.call(list,old))return old;
    let next=null;for(const s of list)if(s.handedness===side&&!!s.hand===hand){next=s;break;}
    owners[index]=next;return old?null:next;
  }
  return {reset(){owners.fill(null);clear();parkNext=true;},sample(frame,space,radius){
    if(parkNext){clear();parkNext=false;return;}
    if(radius!==lastRadius){lastRadius=radius;offsets.forEach((offset,i)=>{
      const {rotateX,offsetZ}=handContactLayout(i,handReferenceRadius(radius));offset.makeRotationX(rotateX).setPosition(0,0,offsetZ);
    });}
    const list=frame.session.inputSources;
    for(let side=0;side<2;side++){
      const name=side?'right':'left',grip=source(list,side,name,false)?.gripSpace,pose=grip&&frame.getPose(grip,space)?.transform;
      setMmdVrControllerColliderMatrix(side,pose?.matrix?m.fromArray(pose.matrix):pose?.position?m.makeTranslation(pose.position.x,pose.position.y,pose.position.z):null);
      const hand=source(list,2+side,name,true)?.hand;
      for(let i=0;i<HAND_JOINTS.length;i++){
        const joint=hand?.get(HAND_JOINTS[i]),m4=joint&&frame.getJointPose(joint,space)?.transform.matrix;
        setMmdVrHandColliderMatrix(side*HAND_JOINTS.length+i,m4?m.fromArray(m4).multiply(offsets[i]):null);
      }
    }
  }};
}
