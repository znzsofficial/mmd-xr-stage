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

/** Multi-floor rooms supply bounded pick surfaces; never substitute an
 * infinite plane for the level the viewer actually pointed at. */
const groundDeck=(size:number)=>({x:0,y:0,z:0,w:size,d:size});
const commonGround=[groundDeck(72)],courtGround=[groundDeck(108)],songhouseDecks=[...commonGround,...PICK_DECKS];
export function roomPickDecks(room:SceneryId){
  switch(room){
    case 'arcadeHall':return arcadeDecks;
    case 'qinhuai':return songhouseDecks;
    case 'astralCourt':return courtGround;
    default:return commonGround;
  }
}
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
