import { CLASS_OBSTACLES, ROOM, seededRandom, type Footprint } from './ClassroomLayout';
import type { SceneryId } from './catalog';
import { chapelFloor, CHAPEL_OBSTACLES } from './ChapelLayout';
import { OLD_COURT_RADIUS, onObservatoryFloor, ROUTE_FEET } from './ObservatoryLayout';
import { classPassageFloor, lawnSchoolFoot, passagePost } from './CampusLayout';
import {canPlaceInClinic} from './clinic/clinicLayout';
import {canPlaceByLawnClinic,reserveLawnClinic} from './clinic/clinicApproach';
import {songhouseClear,songhouseHeight} from './qinhuai/songhouseLayout';
import {weddingClear} from './wedding/weddingLayout';
import {GUARD_CHAIR,PACE_CLOCK,TIME_DECK,LIDO_ENTRY,LIDO_PIERS,PAVILION_POSTS,POOL_ORIGIN_Z,inLidoApproach} from './LidoLayout';

// A placement is a point on a supported y=0 surface with a little shoe room;
// it doesn't pretend to know a particular imported object's swept bounds.
const CLEAR = .18;
function hits(r: Footprint, x: number, z: number, clearance = CLEAR) {
  const c = Math.cos(r.yaw ?? 0), s = Math.sin(r.yaw ?? 0);
  const dx = x - r.x, dz = z - r.z;
  const u = Math.max(0, Math.abs(c * dx - s * dz) - r.w / 2);
  const v = Math.max(0, Math.abs(s * dx + c * dz) - r.d / 2);
  return u * u + v * v <= clearance * clearance;
}

export const SIMPLE_FLOOR_RADIUS = 8;
export const COURT_RADIUS = OLD_COURT_RADIUS;
// Paired piers bracket a rear stargate; broken columns light the approaches.
export const COURT_PIERS = [
  {x:-2.78,z:-4.3,w:1.08,d:1.08}, {x:2.78,z:-4.3,w:1.08,d:1.08},
  {x:-5.05,z:-1.2,w:.95,d:.95}, {x:5.05,z:-1.2,w:.95,d:.95},
  {x:-4.2,z:3.4,w:.95,d:.95}, {x:4.2,z:3.4,w:.95,d:.95},
];
export const LIVE_DECK_SIZE = 11.6;
export const WEDGES = [-1,1].map(side => ({ x: side*2.85, z: 2.4, w: .78, d: .56, yaw: -side*.28 }));
export const BACKLINE = { drums:{x:-2.72,z:-4.52,w:2.05,d:1.32}, keys:{x:3.18,z:-4.34,w:1.63,d:.76} };
// From the proscenium towards the audience: cyc, folded side drapes, truss
// uprights, then the speaker stacks. The overhead truss is not an obstacle.
const wings = [-1, 1].flatMap(side => [
  ...Array.from({ length: 7 }, (_, i) => ({ x: side * (3.4 + i * .30), z: -5.2 + i * .07, w: .37, d: .21, yaw: side * .36 })),
  { x: side * 4.55, z: -3.88, w: .84, d: .72 }, { x: side * 5.1, z: -4.55, w: .13, d: .13 },
  { x: side * 3.19, z: -5.22, w: .035, d: .04 },
]).concat(WEDGES, Object.values(BACKLINE));

export const POOL = {
  deck: { x: 0, z: 1, w: 23, d: 13.5 }, water: { x: 0, z: -12.4, w: 10.1, d: 13.35 },
  walks: [-6.2, 6.2].map(x => ({ x, z: -12.4, w: 2.35, d: 13.4 })),
  farWalk: { x: 0, z: -19.48, w: 14.7, d: 1.1 },
  ladder: { x: -4.34, z: -5.75, w: .57, d: .43 },
  blocks: [-3.34, 0, 3.34].map(lane => ({ x: lane - 1.65, z: -19.42, w: .65, d: .7 })),
  benches: [-8, 8].map(x => ({x,z:-12.6,w:1.8,d:.51})),
  loungers: [-1,1].flatMap(side => [0,1].map(i=>({x:side*(7.4+i*1.35),z:-2.95,w:.75,d:1.98,yaw:side*.16}))),
  parasols: [-1,1].map(side=>({x:side*8.35,z:-1.35,w:.60,d:.60})),
  rescue: {x:-5.68,z:-8.95,w:.91,d:.41},
  flagPosts: [-9.5,-16.8].flatMap(z=>[-5.45,5.45].map(x=>({x,z,w:.14,d:.14}))),
};
const poolDeck = [POOL.deck, ...POOL.walks, POOL.farWalk,TIME_DECK,LIDO_ENTRY];
const poolObstacles = [POOL.water, POOL.ladder, ...POOL.blocks, ...POOL.benches, ...POOL.loungers, ...POOL.parasols,POOL.rescue,...POOL.flagPosts,GUARD_CHAIR,PACE_CLOCK,...LIDO_PIERS,...PAVILION_POSTS];
const shoeOffsets = [[0, 0], [CLEAR, 0], [-CLEAR, 0], [0, CLEAR], [0, -CLEAR]];
const cyc = { x: 0, z: -5.32, w: 6.5, d: .088 };
export const LAWN_SIZE = 58;
export const MEADOW_SUN:[number,number,number]=[-4.8,3.6,-5.5];
export const meadowPathX=(z:number)=>-3.1+1.7*Math.sin(z*.22+.9)+.038*z;
export const ARBOR = {x:meadowPathX(-6.4),z:-6.4};
export const ARBOR_POSTS = [-1,1].flatMap(side=>[-1,1].map(end=>({x:ARBOR.x+side*1.53,z:ARBOR.z+end*1.16,w:.37,d:.37})));
export const MEADOW_SEAT = {x:4.1,z:-4.4,w:1.85,d:.68,yaw:-.55};
export const MEADOW_POSTS = Array.from({length:13},(_,i)=>({x:-8.4-i*.47,z:5-i*1.85,w:.14,d:.14}));
const firstPost=MEADOW_POSTS[0], lastPost=MEADOW_POSTS[MEADOW_POSTS.length-1];
const meadowRail={x:(firstPost.x+lastPost.x)/2,z:(firstPost.z+lastPost.z)/2,w:.16,
  d:Math.hypot(firstPost.x-lastPost.x,firstPost.z-lastPost.z)+.14,yaw:Math.atan2(firstPost.x-lastPost.x,firstPost.z-lastPost.z)};
