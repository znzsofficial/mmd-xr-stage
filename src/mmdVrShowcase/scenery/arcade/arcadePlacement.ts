import { blocks, type Block, type Point } from './arcadeLayout';
import type {PickDeck} from '../routes/types';

const top = (b: Block) => b.y + b.h / 2;
export const pickDecks = blocks.filter(b => b.deck).map(b => ({ x:b.x, y:top(b), z:b.z, w:b.w, d:b.d }));
const inRect = (b: {x:number;z:number;w:number;d:number}, x: number, z: number, margin=0) =>
  Math.abs(x-b.x) <= b.w/2+margin && Math.abs(z-b.z) <= b.d/2+margin;
const shoe = [[0,0],[.18,0],[-.18,0],[0,.18],[0,-.18]];

export function arcadePlace(x: number, y: number, z: number, decks:readonly PickDeck[]=pickDecks) {
  if (![x,y,z].every(Number.isFinite)) return false;
  return shoe.every(([dx,dz]) => decks.some(d => Math.abs(d.y-y)<.002 && inRect(d,x+dx,z+dz))) &&
    !blocks.some(b => top(b)>y+.015 && b.y-b.h/2<y+1.72 && inRect(b,x,z,.18));
}

const axes = [['x','w'],['y','h'],['z','d']] as const;
function intersects(start: Point, end: Point, b: Block) {
  let enter=0, exit=1;
  for (const [axis,size] of axes) {
    const delta=end[axis]-start[axis], lo=b[axis]-b[size]/2, hi=b[axis]+b[size]/2;
    if (Math.abs(delta)<1e-9) {
      if (start[axis]<lo || start[axis]>hi) return false;
      continue;
    }
    const p=(lo-start[axis])/delta, q=(hi-start[axis])/delta;
    enter=Math.max(enter,Math.min(p,q)); exit=Math.min(exit,Math.max(p,q));
    if (exit<enter) return false;
  }
  return true;
}
export function arcadeSight(from: Point, x: number, y: number, z: number) {
  const end={x,y:y+.012,z};
  return from.y>end.y && !blocks.some(b => intersects(from,end,b));
}
