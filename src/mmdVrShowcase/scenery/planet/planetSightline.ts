import {stationBlocks,terrainAltitude} from './opalTerrain';
import {planetPlace} from './planetLayout';
import {moons} from './windAtlas';
import {moonRadius} from './moonSurface';

/** Check the segment to the north deck, not only the side of its tangent
 * plane. The outlying observatory and ridges can rise across an oblique ray. */
export function planetSight(from:{x:number;y:number;z:number},x:number,y:number,z:number){
  if(!planetPlace(x,z)||Math.abs(y)>.025||from.y<=.005)return false;
  const dx=x-from.x,dy=.012-from.y,dz=z-from.z,len=Math.hypot(dx,dy,dz);
  if(!Number.isFinite(len))return false;
  // Clip to each neighbouring globe before sampling its relief. A ray from
  // the far side of the ice moon cannot place an actor through its crust.
  if(len>0)for(const m of moons){
    const a=from.x-m.centre.x,b=from.y-m.centre.y,c=from.z-m.centre.z,mid=-(a*dx+b*dy+c*dz)/len;
    const span=(m.radius+.9)**2-(a*a+b*b+c*c-mid*mid);if(span<=0)continue;
    const reach=Math.sqrt(span),start=Math.max(0,mid-reach),end=Math.min(len,mid+reach);
    for(let u=start;u<=end;u+=.10){const t=u/len,xx=a+dx*t,yy=b+dy*t,zz=c+dz*t,r=Math.hypot(xx,yy,zz);
      if(r<.001||r<moonRadius(m,xx/r,yy/r,zz/r)-.006)return false;}
  }
  // Clip far-away flight rays to the inhabited part before checking the path.
  const near=Math.max(0,1-34/Math.max(len,.001)),count=Math.max(1,Math.ceil(Math.min(len,34)/.11));
  const p={x:0,y:0,z:0};
  for(let i=0;i<=count;i++){const t=near+(1-near)*i/count;p.x=from.x+t*dx;p.y=from.y+t*dy;p.z=from.z+t*dz;
    if(terrainAltitude(p)<-.006||stationBlocks(p,0,.008))return false;}
  return true;
}
