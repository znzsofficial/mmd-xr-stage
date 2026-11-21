import {useEffect,useMemo} from 'react';
import {BufferGeometry,Float32BufferAttribute,PlaneGeometry} from 'three';
import type {SceneryId} from '../../catalog';
import {Batch,type Part} from '../../SceneryBatch';
import {campusPassageParts,schoolExterior} from '../../CampusLayout';
import {ARBOR,LAWN_SIZE} from '../../meadowLandmarks';
import {distantLido,judgeStand,PACE_CLOCK,POOL,POOL_ORIGIN as P,poolBarrierParts} from '../../LidoLayout';
import {noPick} from '../../sceneryPaint';
import {useBakedSurface} from '../../useBakedSurface';
import lawnPrint from '../../meadow-walk.webp';
import typePrint from '../../arcade/hall-lettering.webp';
import printRects from '../../arcade/printRects.json';
import {gallerySign} from '../../arcade/westGallery';
import {hasRoad,shell,siteOrigin} from './layout';
import {ARCADE_ORIGIN as A} from './site';
import {bodies,finishes} from './pieces';
import {profiles} from './geometry';
import {PrintedSigns} from './PrintedSigns';
import {CampusLandscape} from './Landscape';

const exterior:Part[]=shell.map(s=>({p:[s.x,s.y,s.z],s:[s.w,s.h,s.d],color:s.ink}));
// From the approaching public street you see the exact red frame and original
// enamel plate, but no duplicate hall actors, stage, console prints or lights.
function BlockFront(){
  const map=useBakedSurface(typePrint),g=useMemo(()=>{
    const geo=new BufferGeometry(),p:number[]=[],uv:number[]=[],idx:number[]=[];
    for(const [key,x,y,z,w,h,n] of [['graffiti',gallerySign.x,gallerySign.y,gallerySign.z+.095,gallerySign.w-.09,gallerySign.h-.09,'z'],['lounge',-12.48,2.09,.1,3.4,.44,'x']] as const){
      const [u,v,r,t]=printRects.rects[key],k=p.length/3;for(const [i,j] of [[0,0],[1,0],[1,1],[0,1]]){
        p.push(x+(n==='z'?(i-.5)*w:0),y+(j-.5)*h,z-(n==='x'?(i-.5)*w:0));uv.push((u+2+i*(r-4))/printRects.size[0],1-(v+2+(1-j)*(t-4))/printRects.size[1]);
      }idx.push(k,k+1,k+2,k,k+2,k+3);
    }geo.setAttribute('position',new Float32BufferAttribute(p,3));geo.setAttribute('uv',new Float32BufferAttribute(uv,2));geo.setIndex(idx);geo.computeVertexNormals();return geo;
  },[]);useEffect(()=>()=>g.dispose(),[g]);
  return <group position={[A.x,0,A.z]}><Batch name="campus:borrowed-arcade-envelope" parts={exterior}/>
    {map&&<mesh geometry={g} raycast={noPick} userData={{playerCollision:false}}><meshStandardMaterial map={map}/></mesh>}
    <mesh position={[-13.66,3.8,-1.31]}><sphereGeometry args={[.95,12,8]}/><meshStandardMaterial color="#a0af9e"/></mesh>
  </group>;
}

