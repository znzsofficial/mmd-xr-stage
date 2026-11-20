import {useEffect,useLayoutEffect,useMemo} from 'react';
import {BufferGeometry,Float32BufferAttribute,RepeatWrapping} from 'three';
import {CAMPUS_OFFSET,SCHOOL_PATH,SCHOOL_PATH_WIDTH} from './CampusLayout';
import {noPick} from './sceneryPaint';
import {useBakedSurface} from './useBakedSurface';
import clinker from './garden-clinker.webp';

// Bisect the turn at each brick course end. Adjoining spans share vertices:
// no overlapping squares, jutting slab corners or cracks on the inside turn.
function walk(){
  const path=SCHOOL_PATH,positions:number[]=[],uv:number[]=[],index:number[]=[];let len=0;
  const normal=(i:number,j:number)=>{const dx=path[j][0]-path[i][0],dz=path[j][1]-path[i][1],l=Math.hypot(dx,dz);return [dz/l,-dx/l];};
  for(let i=0;i<path.length;i++){
    const [x,z]=path[i],a=normal(Math.max(0,i-1),Math.max(1,i)),b=normal(Math.min(i,path.length-2),Math.min(i+1,path.length-1));
    const mx=a[0]+b[0],mz=a[1]+b[1],scale=SCHOOL_PATH_WIDTH*.5/(mx*a[0]+mz*a[1]);
    if(i)len+=Math.hypot(x-path[i-1][0],z-path[i-1][1]);
    for(const s of [1,-1]){positions.push(x+s*mx*scale,.012,z+s*mz*scale);uv.push((s+1)/2,len/1.28);}
    if(i){const v=i*2;index.push(v-2,v-1,v,v,v-1,v+1);}
  }
  const g=new BufferGeometry();g.setAttribute('position',new Float32BufferAttribute(positions,3));g.setAttribute('uv',new Float32BufferAttribute(uv,2));g.setIndex(index);g.computeVertexNormals();return g;
}
export function SchoolBrickWalk({lawn=false,shadows}:{lawn?:boolean;shadows:boolean}){
  const g=useMemo(walk,[]),map=useBakedSurface(clinker);
  useEffect(()=>()=>g.dispose(),[g]);useLayoutEffect(()=>{if(map){map.wrapT=RepeatWrapping;map.needsUpdate=true;}},[map]);
  return <mesh name="school:garden-clinker-walk" position={lawn?[CAMPUS_OFFSET.x,0,CAMPUS_OFFSET.z]:[0,0,0]} geometry={g} receiveShadow={shadows} raycast={noPick}>
    <meshStandardMaterial key={map?'clay':'base'} map={map} roughness={.94} color={map?'white':'#b78164'}/></mesh>;
}
