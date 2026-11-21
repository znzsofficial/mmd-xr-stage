import { Vector3, type Object3D, type Scene, type SkinnedMesh } from 'three';
import {createMmdVrHapticDriver,createMmdVrHapticGate,getMmdVrHapticFeedback,type MmdVrHapticLevel} from '../mmdVrHaptics';
import {findWandInput,type ContactToy,type WandHead} from './wandHead';
import {useWandResponse,type WandResponse} from './wandResponse';
import {createWandSurface,type WandModel} from './wandSurface';
import {createWandRhythm,useWandMotor} from './wandMotor';
import type {Hand} from './propCatalog';

/** Raw values are captured after evaluation, including manual overrides.
 * Never set a VMD track or a persistent MMD morph weight for contact. */
export function createWandBlend(){
  const saved:{weights:number[];index:number;base:number}[]=[];
  function restore(){for(const {weights,index,base} of saved)weights[index]=base;saved.length=0;}
  function apply(source:SkinnedMesh,response:WandResponse|undefined,pressure:number){
    restore();if(!response?.morph||!response.strength||pressure<=0)return;
    const name=response.morph,dict=source.morphTargetDictionary;
    if(!dict||!Object.hasOwn(dict,name))return;
    const index=dict[name],weights=source.morphTargetInfluences;
    if(!weights||!Number.isFinite(weights[index]))return;
    const base=weights[index],target=base+Math.max(0,1-base)*response.strength*Math.min(1,pressure);
    if(base===target)return;
    saved.push({weights,index,base});weights[index]=target;
    const bodies:SkinnedMesh[]=source.userData.mmdMorphSplitBodyMeshes??[];
    for(const b of bodies){const w=b.morphTargetInfluences,local=b.userData.mmdMorphSplitBody?.morphTargetIndices?.indexOf(index)??-1;
      if(w&&w!==weights&&local>=0){saved.push({weights:w,index:local,base:w[local]});w[local]=target;}}
  }
  return {apply,restore};
}

export function createRoomWand(){
  const blend=createWandBlend(),surfaces=new WeakMap<Object3D,ReturnType<typeof createWandSurface>>();
  const gate=createMmdVrHapticGate(),haptics=createMmdVrHapticDriver(),rhythm=createWandRhythm();
  const hit={depth:0,axis:new Vector3()},bestAxis=new Vector3();
  let pad:Gamepad|null=null,pressed:WandHead|null=null,session:XRSession|null=null;
  let driving=false;
  const listen=(next:XRSession|null)=>{
    if(next===session)return;
    for(const event of ['end','visibilitychange','inputsourceschange'] as const){session?.removeEventListener(event,reset);next?.addEventListener(event,reset);}
    session=next;
  };
  function stopDrive(){if(driving){driving=false;rhythm.reset();haptics.stop();}}
  function clearContact(){blend.restore();pressed?.release();gate.reset();rhythm.clearAccent();}
  function reset(){clearContact();stopDrive();pressed=null;pad=null;haptics.reset();listen(null);}
  function advance(scene:Scene,wrist:Object3D|null,toy:ContactToy,hand:Hand|null,frame:XRFrame|undefined,frameMs:number,level:MmdVrHapticLevel,
    models:readonly {id:string;visible:boolean}[],getModel:(id:string)=>WandModel|null){
    const settings=toy==='wand'?useWandResponse.getState():null,motor=useWandMotor.getState(),active=toy==='dildo'||motor.speed!==0;
    const input=findWandInput(scene,wrist,toy,hand,frame);
    if(!input){if(pressed||session)reset();return;}
    const {head,gamepad}=input;
    if(pad!==gamepad||pressed!==head){reset();pressed=head;pad=gamepad;}
    listen(frame?.session??null);
    let best=0,actor:WandModel|null=null,id='';
    if(settings?.enabled!==false)for(const m of models){if(!m.visible)continue;
      const model=getModel(m.id);if(!model?.root.visible)continue;
      let surface=surfaces.get(model.root);if(!surface){surface=createWandSurface(model);surfaces.set(model.root,surface);}
      // Warm while the wand is equipped, even before the first squeeze. The
      // entire cold/hot allowance is divided among the mounted actor slots.
      const deadline=performance.now()+(active?2.4:1)/Math.max(1,models.length);
      if(!active){surface.warm(deadline);continue;}
      surface.query(head.pivot,head.cap,hit,deadline);
      if(hit.depth>best){best=hit.depth;bestAxis.copy(hit.axis);actor=model;id=m.id;}
    }
    if(actor){head.press(bestAxis,best);if(settings)blend.apply(actor.mesh,settings.byActor[id],best*4);}else head.release();
    // Wrist-held props keep their surface and motor animation, without a pad.
    if(!pad)return;
    const onset=gate.update(!!actor,frameMs);
    if(level==='off'){stopDrive();return;}
    if(toy==='wand'){
      if(!motor.speed){stopDrive();return;}
      driving=true;
      const power=rhythm.sample(motor,frameMs,onset);
      if(power!==null)void haptics.pulse(pad,getMmdVrHapticFeedback(power,level));
    }else if(onset)void haptics.pulse(pad,getMmdVrHapticFeedback(.5,level));
  }
  function resetWand(){if(pressed?.toy==='wand')reset();}
  return {restore:blend.restore,advance,reset,resetWand,stopDrive,
    clearWandContact(){if(pressed?.toy==='wand')clearContact();}};
}
