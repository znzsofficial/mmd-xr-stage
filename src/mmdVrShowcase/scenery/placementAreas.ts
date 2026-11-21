import type { SceneryId } from './catalog';
import { chapelPlace, classroomPlace, courtPlace, lawnPlace, liveHousePlace, plinthPlace, poolPlace } from './flatPlacement';
import { clinicNavigation } from './clinic/clinicNavigation';
import { lawnClinicPlacementVisible } from './clinic/clinicApproach';
import { PICK_DECKS, songhouseClear, songhouseHeight, songhousePlacementVisible } from './qinhuai/songhouseLayout';
import { weddingClear, weddingVisible } from './wedding/weddingLayout';
import { retreatPlace, retreatVisible, type Retreat } from './retreat/retreatLayout';
import { planetPlace } from './planet/planetLayout';
import { planetSight } from './planet/planetSightline';
import {portalPlacementSight} from './portalLayout';
import { velvetPlace, velvetSight } from './velvet/velvetLayout';
import { chamberPlace, chamberSight } from './chamber/chamberLayout';
import { arcadePlace, arcadeSight, pickDecks } from './arcade/arcadePlacement';
import { streetsIn } from './routes/streets';
import type { PickDeck, RoutePoint as Point } from './routes/types';

type Sight = (from: Point, x: number, y: number, z: number) => boolean;
type PlacementRule = {
  resolve: (x: number, z: number, supportY?: number) => number | null;
  decks?: readonly PickDeck[];
  visible?: Sight;
};
const ground = (size: number): PickDeck => ({ x: 0, y: 0, z: 0, w: size, d: size });
const commonDecks = [ground(72)];
const flat = (clear: (x: number, z: number) => boolean, visible?: Sight): PlacementRule => ({
  resolve: (x,z) => clear(x,z) ? 0 : null, visible,
});
const retreat = (room: Retreat) => flat((x,z) => retreatPlace(room,x,z), (from,x,y,z) => retreatVisible(room,from,x,y,z));

// One entry per set, independent of render components and the player's ground motor.
const rules: Record<SceneryId, PlacementRule> = {
  floor: flat(plinthPlace),
  liveHouse: flat(liveHousePlace),
  classroom: flat(classroomPlace),
  pool: flat(poolPlace),
  lawn: flat(lawnPlace, (from,x,_y,z) => lawnClinicPlacementVisible(from,x,z)),
  astralCourt: { ...flat(courtPlace,portalPlacementSight), decks: [ground(108)] },
  chapel: flat(chapelPlace),
  clinic: flat(clinicNavigation.place, (from,x,_y,z) => clinicNavigation.visible(from,x,z)),
  weddingCourt: flat((x,z) => weddingClear(x,z,true), (from,x,y,z) => weddingVisible(from,x,z,y)),
  lanternSuite: retreat('lanternSuite'),
  moonSpa: retreat('moonSpa'),
  glassPlanet: flat(planetPlace, planetSight),
  velvetStudio: flat(velvetPlace, velvetSight),
  medievalChamber: flat(chamberPlace, chamberSight),
  qinhuai: {
    decks: [...commonDecks, ...PICK_DECKS], visible: songhousePlacementVisible,
    resolve: (x,z) => songhouseClear(x,z,true) ? songhouseHeight(x,z) : null,
  },
  arcadeHall: {
    decks: pickDecks, visible: arcadeSight,
    resolve: (x,z,y=0) => arcadePlace(x,y,z) ? y : null,
  },
};

/** null rejects the drop; zero (and, in the arcade lounge, a negative Y) is valid. */
export function resolvePlacementHeight(room: SceneryId, x: number, z: number, supportY?: number) {
  if (!Number.isFinite(x) || !Number.isFinite(z)) return null;
  for (const street of streetsIn(room)) {
    const height = street.resolve(room,x,z,supportY);
    if (height !== undefined) return height;
  }
  return rules[room].resolve(x,z,supportY);
}
export function canPlaceInScenery(room: SceneryId, x: number, z: number, supportY?: number) {
  return resolvePlacementHeight(room,x,z,supportY) !== null;
}
const deckCache = new Map<SceneryId, readonly PickDeck[]>();
export function roomPickDecks(room: SceneryId) {
  const base = rules[room].decks ?? commonDecks, streets = streetsIn(room);
  if (!streets.length) return base;
  let decks = deckCache.get(room);
  if (!decks) {
    decks = [...base, ...streets.flatMap(street => street.decks(room))];
    deckCache.set(room,decks);
  }
  return decks;
}
export function visiblePick(room: SceneryId, from: Point, x: number, y: number, z: number) {
  return (rules[room].visible?.(from,x,y,z) ?? true) && streetsIn(room).every(street => street.visible(room,from,x,y,z));
}
