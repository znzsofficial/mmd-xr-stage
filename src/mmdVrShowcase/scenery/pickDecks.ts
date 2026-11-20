import type {SceneryId} from './catalog';
import {clinicPlacementVisible} from './clinic/clinicLayout';
import {lawnClinicPlacementVisible} from './clinic/clinicApproach';
import {weddingVisible} from './wedding/weddingLayout';
import {PICK_DECKS,songhousePlacementVisible} from './qinhuai/songhouseLayout';

/** Additional bounded planes above the common ground picker. A point on the
 * infinite lower plane behind a plinth is never a substitute for its top. */
export const elevatedPickDecks=(room:SceneryId)=>room==='qinhuai'?PICK_DECKS:[];
export function visiblePick(room:SceneryId,from:{x:number;y:number;z:number},x:number,y:number,z:number){
  switch(room){
    case 'qinhuai':return songhousePlacementVisible(from,x,y,z);
    case 'clinic':return clinicPlacementVisible(from,x,z);
    case 'lawn':return lawnClinicPlacementVisible(from,x,z);
    case 'weddingCourt':return weddingVisible(from,x,z);
    default:return true;
  }
}
