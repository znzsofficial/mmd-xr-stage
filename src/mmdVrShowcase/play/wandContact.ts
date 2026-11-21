import { Vector3, type Object3D, type Scene, type SkinnedMesh } from 'three';
import {createMmdVrHapticDriver,createMmdVrHapticGate,getMmdVrHapticFeedback,type MmdVrHapticLevel} from '../mmdVrHaptics';
import {findWandInput,type WandHead} from './wandHead';
import {useWandResponse,type WandResponse} from './wandResponse';
import {createWandSurface,type WandModel} from './wandSurface';

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
  const gate=createMmdVrHapticGate(),haptics=createMmdVrHapticDriver();
  const hit={depth:0,axis:new Vector3()},bestAxis=new Vector3();
  let pad:Gamepad|null=null,pressed:WandHead|null=null,session:XRSession|null=null;
  const listen=(next:XRSession|null)=>{
    if(next===session)return;
    for(const event of ['end','visibilitychange','inputsourceschange'] as const){session?.removeEventListener(event,reset);next?.addEventListener(event,reset);}
    session=next;
  };
  function reset(){blend.restore();pressed?.release();pressed=null;pad=null;gate.reset();haptics.reset();listen(null);}
  function advance(scene:Scene,wrist:Object3D|null,held:boolean,frame:XRFrame|undefined,active:boolean,level:MmdVrHapticLevel,
    models:readonly {id:string;visible:boolean}[],getModel:(id:string)=>WandModel|null){
    const settings=useWandResponse.getState();
    const input=settings.enabled&&findWandInput(scene,wrist,held,frame);
    if(!input){if(pressed||session)reset();return;}
    const {head,gamepad}=input;
    if(pad!==gamepad||pressed!==head){reset();pressed=head;pad=gamepad;}
    listen(frame?.session??null);
    let best=0,actor:WandModel|null=null,id='';
    for(const m of models){if(!m.visible)continue;
      const model=getModel(m.id);if(!model?.root.visible)continue;
      let surface=surfaces.get(model.root);if(!surface){surface=createWandSurface(model);surfaces.set(model.root,surface);}
      // Warm while the wand is equipped, even before the first squeeze. The
      // entire cold/hot allowance is divided among the mounted actor slots.
      const deadline=performance.now()+(active?2.4:1)/Math.max(1,models.length);
      if(!active){surface.warm(deadline);continue;}
      surface.query(head.pivot,hit,deadline);
      if(hit.depth>best){best=hit.depth;bestAxis.copy(hit.axis);actor=model;id=m.id;}
    }
    if(!actor){head.release();gate.update(false,performance.now());return;}
    head.press(bestAxis,best);blend.apply(actor.mesh,settings.byActor[id],best*4);
    if(gate.update(true,performance.now())&&pad&&level!=='off')void haptics.pulse(pad,getMmdVrHapticFeedback(.5,level));
  }
  return {restore:blend.restore,advance,reset};
}
