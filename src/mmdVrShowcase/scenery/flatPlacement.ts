import { CLASS_OBSTACLES, ROOM, type Footprint } from './ClassroomLayout';
import { classPassageFloor, passagePost } from './CampusLayout';
import { chapelFloor, CHAPEL_OBSTACLES } from './ChapelLayout';
import { COURT_PIERS, onObservatoryFloor, ROUTE_FEET } from './ObservatoryLayout';
import {courtPortals} from './portalLayout';
import { BACKLINE, LIVE_DECK_SIZE, SIMPLE_FLOOR_RADIUS, WEDGES } from './stageLayouts';
import { GUARD_CHAIR, PACE_CLOCK, POOL, POOL_SUPPORT, LIDO_PIERS, PAVILION_POSTS } from './LidoLayout';

// Shoe clearance for an asset pivot, independent of player collision or model scale.
const CLEAR = .18;
const shoeOffsets = [[0, 0], [CLEAR, 0], [-CLEAR, 0], [0, CLEAR], [0, -CLEAR]];
function hits(r: Footprint, x: number, z: number, clearance = CLEAR) {
  const c = Math.cos(r.yaw ?? 0), s = Math.sin(r.yaw ?? 0);
  const dx = x - r.x, dz = z - r.z;
  const u = Math.max(0, Math.abs(c * dx - s * dz) - r.w / 2);
  const v = Math.max(0, Math.abs(s * dx + c * dz) - r.d / 2);
  return u * u + v * v <= clearance * clearance;
}

export const plinthPlace = (x: number, z: number) => Math.hypot(x,z) <= SIMPLE_FLOOR_RADIUS - CLEAR;
export function chapelPlace(x: number, z: number) {
  return shoeOffsets.every(([dx,dz]) => chapelFloor(x+dx,z+dz)) && !CHAPEL_OBSTACLES.some(r => hits(r,x,z));
}
export function courtPlace(x: number, z: number) {
  return shoeOffsets.every(([dx,dz]) => onObservatoryFloor(x+dx,z+dz)) &&
    !COURT_PIERS.some(r => hits(r,x,z)) && !ROUTE_FEET.some(r => hits(r,x,z)) && !courtPortals.some(r=>hits(r,x,z));
}

const cyc = { x: 0, z: -5.32, w: 6.5, d: .088 };
const wings = [-1, 1].flatMap(side => [
  ...Array.from({ length: 7 }, (_, i) => ({ x: side * (3.4 + i * .30), z: -5.2 + i * .07, w: .37, d: .21, yaw: side * .36 })),
  { x: side * 4.55, z: -3.88, w: .84, d: .72 }, { x: side * 5.1, z: -4.55, w: .13, d: .13 },
  { x: side * 3.19, z: -5.22, w: .035, d: .04 },
]).concat(WEDGES, Object.values(BACKLINE));
export function liveHousePlace(x: number, z: number) {
  return Math.max(Math.abs(x), Math.abs(z)) <= LIVE_DECK_SIZE / 2 - CLEAR &&
    z > -5.515 + CLEAR && !hits(cyc,x,z) && !wings.some(r => hits(r,x,z));
}

export function classroomPlace(x: number, z: number) {
  return shoeOffsets.every(([dx,dz]) => (Math.abs(x+dx)<ROOM.w/2 && Math.abs(z+dz)<ROOM.d/2) || classPassageFloor(x+dx,z+dz)) &&
    !passagePost(x,z) && !CLASS_OBSTACLES.some(r => hits(r,x,z));
}
const poolObstacles = [POOL.water, POOL.ladder, ...POOL.blocks, ...POOL.benches, ...POOL.loungers, ...POOL.parasols, POOL.rescue, ...POOL.flagPosts, GUARD_CHAIR, PACE_CLOCK, ...LIDO_PIERS, ...PAVILION_POSTS];
export function poolPlace(x: number, z: number) {
  // Overlapping deck pieces support the whole shoe even at a join.
  return !poolObstacles.some(r => hits(r,x,z)) &&
    shoeOffsets.every(([dx,dz]) => POOL_SUPPORT.some(r => hits(r,x+dx,z+dz,0)));
}
