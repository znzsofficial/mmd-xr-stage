import type { SceneryId } from '../catalog';
import { CampusArcadeStreet } from './campusArcade/Street';
import { JiangnanRiverStreet } from './riverStreet/Street';
import { campusArcadeExtension } from './campusArcade/layout';
import { riverStreetExtension } from './riverStreet/layout';
import {CityStreet} from '../city/CityStreet';
import {CityGreen} from '../city/CityGreen';
import {CITY_ORIGINS} from '../city/site';

export function StreetScenery({room,shadows}: {room: SceneryId;shadows:boolean}) {
  const district = room==='seasideTerminus'||room==='clinic'||room==='classroom'||room==='pool'||room==='arcadeHall';
  const nearbyGreen = room==='clinic'||room==='classroom' ? CITY_ORIGINS[room] : null;
  return <>
    {district && <CityStreet room={room} shadows={shadows}/>}
    {room==='seasideTerminus' && <CityGreen shadows={shadows}/>}
    {nearbyGreen && <group position={[-nearbyGreen.x,0,-nearbyGreen.z]}><CityGreen shadows={shadows}/></group>}
    {campusArcadeExtension.rooms.some(id => id === room) && <CampusArcadeStreet room={room}/>}
    {riverStreetExtension.rooms.some(id => id === room) && <JiangnanRiverStreet room={room}/>}
  </>;
}
