import type { Object3D, SkinnedMesh } from 'three';
import type { ContactMotion } from '../pelvic/contract';
import {faceMorphNames,pickFaceMorphs} from './faceMorphs';
import {createVertexMorphLayer} from './vertexMorphLayer';
import type {WandModel} from './wandSurface';
import {contactHead} from './contactHead';

/** Borrowed only for the current post-pose pass. depthM is measured along
 * the verified arc, in reference metres so actor scale doesn't change feel. */
export type ActorContactFrame={assetId:string;runtimeId:string;root:Object3D;token:number;motion:ContactMotion;depthM:number;dt:number};
const smooth=(n:number)=>{const x=Math.min(1,Math.max(0,n));return x*x*(3-2*x);};

// Both contact gestures and the wearable rhythm use the mounted mesh's approved
// face channels. An unsupported face yields no gesture, never a garment morph.
const automaticFaces=new WeakMap<SkinnedMesh,string[]>();
export function actorFacePalette(mesh:SkinnedMesh,choice?:string|null){
  if(choice!==undefined)return pickFaceMorphs(faceMorphNames(mesh),choice);
  let names=automaticFaces.get(mesh);
  if(!names){names=pickFaceMorphs(faceMorphNames(mesh),undefined);automaticFaces.set(mesh,names);}
  return names;
}

export function createActorResponse(){
  const layers=Array.from({length:4},createVertexMorphLayer), weights=[0,0,0,0],beforeExit=[0,0,0];
  let names:string[]=[], owner:SkinnedMesh|null=null, token=-1, choice:string|null|undefined;
  let age=0, moving=0, depth=0, mark=0, quiet=0, release=-1;
  let velocity=0,breath=0,effort=0,pitch=0,exitPitch=0;
  const head=contactHead();
  function restore(){head.restore();for(let i=layers.length-1;i>=0;i--)layers[i].restore();}
  function reset(){restore();owner=null;token=-1;release=-1;}
  function present(f:ActorContactFrame|null,surface:WandModel|null,selected:string|null|undefined){
    restore();
    if(!f||!surface||surface.root!==f.root||!f.root.visible||selected===null||!(f.dt>0&&f.dt<=.12)||!Number.isFinite(f.depthM)){reset();return;}
    if(f.motion==='enter'){
      names=actorFacePalette(surface.mesh,selected);
      if(!names.length&&selected!==undefined){reset();return;}
      owner=surface.mesh;token=f.token;choice=selected;
      age=moving=velocity=breath=effort=pitch=0;quiet=.14;release=-1;depth=mark=f.depthM;
    }else if(owner!==surface.mesh||token!==f.token||selected!==choice){reset();return;}

    if(f.motion==='enter'||f.motion==='inside'){
      if(release>=0){reset();return;}
       const oldDepth=depth;
       depth+=(f.depthM-depth)*-Math.expm1(-f.dt/.045);
       velocity+=((depth-oldDepth)/f.dt-velocity)*-Math.expm1(-f.dt/.065);
      // Count net travel, not the sum of absolute noisy frame deltas. The
      // short quiet window bridges slow samples and settles on a stopped rod.
      quiet+=f.dt;
      if(Math.abs(depth-mark)>=.0016){mark=depth;quiet=0;}
      const target=quiet<.14 && age>0 ? 1 : 0;
      moving+=(target-moving)*-Math.expm1(-f.dt/.065);
      const touch=1-smooth((age-.065)/.13);
      weights[0]=.95*touch;
       // A slow advance parts the lips; faster inward travel narrows the
       // eyes. Drawing back eases them before the actual outside crossing.
       // In a dwell let the held breath out through parted lips rather than
       // looping the moving expression or replaying an entry blink.
       const pace=smooth(Math.abs(velocity)/.15),inward=smooth((velocity+.035)/.07);
       effort+=((pace*moving)-effort)*-Math.expm1(-f.dt/(pace>effort?.09:.46));
       breath+=f.dt*(.36+.42*effort)*Math.PI*2;
       const held=1-moving,wave=.5-.5*Math.cos(breath),open=(1-touch);
       weights[1]=open*(moving*(.28+.48*pace+.14*inward)+held*(.06+.23*wave+.12*effort));
       weights[2]=open*(moving*(.12+.46*inward*pace)+held*(.31+.14*(1-wave)));
       const lift=-.075*touch-open*(moving*(.018+.075*pace*inward)+held*(.012+.031*wave));
       pitch+=(lift-pitch)*-Math.expm1(-f.dt/.09);
      weights[3]=0;age+=f.dt;
    }else{
      if(f.motion==='withdraw'){release=0;exitPitch=pitch;for(let i=0;i<3;i++)beforeExit[i]=weights[i];}
      else if(release<0){reset();return;}
      if(release>=.38){reset();return;}
      // Let even a one-frame tap read as a blink. Only a verified withdrawal
      // may carry this brief crossfade; interruptions restore in one frame.
      const carry=.68*(1-smooth(release/.095));
      for(let i=0;i<3;i++)weights[i]=beforeExit[i]*carry;
       const exhale=(1-carry)*(1-smooth(release/.38));
       pitch=exitPitch*(1-smooth(release/.38));
       weights[1]+=.30*effort*exhale;weights[3]=.54*exhale;release+=f.dt;
    }
    // A model may have only one safe shape. Sum the gesture envelopes before
    // touching its source and split-body slots, keeping one raw value per slot.
    for(let i=0;i<names.length;i++){
      if(names.indexOf(names[i])!==i)continue;
      let amount=weights[i];for(let j=i+1;j<names.length;j++)if(names[j]===names[i])amount+=weights[j];
      if(amount>0)layers[i].apply(names[i],surface,amount);
    }
    if(selected===undefined)head.apply(surface.mesh,pitch);
  }
  return {present,restore,reset};
}
