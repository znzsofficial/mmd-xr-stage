import {useEffect,useMemo} from 'react';
import {BufferGeometry,Float32BufferAttribute} from 'three';
import {span} from './detailParts';
import type {Part} from './SceneryBatch';
import {noPick} from './sceneryPaint';
import {useBakedSurface} from './useBakedSurface';
import benchUrl from './garden-joinery.webp';

type Seat={x:number;z:number;yaw:number};
type Point=Part['p'];

// The same bench supports the reel in the old campus and the city green.
// Append into the host's batches so the original meadow keeps its draw count.
export function addGardenBench(seat:Seat,boards:Part[],rails:Part[]){
  const c=Math.cos(seat.yaw),s=Math.sin(seat.yaw);
  const world=(x:number,y:number,z:number):Point=>[seat.x+x*c+z*s,y,seat.z+z*c-x*s];
  const put=(x:number,y:number,z:number,size:Point,color:string)=>boards.push({p:world(x,y,z),s:size,color,ry:seat.yaw});
  for(const dx of [-.67,.67])for(const dz of [-.19,.19]){put(dx,.21,dz,[.075,.42,.075],'#555d50');put(dx,.035,dz,[.13,.07,.118],'#424e45');}
  for(let i=0;i<4;i++){put(0,.43,-.23+i*.133,[1.82,.052,.113],['#bd9a72','#b28f67','#c4a078','#b59269'][i]);
    for(const xx of [-.67,.67])put(xx,.457,-.23+i*.133,[.030,.006,.03],'#777869');}
  for(const dx of [-.67,.67])put(dx,.65,.23,[.065,.53,.055],'#586557');
  for(const y of [.66,.82])put(0,y,.25,[1.85,.135,.048],'#c5a277');
  put(0,.819,.218,[.47,.09,.016],'#a38359');put(0,.819,.207,[.43,.064,.007],'#d5b987');
  for(const x of [-.80,.80]){
    const rest:Point[]=[[x,.43,-.18],[x,.57,-.20],[x,.643,-.145],[x,.665,-.07],[x,.665,.13],[x,.635,.19],[x,.46,.20]];
    for(let j=1;j<rest.length;j++)rails.push(span(world(...rest[j-1]),world(...rest[j]),.044,'#617165'));
    put(x,.673,.025,[.069,.036,.26],'#b69166');
  }
  put(0,.23,.03,[1.4,.055,.05],'#657367');
}

export function GardenBenchGrain({seat}:{seat:Seat}){
  const map=useBakedSurface(benchUrl),geo=useMemo(()=>{
    const p:number[]=[],uv:number[]=[];
    const face=(a:Point,b:Point,c:Point,d:Point,top:number,bottom:number)=>{
      const verts=[a,b,c,d],corners=[[.006,1-bottom/512],[.994,1-bottom/512],[.994,1-top/512],[.006,1-top/512]];
      for(const i of [0,1,2,0,2,3]){p.push(...verts[i]);uv.push(...corners[i]);}
    };
    for(let i=0;i<4;i++){const z=-.23+i*.133;face([-.91,.457,z+.056],[.91,.457,z+.056],[.91,.457,z-.056],[-.91,.457,z-.056],i*70+2,(i+1)*70-2);}
    for(const [i,y] of [.66,.82].entries())face([.923,y-.066,.225],[-.923,y-.066,.225],[-.923,y+.066,.225],[.923,y+.066,.225],282+70*i,348+70*i);
    face([.214,.789,.202],[-.214,.789,.202],[-.214,.849,.202],[.214,.849,.202],422,510);
    const g=new BufferGeometry();g.setAttribute('position',new Float32BufferAttribute(p,3));g.setAttribute('uv',new Float32BufferAttribute(uv,2));g.computeVertexNormals();return g;
  },[]);
  useEffect(()=>()=>geo.dispose(),[geo]);
  return map&&<mesh name="garden-bench-grain" position={[seat.x,0,seat.z]} rotation-y={seat.yaw} geometry={geo} raycast={noPick}><meshStandardMaterial map={map} roughness={.81} polygonOffset polygonOffsetFactor={-1}/></mesh>;
}
