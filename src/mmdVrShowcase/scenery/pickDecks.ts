import type {SceneryId} from './catalog';
import {clinicNavigation} from './clinic/clinicNavigation';
import {lawnClinicPlacementVisible} from './clinic/clinicApproach';
import {weddingVisible} from './wedding/weddingLayout';
import {retreatVisible} from './retreat/retreatLayout';
import {planetSight} from './planet/planetSightline';
import {velvetSight} from './velvet/velvetLayout';
import {chamberSight} from './chamber/chamberLayout';
import {arcadeSight,pickDecks as arcadeDecks} from './arcade/arcadeLayout';
import {PICK_DECKS,songhousePlacementVisible} from './qinhuai/songhouseLayout';

/** Additional bounded planes above the common ground picker. A point on the
 * infinite lower plane behind a plinth is never a substitute for its top. */
export const elevatedPickDecks=(room:SceneryId)=>room==='qinhuai'?PICK_DECKS:[];
export const roomPickDecks=(room:SceneryId)=>room==='arcadeHall'?arcadeDecks:[{x:0,y:0,z:0,w:room==='astralCourt'?108:72,d:room==='astralCourt'?108:72},...elevatedPickDecks(room)];
export function visiblePick(room:SceneryId,from:{x:number;y:number;z:number},x:number,y:number,z:number){
  switch(room){
    case 'arcadeHall':return arcadeSight(from,x,y,z);
    case 'glassPlanet':return planetSight(from,x,y,z);
    case 'velvetStudio':return velvetSight(from,x,y,z);
    case 'medievalChamber':return chamberSight(from,x,y,z);
    case 'qinhuai':return songhousePlacementVisible(from,x,y,z);
    case 'clinic':return clinicNavigation.visible(from,x,z);
    case 'lawn':return lawnClinicPlacementVisible(from,x,z);
    case 'weddingCourt':return weddingVisible(from,x,z);
    case 'lanternSuite': case 'moonSpa':return retreatVisible(room,from,x,y,z);
    default:return true;
  }
}
