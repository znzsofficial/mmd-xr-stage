import type { SceneryId } from '../catalog';
import type { RouteExtension } from './types';
import { campusArcadeExtension } from './campusArcade/layout';
import { riverStreetExtension } from './riverStreet/layout';
import {cityExtension} from '../city/layout';

// Index once. Foot-support is sampled multiple times per XR frame, also in
// rooms without an extension. Render components do not belong in this index.
const byRoom = new Map<SceneryId, RouteExtension[]>();
for (const street of [campusArcadeExtension, riverStreetExtension, cityExtension]) {
  for (const room of street.rooms) {
    const list = byRoom.get(room);
    if (list) list.push(street);
    else byRoom.set(room, [street]);
  }
}
const empty: readonly RouteExtension[] = [];
export const streetsIn = (room: SceneryId): readonly RouteExtension[] => byRoom.get(room) ?? empty;
