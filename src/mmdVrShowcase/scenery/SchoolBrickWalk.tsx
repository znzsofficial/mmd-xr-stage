import {useEffect,useLayoutEffect,useMemo} from 'react';
import {BufferGeometry,Float32BufferAttribute,RepeatWrapping} from 'three';
import {SCHOOL_PATH,schoolBrickEdges} from './CampusLayout';
import {noPick} from './sceneryPaint';
import {useBakedSurface} from './useBakedSurface';
import clinker from './garden-clinker.webp';

// Bisect the turn at each brick course end. Adjoining spans share vertices:
// no overlapping squares, jutting slab corners or cracks on the inside turn.
export function schoolBrickWalkGeometry(){
  const path=SCHOOL_PATH,positions:number[]=[],uv:number[]=[],index:number[]=[];let len=0;
  for(let i=0;i<path.length;i++){
    const [x,z]=path[i];
    if(i)len+=Math.hypot(x-path[i-1][0],z-path[i-1][1]);
    for(const [side,[ex,ez]] of schoolBrickEdges[i].entries()){positions.push(ex,.012,ez);uv.push(1-side,len/1.28);}
    if(i){const v=i*2;index.push(v-2,v-1,v,v,v-1,v+1);}
  }
  const g=new BufferGeometry();g.setAttribute('position',new Float32BufferAttribute(positions,3));g.setAttribute('uv',new Float32BufferAttribute(uv,2));g.setIndex(index);g.computeVertexNormals();return g;
}
export function SchoolBrickWalk({shadows}:{shadows:boolean}){
  const g=useMemo(schoolBrickWalkGeometry,[]),map=useBakedSurface(clinker);
  useEffect(()=>()=>g.dispose(),[g]);useLayoutEffect(()=>{if(map){map.wrapT=RepeatWrapping;map.needsUpdate=true;}},[map]);
  return <mesh name="school:garden-clinker-walk" geometry={g} receiveShadow={shadows} raycast={noPick}>
    <meshStandardMaterial key={map?'clay':'base'} map={map} roughness={.94} color={map?'white':'#b78164'}/></mesh>;
}
