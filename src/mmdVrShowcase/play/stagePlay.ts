import { create } from 'zustand';
import type {Vector3} from 'three';
import type { SceneryId } from '../scenery/catalog';
import { TOYS, shelfToys, type Hand, type Toy } from './propCatalog';

export type { Hand, Toy, StoryRoom } from './propCatalog';
export { isStoryRoom } from './propCatalog';
export type CharacterToy = { assetId:string; toy:Toy; hand:Hand; tilt:number; inset:number; turn:number };
type Owners = { held:{toy:Toy; hand:Hand}|null; character:CharacterToy|null };
export const ownerOf = (s:Owners) => s.held ?? s.character;
export const canUseGrip = (s:Owners,toy:Toy,hand:Hand,room:SceneryId) =>
  s.held?.toy===toy && s.held.hand===hand && (TOYS[toy].portable===true || TOYS[toy].home===room);
/** Grip starts the portable prop, but a room-specific interaction (e.g. ferry
 * gate) must never run against coincident coordinates in another set. */
export function handleGripStart(toy:Toy,room:SceneryId,at:Vector3,dir:Vector3){
  const item=TOYS[toy];if(item.home===null || item.home===room)item.onGrip?.(at,dir);
}
export const canGiveTo = (actor:{visible:boolean; wrists?:Partial<Record<Hand,boolean>>}|undefined, hand:Hand) =>
  !!actor?.visible && !!actor.wrists?.[hand];

type Play = Owners & {
  equip:(toy:Toy,hand:Hand)=>void; stow:()=>void; reset:()=>void;
  give:(assetId:string,hand:Hand)=>void; adjust:(tilt:number,inset:number,turn?:number)=>void;
};
export const useStagePlay = create<Play>((set,get)=>{
  const release = () => {const old=ownerOf(get()); if(old)TOYS[old.toy].onStow?.();};
  return {
    held:null, character:null,
    equip:(toy,hand)=>{
      if(ownerOf(get())?.toy!==toy)release();
      TOYS[toy].onEquip?.();
      set({held:{toy,hand},character:null});
    },
    give:(assetId,hand)=>{
      const {held,character}=get();
      const toy=held?.toy??(character?.assetId===assetId?character.toy:null);
      // Its player keeps the transmitter. bindRemoteEgg assigns the separate receiver.
      if(toy && toy!=='remoteEgg')set({held:null,character:{assetId,hand,toy,tilt:0,inset:0,turn:0}});
    },
    adjust:(tilt,inset,turn=0)=>{const c=get().character;if(c)set({character:{...c,turn:(c.turn+turn+360)%360,
      tilt:Math.max(-90,Math.min(90,c.tilt+tilt)),inset:Math.max(-5,Math.min(5,c.inset+inset))}});},
    stow:()=>{release();set({held:null,character:null});},
    reset:()=>{
      release(); // End the active hand effect, then clear even unowned room artwork.
      for(const toy of shelfToys)TOYS[toy].onLeave?.();
      set({held:null,character:null});
    },
  };
});

/** Screen cues may create a hand proxy; a second wrist selection is only a transfer. */
export function giveScreenToy(assetId:string,toy:Toy,hand:Hand,room:SceneryId) {
  const play=useStagePlay.getState();
  if(play.held?.toy!==toy && !(play.character?.assetId===assetId && play.character.toy===toy)) {
    play.equip(toy,hand);
    if(TOYS[toy].portable || TOYS[toy].home===room)TOYS[toy].onScreenEquip?.();
  }
  play.give(assetId,hand);
}

/** After UI, tracking loss or transfer, a held grip must be released before use. */
export function gripLatch() {
  let armed=false, down=false;
  return (usable:boolean,pressed:boolean) => {
    if(!usable){armed=false;down=false;return 'off';}
    if(!pressed){armed=true;down=false;return 'off';}
    if(!armed)return 'off';
    if(!down){down=true;return 'start';}
    return 'held';
  };
}
