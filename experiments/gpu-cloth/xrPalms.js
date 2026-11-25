import {Vector3} from 'three';

const position=pose=>{
  const p=pose?.transform.position;
  return p&&Number.isFinite(p.x)&&Number.isFinite(p.y)&&Number.isFinite(p.z)?p:null;
};

// The lab renders two contact markers, not articulated hands. For a joint
// source place the marker halfway from wrist to the centre of the knuckles.
function read(source,frame,space,out){
  if(source.hand){
    const joint=name=>{const j=source.hand.get(name);return j&&position(frame.getJointPose?.(j,space));};
    const w=joint('wrist'),a=joint('index-finger-phalanx-proximal'),b=joint('pinky-finger-phalanx-proximal');
    if(!w||!a||!b)return false;
    out.copy(w).multiplyScalar(.5).addScaledVector(a,.25).addScaledVector(b,.25);
  }else{
    const p=source.gripSpace&&position(frame.getPose(source.gripSpace,space));if(!p)return false;out.copy(p);
  }
  return true;
}

export function xrPalms(){
  const owners=[null,null],points=[new Vector3(),new Vector3()],pair=[null,null],kinds=['missing','missing'];
  return {read(frame,space,actorFromWorld){
    // Keep a still-valid owner on a side, even when a second input appears or
    // the runtime reorders its sources. A replacement gets a parked frame.
    for(let i=0;i<2;i++){
      const sources=frame.session.inputSources,side=i?'right':'left',point=points[i],last=owners[i];let next=null;
      pair[i]=null;kinds[i]='missing';
      if(frame.session.visibilityState!=='visible'){owners[i]=null;continue;}
      if(last&&Array.prototype.includes.call(sources,last)&&read(last,frame,space,point))next=last;
      else for(const source of sources){if(source!==last&&source.handedness===side&&read(source,frame,space,point)){next=source;break;}}
      owners[i]=next;if(!next||(last&&last!==next))continue;
      pair[i]=point.applyMatrix4(actorFromWorld);kinds[i]=next.hand?'hand':'grip';
    }
    return pair;
  },kinds,reset(){owners.fill(null);pair.fill(null);kinds.fill('missing');}};
}