const landscapeRandom = seededRandom(11281);
export const LAWN_KNOLLS = Array.from({ length: 58 }, () => {
  const x = landscapeRandom() * 54 - 27, z = landscapeRandom() * 54 - 27;
  if (Math.hypot(x, z) < 9) return [];
  return [{ x, z, w: 3 + landscapeRandom() * 6, h: .6 + landscapeRandom() * 1.4,
    d: 2 + landscapeRandom() * 4, yaw: landscapeRandom() * 3 }];
}).flat().filter(k=>!inLidoApproach(k.x,k.z,Math.max(k.w,k.d)*.6)&&!reserveLawnClinic(k.x,k.z,Math.max(k.w,k.d)*.6));
export const LAWN_TREES = Array.from({ length: 19 }, (_, i) => {
  const a = i * 2.399, r = 11 + landscapeRandom() * 12;
  return { x: Math.cos(a) * r, z: Math.sin(a) * r, h: 3.3 + 2.2 * landscapeRandom() };
}).concat([{x:5.75,z:-5.2,h:5.6},{x:-6.2,z:-9.4,h:4.4}]).filter(t=>!inLidoApproach(t.x,t.z,1.5)&&!reserveLawnClinic(t.x,t.z,t.h*.42));

export const placementHeight=(id:SceneryId,x:number,z:number)=>id==='qinhuai'?songhouseHeight(x,z):0;
export function canPlaceInScenery(id: SceneryId, x: number, z: number): boolean {
  if (!Number.isFinite(x) || !Number.isFinite(z)) return false;
  switch (id) {
    case 'weddingCourt': return weddingClear(x,z,true);
    case 'qinhuai': return songhouseClear(x,z,true);
    case 'clinic': return canPlaceInClinic(x,z);
    case 'chapel': return shoeOffsets.every(([dx,dz])=>chapelFloor(x+dx,z+dz)) && !CHAPEL_OBSTACLES.some(r=>hits(r,x,z));
    case 'floor': return Math.hypot(x, z) <= SIMPLE_FLOOR_RADIUS - CLEAR;
    case 'astralCourt': return shoeOffsets.every(([dx,dz])=>onObservatoryFloor(x+dx,z+dz)) && !COURT_PIERS.some(p=>hits(p,x,z)) && !ROUTE_FEET.some(p=>hits(p,x,z));
    case 'liveHouse': return Math.max(Math.abs(x), Math.abs(z)) <= LIVE_DECK_SIZE / 2 - CLEAR &&
      z > -5.515 + CLEAR && !hits(cyc, x, z) && !wings.some(r => hits(r, x, z));
    case 'classroom': return shoeOffsets.every(([dx,dz])=>Math.abs(x+dx)<ROOM.w/2&&Math.abs(z+dz)<ROOM.d/2||classPassageFloor(x+dx,z+dz)) && !passagePost(id,x,z)&&!CLASS_OBSTACLES.some(r=>hits(r,x,z));
    case 'pool': return !poolObstacles.some(r => hits(r, x, z)) &&
      // Connected deck pieces overlap: test the union, not four separately inset rectangles.
      shoeOffsets.every(([dx, dz]) =>
        poolDeck.some(r => hits(r, x + dx, z + dz, 0)));
    case 'lawn': return canPlaceByLawnClinic(x,z) && !(z < -14.1 && Math.abs(x)<7.1) && !LIDO_PIERS.some(p=>hits(p,x,z-POOL_ORIGIN_Z)) && !lawnSchoolFoot(x,z)&&!passagePost(id,x,z) && Math.max(Math.abs(x), Math.abs(z)) <= LAWN_SIZE / 2 - CLEAR &&
      !hits(MEADOW_SEAT,x,z) && !hits(meadowRail,x,z) && !ARBOR_POSTS.some(p=>hits(p,x,z)) &&
      !LAWN_TREES.some(t => Math.hypot(x - t.x, z - t.z) < CLEAR + t.h * .07) &&
      !LAWN_KNOLLS.some(k => {
        const c = Math.cos(k.yaw), s = Math.sin(k.yaw), dx = x - k.x, dz = z - k.z;
        // Horizontal section of the partially buried ellipsoid at ground level.
        return Math.hypot((c * dx - s * dz) / (k.w / 2 + CLEAR), (s * dx + c * dz) / (k.d / 2 + CLEAR)) < Math.sqrt(1 - (.48 / k.h) ** 2);
      });
  }
}
