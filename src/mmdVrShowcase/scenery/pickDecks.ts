import type {SceneryId} from './catalog';
import {clinicPlacementVisible} from './clinic/clinicLayout';
import {PICK_DECKS,songhousePlacementVisible} from './qinhuai/songhouseLayout';

/** Additional bounded planes above the common ground picker. A point on the
 * infinite lower plane behind a plinth is never a substitute for its top. */
export const elevatedPickDecks=(room:SceneryId)=>room==='qinhuai'?PICK_DECKS:[];
export function visiblePick(room:SceneryId,from:{x:number;y:number;z:number},x:number,y:number,z:number){
  return room==='qinhuai'?songhousePlacementVisible(from,x,y,z):room!=='clinic'||clinicPlacementVisible(from,x,z);
}
