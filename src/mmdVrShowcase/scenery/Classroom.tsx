import { useEffect, useLayoutEffect, useMemo } from 'react';
import { BufferGeometry, DoubleSide, Float32BufferAttribute, RepeatWrapping } from 'three';
import { Batch } from './SceneryBatch';
import { canopyCluster, chairBack, chairFrame, classroomCurtains, deskFrame, woodSlab } from './ClassroomGeometry';
import { classroomProps } from './ClassroomProps';
import {SchoolBrickWalk} from './SchoolBrickWalk';
import {BorrowedMeadow} from './BorrowedMeadow';
import { useBakedSurface } from './useBakedSurface';
import floorDay from './class-floor-day.webp';
import floorShadow from './class-floor-shadow.webp';
import lesson from './class-lesson.webp';
import veneer from './class-birch-stock.webp';
import globe from './class-globe.webp';
import { DOOR_CENTERS, LECTERN, ROOM } from './ClassroomLayout';
import { classroomBounce, classroomSunlight } from './ClassroomLight';
import { backDay,backShadow,boardDay,boardShadow,parquetContact,steelDay,steelShadow } from './ClassroomFinish';

// One atlas draw for all the illustrated sheets, signs and the board. Paper
// quads sit in the physical trim and don't need extra alpha or polygon offsets.
function printedMatter() {
  const pos:number[]=[], uv:number[]=[], idx:number[]=[];
  function sheet(x:number,y:number,z:number,w:number,h:number,u0:number,v0:number,u1:number,v1:number,yaw=0,roll=0) {
    const offset=pos.length/3, c=Math.cos(roll),s=Math.sin(roll);
    for (const [a,b] of [[-1,-1],[1,-1],[1,1],[-1,1]]) {
      const dx=a*w*.5*c-b*h*.5*s,dy=b*h*.5*c+a*w*.5*s;
      pos.push(x+dx*Math.cos(yaw),y+dy,z-dx*Math.sin(yaw));
      uv.push(a<0?u0:u1,b<0?v0:v1);
    }
    idx.push(offset,offset+1,offset+2,offset,offset+2,offset+3);
  }
  const z=-ROOM.d/2;
  sheet(-.70,1.97,z+.175,5.8,1.394,.001,.502,.999,.998);
  sheet(3.21,1.97,z+.177,.67,.90,.001,.002,.249,.498,0,-.038);
  sheet(4.17,2.02,z+.180,.60,.82,.251,.002,.499,.498,0,.042);
  sheet(3.78,1.62,z+.187,.32,.43,.501,.002,.749,.498,0,-.051);
  for(const pz of DOOR_CENTERS)sheet(ROOM.w/2-.15,2.69,pz,.40,.293,.751,.002,.999,.498,-Math.PI/2);
  for(let i=0;i<4;i++){const u=(i%3)*.25;sheet(ROOM.w/2-.068,2.06,-1.12+i*.74,.395,.524,u+.002,.004,u+.248,.496,-Math.PI/2);}
  const geo=new BufferGeometry();geo.setAttribute('position',new Float32BufferAttribute(pos,3));geo.setAttribute('uv',new Float32BufferAttribute(uv,2));geo.setIndex(idx);geo.computeVertexNormals();return geo;
}

export function Classroom({ shadows }: { shadows: boolean }) {
  const p = useMemo(classroomProps, []);
  const geometry = useMemo(() => ({ slab: woodSlab(), desk: deskFrame(), chair: chairFrame(),
    back: chairBack(), cloth: classroomCurtains(), foliage: canopyCluster(), paper: printedMatter() }), []);
  const atlas=useBakedSurface(lesson),grain=useBakedSurface(veneer,'data'),earth=useBakedSurface(globe);
  useLayoutEffect(()=>{if(grain){grain.wrapS=grain.wrapT=RepeatWrapping;grain.needsUpdate=true;}},[grain]);
  const floor=useBakedSurface(shadows?floorShadow:floorDay);
  const daylight = shadows ? classroomBounce : classroomSunlight;
  useEffect(() => () => { for (const g of Object.values(geometry)) g.dispose(); }, [geometry]);
  return <group name="scenery:classroom">
    <BorrowedMeadow room="classroom"/><SchoolBrickWalk shadows={shadows}/>
    <mesh name="basketweave-parquet" rotation={[-Math.PI/2,0,0]} receiveShadow={shadows} raycast={()=>null}>
      <planeGeometry args={[ROOM.w, ROOM.d]} /><meshStandardMaterial key={floor?'wood':'plain'} map={floor} color={floor?'white':'#bd9a77'} roughness={.88} onBeforeCompile={parquetContact} />
    </mesh>
    <Batch name="room-shell-and-sashes" parts={p.shell} casts={shadows} shade={daylight} />
    <Batch name="joinery-and-campus" parts={p.trim} shade={daylight} />
    <Batch name="chalk-window-hardware" parts={p.round} round shade={daylight} />
    <Batch name="quadrangle-foliage" parts={p.leaves} geometry={geometry.foliage} shade={classroomBounce} />
    <Batch name="ceiling-practicals" parts={p.luminous} lit />
    <Batch name="radiused-wood-and-stationery" parts={p.slabs} geometry={geometry.slab} casts={shadows} shade={daylight} />
    <Batch name="birch-veneers" parts={p.veneers} geometry={geometry.slab} casts={shadows} shade={shadows?boardShadow:boardDay} map={grain??undefined} />
    <Batch name="tubular-desk-frames" parts={p.deskFrames} geometry={geometry.desk} shade={shadows?steelShadow:steelDay} />
    <Batch name="tubular-chair-frames" parts={p.chairFrames} geometry={geometry.chair} shade={shadows?steelShadow:steelDay} />
    <Batch name="molded-chair-backs" parts={p.backs} geometry={geometry.back} casts={shadows} shade={shadows?backShadow:backDay} map={grain??undefined} />
    <mesh name="gathered-linen" castShadow={shadows} receiveShadow={shadows} raycast={()=>null}>
      <primitive object={geometry.cloth} attach="geometry" /><meshStandardMaterial vertexColors side={DoubleSide} roughness={1} onBeforeCompile={classroomBounce} />
    </mesh>
    <mesh name="lunar-lesson-and-prints" raycast={()=>null}>
      <primitive object={geometry.paper} attach="geometry" /><meshStandardMaterial key={atlas?'printed':'plain'} map={atlas} color={atlas?'white':'#819985'} roughness={1} onBeforeCompile={daylight} />
    </mesh>
    <mesh name="lectern-globe" position={[LECTERN.x-.45,1.172,LECTERN.z]} rotation={[0,-1.34,-.32]} raycast={()=>null}>
      <sphereGeometry args={[.168,24,16]} /><meshStandardMaterial key={earth?'printed':'plain'} map={earth} roughness={.73} onBeforeCompile={daylight} />
    </mesh>
  </group>;
}
