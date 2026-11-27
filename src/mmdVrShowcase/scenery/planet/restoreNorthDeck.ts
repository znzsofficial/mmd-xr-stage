import type {StageSnapshot} from '../../stage/stageSnapshot';
import {PAD_RADIUS} from './planetLayout';

type Point=[number,number,number];
// Old glassPlanet saves stored only world transforms, not deck IDs. Keep the
// retired 07 dry stage's exact footprint here, independent of any scenery mesh.
const oldX=28.5,oldY=-7.9,oldZ=20;
const onOldDeck=([x,y,z]:Point)=>Math.abs(y-oldY)<.001&&Math.hypot(x-oldX,z-oldZ)<=1.08001;
const berths:Point[]=Array.from({length:6},(_,i)=>{
  const a=i*Math.PI/3,r=PAD_RADIUS*.75;return [r*Math.cos(a),0,r*Math.sin(a)];
});

/** Called only for the planet's layout, before the usual actor/object restore.
 * Reserve all surviving placements (including hidden ones) before moving any. */
export function restoreNorthDeck(saved:StageSnapshot):StageSnapshot{
  const modelPositions=saved.models.map(({transform:t}):Point=>[t.positionX,t.positionY,t.positionZ]);
  const positions=[...modelPositions,...saved.objects.map(o=>o.position)];
  if(!positions.some(onOldDeck))return saved;
  const occupied=positions.filter(p=>!onOldDeck(p));
  function arrive([x,,z]:Point):Point{
    const preferred:Point=[x-oldX,0,z-oldZ];
    const clearance=([a,,b]:Point)=>Math.min(...occupied.map(([u,,v])=>Math.hypot(a-u,b-v)));
    // Translate the original mark when clear. Otherwise spread across the
    // rim: each previous anchor can block at most one of the six berths.
    const spot=clearance(preferred)>=.95?preferred:berths.reduce((best,p)=>clearance(p)>clearance(best)?p:best);
    occupied.push(spot);return [...spot];
  }
  return {...saved,models:saved.models.map((m,i)=>{
    if(!onOldDeck(modelPositions[i]))return m;
    const [positionX,positionY,positionZ]=arrive(modelPositions[i]);return {...m,transform:{...m.transform,positionX,positionY,positionZ}};
  }),objects:saved.objects.map(o=>onOldDeck(o.position)?{...o,position:arrive(o.position)}:o)};
}
