import type { Object3D, SkinnedMesh } from 'three';
import type { ContactMotion } from '../pelvic/contract';
import {faceMorphNames,pickFaceMorphs} from './faceMorphs';
import {createVertexMorphLayer} from './vertexMorphLayer';
import type {WandModel} from './wandSurface';

/** Borrowed only for the current post-pose pass. depthM is measured along
 * the verified arc, in reference metres so actor scale doesn't change feel. */
export type ActorContactFrame={assetId:string;runtimeId:string;root:Object3D;token:number;motion:ContactMotion;depthM:number;dt:number};
const smooth=(n:number)=>{const x=Math.min(1,Math.max(0,n));return x*x*(3-2*x);};

export function createActorResponse(){
  const layers=Array.from({length:4},createVertexMorphLayer), weights=[0,0,0,0],beforeExit=[0,0,0];
  let names:string[]=[], owner:SkinnedMesh|null=null, token=-1, choice:string|null|undefined;
  let age=0, moving=0, depth=0, mark=0, quiet=0, release=-1;
  function restore(){for(let i=layers.length-1;i>=0;i--)layers[i].restore();}
  function reset(){restore();owner=null;token=-1;release=-1;}
  function present(f:ActorContactFrame|null,surface:WandModel|null,selected:string|null|undefined){
    restore();
    if(!f||!surface||surface.root!==f.root||!f.root.visible||selected===null||!(f.dt>0&&f.dt<=.12)||!Number.isFinite(f.depthM)){reset();return;}
    if(f.motion==='enter'){
      names=pickFaceMorphs(faceMorphNames(surface.mesh),selected);
      if(!names.length){reset();return;}
      owner=surface.mesh;token=f.token;choice=selected;
      age=moving=0;quiet=.14;release=-1;depth=mark=f.depthM;
    }else if(owner!==surface.mesh||token!==f.token||selected!==choice){reset();return;}

    if(f.motion==='enter'||f.motion==='inside'){
      if(release>=0){reset();return;}
      depth+=(f.depthM-depth)*-Math.expm1(-f.dt/.045);
      // Count net travel, not the sum of absolute noisy frame deltas. The
      // short quiet window bridges slow samples and settles on a stopped rod.
      quiet+=f.dt;
      if(Math.abs(depth-mark)>=.0016){mark=depth;quiet=0;}
      const target=quiet<.14 && age>0 ? 1 : 0;
      moving+=(target-moving)*-Math.expm1(-f.dt/.065);
      const touch=1-smooth((age-.065)/.13);
      weights[0]=.95*touch;
      weights[1]=.76*(1-touch)*moving;
      weights[2]=.34*(1-touch)*(1-moving);
      weights[3]=0;age+=f.dt;
    }else{
      if(f.motion==='withdraw'){release=0;for(let i=0;i<3;i++)beforeExit[i]=weights[i];}
      else if(release<0){reset();return;}
      if(release>=.38){reset();return;}
      // Let even a one-frame tap read as a blink. Only a verified withdrawal
      // may carry this brief crossfade; interruptions restore in one frame.
      const carry=.68*(1-smooth(release/.095));
      for(let i=0;i<3;i++)weights[i]=beforeExit[i]*carry;
      weights[3]=.54*(1-carry)*(1-smooth(release/.38));release+=f.dt;
    }
    // A model may have only one safe shape. Sum the gesture envelopes before
    // touching its source and split-body slots, keeping one raw value per slot.
    for(let i=0;i<names.length;i++){
      if(names.indexOf(names[i])!==i)continue;
      let amount=weights[i];for(let j=i+1;j<names.length;j++)if(names[j]===names[i])amount+=weights[j];
      if(amount>0)layers[i].apply(names[i],surface,amount);
    }
  }
  return {present,restore,reset};
}
