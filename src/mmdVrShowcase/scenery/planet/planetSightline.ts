import {Vector3} from 'three';
import {stationBlocks,terrainAltitude} from './opalTerrain';
import {PLANET_RADIUS,planetPlace} from './planetLayout';
import {allMoons,moonObstructed} from './windAtlas';
import {moonRadius} from './moonSurface';
import {clearingDeck,onClearing} from './lanternClearing';
import {lanternCanopyBlocks} from './lanternBiosphere';
import {onTideDeck,tideDeck} from './tideLayout';

const home=new Vector3(0,-PLANET_RADIUS,0);
/** Any actor deck can be the destination. Clip against each world's occupied
 * volume, including the near side of the world the ray originated on. */
export function planetSight(from:{x:number;y:number;z:number},x:number,y:number,z:number){
  if(!(planetPlace(x,z)&&y===0||onClearing(x,z)&&y===clearingDeck.y||onTideDeck(x,z)&&y===tideDeck.y)||from.y<=y+.005)return false;
  const dx=x-from.x,dy=y+.012-from.y,dz=z-from.z,len=Math.hypot(dx,dy,dz);
  if(!Number.isFinite(len))return false;
  const p=new Vector3();
  function crosses(centre:Vector3,radius:number,blocks:(p:Vector3)=>boolean){
    const a=from.x-centre.x,b=from.y-centre.y,c=from.z-centre.z;
    const mid=len?-(a*dx+b*dy+c*dz)/len:0,span=radius*radius-(a*a+b*b+c*c-mid*mid);
    if(span<=0)return false;
    const reach=Math.sqrt(span),start=Math.max(0,mid-reach),end=Math.min(len,mid+reach);
    if(start>end)return false;
    const count=Math.max(1,Math.ceil((end-start)/.075));
    for(let i=0;i<=count;i++){const t=len?(start+(end-start)*i/count)/len:0;
      p.set(from.x+t*dx,from.y+t*dy,from.z+t*dz);if(blocks(p))return true;}
    return false;
  }
  if(crosses(home,PLANET_RADIUS+5,q=>terrainAltitude(q)<-.006||stationBlocks(q,0,.008)))return false;
  for(const m of allMoons){if(crosses(m.centre,m.radius+(m.id==='tide'?8:m.id==='lantern'?6:3),q=>{
    const a=q.x-m.centre.x,b=q.y-m.centre.y,c=q.z-m.centre.z,r=Math.hypot(a,b,c);
    return r<.001||r<moonRadius(m,a/r,b/r,c/r)-.006||moonObstructed(m,q,0,.008)||(m.id==='lantern'&&lanternCanopyBlocks(q));
  }))return false;}
  return true;
}