function prospects(){
  const park=schoolExterior().concat(campusPassageParts('lawn'));
  const {x,z}=ARBOR;for(const s of [-1,1])for(const t of [-1,1])park.push({p:[x+s*1.53,1.34,z+t*1.16],s:[.18,2.68,.18],color:'#9e8462'});
  for(let i=-4;i<=4;i++){park.push({p:[x,2.85,z+i*.37],s:[3.74,.15,.1],color:'#b69770'});
    for(const s of [-1,1])park.push({p:[x+s*1.19,2.62,z+i*.37],s:[.51,.46,.38],color:i%2?'#99aa7b':'#ad9bb2'});}
  const lido=distantLido(),byClock=judgeStand().concat(poolBarrierParts()),c=PACE_CLOCK;
  const put=(x:number,y:number,z:number,w:number,h:number,d:number,color:string)=>byClock.push({p:[x,y,z],s:[w,h,d],color});
  put(c.x,.73,c.z,.087,1.46,.087,'#507879');put(c.x,1.83,c.z,.75,.75,.13,'#456769');put(c.x,1.83,c.z+.078,.65,.64,.033,'#e2dcc3');put(c.x,1.95,c.z+.100,.035,.24,.012,'#b76753');
  // Door panels and the dry finish posts align with the pool room; leave the
  // sightline to its chair clear rather than inventing a gateway in front of it.
  put(.8,-.33,-22,19,.65,4.5,'#dcceb6');
  for(const [x,b,f] of [[-10.5,-22.59,-6.90],[10.5,-22.59,-20.70],[10.5,-17.80,-6.90]])put(x,-.31,(b+f)/2,.71,.63,f-b,'#96a388');
  for(const r of POOL.blocks){put(r.x,.26,r.z,.36,.52,.43,'#d5ddd4');put(r.x,.55,r.z,r.w,.08,r.d,'#367895');}
  for(const lane of [-3.33,0,3.33])for(let i=0;i<27;i++)put(lane,.023,-6.03-i*.485,.084,.078,.36,i<3||i>23?'#bf604e':i%2?'#5f99ab':'#dad6be');
  for(const s of [-1,1])put(s*5.45,1.50,-16.8,.07,3,.07,'#87a4a1');
  for(let i=-8;i<=8;i++)put(i*.59,2.64+(i/8)**2*.24,-16.8,.31,.20,.049,i%2?'#dd805d':'#639a9c');
  for(let i=0;i<8;i++)put(-7+i*2.14,1.17,-22.405,1.35,2.06,.068,'#82a49a');
  for(const u of [-8,-4,0,4,8])put(u,1.43,-20.89,.12,2.86,.12,'#ded0b9');
  return {park,lido,byClock};
}
function CampusProspects(){
  const p=useMemo(prospects,[]),map=useBakedSurface(lawnPrint),g=useMemo(()=>{
    // The return looks down the student street onto the actual photo walk.
    // Crop just that slice of park and retain its metre-addressed baked UVs.
    const l=-9,r=29,b=-4.5,f=11,geo=new PlaneGeometry(r-l,f-b);geo.rotateX(-Math.PI/2);geo.translate((l+r)/2,-.014,(b+f)/2);
    const uv=geo.attributes.uv,v=geo.attributes.position;for(let i=0;i<v.count;i++)uv.setXY(i,.5+v.getX(i)/LAWN_SIZE,.5-v.getZ(i)/LAWN_SIZE);return geo;
  },[]);useEffect(()=>()=>g.dispose(),[g]);
  return <><mesh geometry={g} raycast={noPick}><meshStandardMaterial map={map} color={map?'white':'#97ac78'}/></mesh>
    <Batch name="campus:school-and-arbor" parts={p.park}/><Batch name="campus:finish-line-view" parts={p.lido}/>
    <group position={[P.x,0,P.z]}><Batch name="campus:timing-station" parts={p.byClock}/></group></>;
}
export function CampusArcadeStreet({room}:{room:SceneryId}){
  const {x,z}=siteOrigin(room),meshes=useMemo(()=>[bodies,finishes].map(layer=>profiles(layer.filter(p=>hasRoad(room,p.road)))),[room]);
  useEffect(()=>()=>{for(const g of meshes)g.dispose();},[meshes]);
  return <group name="campus:print-street-and-timing-walk" position={[-x,0,-z]} pointerEvents="none">
    {meshes.map((g,i)=><mesh key={i} name={i?'campus:street-finishes':'campus:street-solids'} geometry={g} receiveShadow raycast={noPick} userData={{playerCollision:i===0}}><meshStandardMaterial vertexColors roughness={.91}/></mesh>)}
    <CampusLandscape room={room}/><PrintedSigns room={room}/>{room==='arcadeHall'?<CampusProspects/>:<BlockFront/>}
  </group>;
}
