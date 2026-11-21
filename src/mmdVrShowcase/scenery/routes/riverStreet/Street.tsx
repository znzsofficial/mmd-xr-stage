import {useEffect,useMemo} from 'react';
import {DoubleSide} from 'three';
import type {SceneryId} from '../../catalog';
import {QinhuaiWater} from '../../qinhuai/Songhouse';
import {noPick} from '../../sceneryPaint';
import {useBakedSurface} from '../../useBakedSurface';
import {A,Skin} from '../../wedding/architectureMesh';
import {tiledRoof} from '../../wedding/architectureRoofs';
import stoneUrl from '../../wedding/architecture-jiangnan.webp';
import artUrl from './river-prints.webp';
import {bridge,laneEnd,qinOffset,quayEnd} from './plan';
import {buildStreetGround} from './masonry';
import {buildGate,buildShops,buildSongLanding} from './shopfronts';

// Distant silhouettes identify the next room, without instantiating its
// interiors, seats, actors, controller hooks, lights or second water surface.
function borrowedEnds(g:Skin,day:boolean){
  if(day){
    // The songhouse's two roof levels, raised wings, lantern bays and quay.
    const x=-qinOffset.x,z=-qinOffset.z;
    g.block(x-.65,-.47,z+7.65,16.3,.94,6.3,A.paving,'#c6bda9',1.8,.9);
    g.block(x,2.29,z-.62,11.36,4.58,9.60,A.lime,'#ccc6b6',2,1.6);
    g.block(x,.20,z+4.32,11.4,.4,.4,A.boards,'#90705b');
    tiledRoof(g,{x,z:z+1.28,hw:6.24,hd:3.89,eave:5.13,rise:1.38,hip:2.9,lift:.37,detail:false});
    tiledRoof(g,{x,z:z-5.24,hw:6.4,hd:3.51,eave:5.58,rise:1.63,hip:2.68,lift:.42,detail:false});
    for(const k of [-5.57,-3.23,3.23,5.57]){g.block(x+k,2.55,z+4.42,.30,5.10,.30,A.wood,'#af8b70');
      if(Math.abs(k)<4)g.lathe(x+k,z+4.68,[[2.72,.15],[2.89,.29],[3.21,.29],[3.4,.15]],A.plain,'#d6aa71',8);}
    g.block(x,4.06,z+4.42,11.4,1.90,.27,A.boards,'#ab8a71');
    // A distant apron above the far bank; the original near-lane house now
    // stands further right. Keep water right up to the stone facing.
    g.block(-32,-.55,25.48,31,.98,.33,A.brick,'#cfcebf',1.7,.9);
    for(const [bx,bz,w,d,h] of [[-37.7,27.7,5.3,4.2,2.75],[-31.6,28.1,5.54,4.8,3.50],[-25.1,27.4,5.2,3.76,2.49]]){
      g.block(bx,h/2,bz,w,h,d,A.lime,'#e5decc',2,1.5);
      for(const k of [-1,0,1])g.block(bx+k*w*.31,1.30,bz-d/2-.016,.89,1.06,.045,A.wood,'#a7a18b');
      tiledRoof(g,{x:bx,z:bz,hw:w/2+.29,hd:d/2+.27,eave:h+.035,rise:.84,lift:.10,detail:false});
    }
  }else{
    // Just the return alley and a glimpse of its open red-lacquer gate.
    g.block(0,-.315,9.55,11.6,.63,7.1,A.paving,'#d7cdbc',1.85,1.57);
    for(const k of [-1,1]){
      g.block(k*3.74,1.29,6,4.22,2.58,.21,A.lime,'#ede7d1',1.7,1.33);
      g.block(k*1.75,1.43,6,.30,2.86,.38,A.granite,'#d3cbb7');
      g.block(k*1.64,1.34,5.21,.095,2.68,1.55,A.lacquer,'#c6a498');
    }
    g.block(0,3.06,6,3.8,.64,.38,A.brick,'#d7d6c7');tiledRoof(g,{x:0,z:6,hw:2.42,hd:.83,eave:3.61,rise:.66,hip:.62,lift:.21,detail:false});
    for(const [bx,bz,w,d,h] of [[-7.0,16.05,6.90,4.36,2.70],[-.47,16.64,5.65,5.1,3.01]]){
      g.block(bx,-.42,bz,w+.2,.82,d+.2,A.brick,'#bfb9a6');g.block(bx,h/2,bz,w,h,d,A.lime,'#e5decc',2,1.5);
      tiledRoof(g,{x:bx,z:bz,hw:w/2+.3,hd:d/2+.35,eave:h+.12,rise:.25*d,detail:false});
    }
  }
}

export function makeRiverStreet(day:boolean){
  const ground=new Skin(),fronts=new Skin(),distance=new Skin(),print=new Skin(true),glow=new Skin(true);
  buildStreetGround(ground);buildShops(fronts,print,glow);buildGate(fronts,print,glow);buildSongLanding(fronts,print,glow);
  // Banks on both sides of the north-running tributary. Apron and paving are
  // separate finished floors on top. No sheet passes across the arch opening.
  const bank=(l:number,r:number,n:number,s:number)=>ground.block((l+r)/2,-.58,(n+s)/2,r-l,.95,s-n,A.brick,'#c5c7b4',1.4,1.15);
  bank(quayEnd,bridge.west,-4.5,8.5);bank(bridge.east,laneEnd,4.9,8.4);
  if(!day)bank(bridge.east,1.8,12.5,18.9);
  // A slip over the inlet with net-drying spars: from the crest there is
  // a near bank and a second, cross-river roofline at different distances.
  bank(bridge.west,bridge.east,-5.4,-4.50);
  for(const x of [-19.6,-17.1,-14.6]){
    ground.beam([x,-.86,-4.40],[x+.09,1.45,-4.35],.096,.098,A.wood,'#968b77');
    ground.beam([x-.87,1.06,-4.32],[x+.9,1.13,-4.32],.057,.062,A.wood,'#c0ae8b');
  }
  borrowedEnds(distance,day);
  return {ground:ground.finish(),fronts:fronts.finish(),distance:distance.finish(),print:print.finish(),glow:glow.finish()};
}

function Street({day}:{day:boolean}){
  const g=useMemo(()=>makeRiverStreet(day),[day]),stone=useBakedSurface(stoneUrl),print=useBakedSurface(artUrl);
  useEffect(()=>()=>Object.values(g).forEach(geometry=>geometry.dispose()),[g]);
  return <group name="jiangnan:river-street" position={day?[0,0,0]:[qinOffset.x,0,qinOffset.z]} pointerEvents="none">
    {(['ground','fronts','distance'] as const).map(name=><mesh key={name} name={`jiangnan:${name}`} geometry={g[name]} raycast={noPick}>
      <meshStandardMaterial key={stone?.uuid??'pending'} map={stone} vertexColors roughness={.92}/>
    </mesh>)}
    {print&&<mesh name="jiangnan:block-prints" geometry={g.print} raycast={noPick}><meshStandardMaterial map={print} vertexColors side={DoubleSide} roughness={.86}/></mesh>}
    <mesh name="jiangnan:paper-lights" geometry={g.glow} raycast={noPick}><meshBasicMaterial vertexColors/></mesh>
    {day&&<group position={[-qinOffset.x,0,-qinOffset.z]}><QinhuaiWater/></group>}
  </group>;
}

export function JiangnanRiverStreet({room}:{room:SceneryId}){
  return room==='weddingCourt'||room==='qinhuai'?<Street day={room==='weddingCourt'}/>:null;
}
