import type { SceneryId } from '../catalog';
import { CampusArcadeStreet } from './campusArcade/Street';
import { JiangnanRiverStreet } from './riverStreet/Street';
import { campusArcadeExtension } from './campusArcade/layout';
import { riverStreetExtension } from './riverStreet/layout';

export function StreetScenery({room}: {room: SceneryId}) {
  return <>
    {campusArcadeExtension.rooms.some(id => id === room) && <CampusArcadeStreet room={room}/>}
    {riverStreetExtension.rooms.some(id => id === room) && <JiangnanRiverStreet room={room}/>}
  </>;
}
