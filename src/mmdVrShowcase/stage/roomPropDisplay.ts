import type {Clock,Object3D,Scene} from 'three';
import {useBackpack} from '../backpack';
import {useHudWorldInput} from '../components/hudWorldInput';
import type {MmdRuntimeHandle} from '../mmdRuntime/mmdRuntime';
import {useMmdVrStore} from '../mmdVrStore';
import {createApertureLayer} from '../pelvic/aperture';
import {usePelvic} from '../pelvic/store';
import type {PelvicRigHandle} from '../pelvic/PelvicRig';
import {createActorResponse} from '../play/actorResponse';
import {useStagePlay} from '../play/stagePlay';
import {createRoomWand} from '../play/wandContact';
import {useWandMotor} from '../play/wandMotor';
import {forgetWandResponses,useWandResponse} from '../play/wandResponse';
import type {SceneryId} from '../scenery/catalog';

/** These layers can write the same morph. Always unwind them in the opposite
 * order, whether the next consumer is VMD, Bullet or the pose editor. */
export function createRoomPropDisplay(){
  const wand=createRoomWand(),aperture=createApertureLayer(),response=createActorResponse();
  function restore(){wand.restore();response.restore();aperture.restore();}
  function reset(){wand.reset();response.reset();aperture.restore();}
  function subscribe(scenery:SceneryId){
    const off=[
      useWandMotor.subscribe(s=>{if(!s.speed)wand.resetWand();}),
      useWandResponse.subscribe((s,p)=>{if(!s.enabled&&p.enabled)wand.clearWandContact();else if(s.byActor!==p.byActor)wand.restore();}),
      usePelvic.subscribe((s,p)=>{
        const a=p.active;
        if(a?.running&&(!s.active?.running||a.token!==s.active.token)){
          wand.restore();response.reset();aperture.restore();
        }else if(a?.running&&s.byAsset[a.assetId]?.responseMorph!==p.byAsset[a.assetId]?.responseMorph){
          wand.restore();response.reset();
        }
      }),
      useHudWorldInput.subscribe(s=>{if(s.blocked)wand.stopDrive();}),
      useBackpack.subscribe(s=>{if(s.busy||s.draft||s.selected)wand.stopDrive();}),
      useStagePlay.subscribe((s,p)=>{if(s.held!==p.held||s.stand!==p.stand||s.character?.assetId!==p.character?.assetId||
        s.character?.hand!==p.character?.hand||s.character?.toy!==p.character?.toy)reset();}),
      useMmdVrStore.subscribe((s,p)=>{
        if(s.models!==p.models)forgetWandResponses(p.models.filter(m=>!s.models.some(n=>n.id===m.id)).map(m=>m.id));
        if(!s.overlayOpen||s.prefs.scenery!==scenery||s.physicsBusy||s.assetLoad.running||s.physicsFatal)reset();
        else if(s.prefs.physicsHapticLevel==='off')wand.stopDrive();
      }),
    ];
    return ()=>{off.forEach(unsubscribe=>unsubscribe());reset();forgetWandResponses(useMmdVrStore.getState().models.map(m=>m.id));};
  }
  function present(runtime:Pick<MmdRuntimeHandle,'getModelSurface'>,scene:Scene,wrist:Object3D|null,rig:PelvicRigHandle|null,frame:XRFrame|undefined,clock:Pick<Clock,'oldTime'>){
    const opening=rig?.getAperture();
    if(opening)aperture.apply(opening.assetId,runtime.getModelSurface(opening.runtimeId),opening.amount);
    const contact=rig?.getActorContact()??null, profile=contact&&usePelvic.getState().byAsset[contact.assetId];
    response.present(contact,profile&&contact?runtime.getModelSurface(contact.runtimeId):null,profile?.responseMorph);
    const {stand,held,character}=useStagePlay.getState(),toy=(held??character??stand)?.toy;
    if(toy!=='wand'&&toy!=='dildo')return;
    const stage=useMmdVrStore.getState();
    wand.advance(scene,stand?rig?.getStandRoot()??null:wrist,toy,held?.hand??null,frame,clock.oldTime,
      stage.prefs.physicsHapticLevel,stage.models,runtime.getModelSurface);
  }
  return {restore,subscribe,present};
}
