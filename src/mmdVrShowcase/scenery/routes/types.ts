import type { SceneryId } from '../catalog';

export type RoutePoint = { x: number; y: number; z: number };
export type PickDeck = RoutePoint & { w: number; d: number };

/** A street extends its two existing rooms. All queries use the active room's
 * local metres; no inactive room, actor or Bullet world is mounted as scenery. */
export interface RouteExtension {
  rooms: readonly SceneryId[];
  /** null delegates to the room, -Infinity explicitly excludes water/void. */
  ground(room: SceneryId, x: number, z: number): number | null;
  decks(room: SceneryId): readonly PickDeck[];
  /** undefined delegates to the room. null rejects a point owned by the street. */
  resolve(room: SceneryId, x: number, z: number, supportY: number | undefined): number | null | undefined;
  /** Test the whole sightline even when the destination itself is in the base room. */
  visible(room: SceneryId, from: RoutePoint, x: number, y: number, z: number): boolean;
}
