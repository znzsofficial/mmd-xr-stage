import {useEffect,useMemo} from 'react';
import {DataTexture,DoubleSide,SRGBColorSpace} from 'three';
import {noPick} from '../sceneryPaint';
import {useBakedSurface} from '../useBakedSurface';
import {makeWeddingArchitecture} from './architectureHouse';
import {ArchitectureHorizon} from './architectureHorizon';
import {WeddingFurnishings} from './furnishings';
import atlasUrl from './architecture-jiangnan.webp';
import sprayUrl from './architecture-osmanthus.webp';

// A tiny palette strip keeps brick grey, wood brown and silk red even on
// the first eye frame of a cold decode. No secondary network fetch.
function materialProof(){
  const colors=[0x727874,0xd5cfbc,0x979994,0x4e5658,0x804e34,0x8c3a2a,0x60655f,0x7d827b,0xbab7a4,0x5b5d52,0x4a3a2f,0xcbc1a1,0x969189,0xa29887,0xe9e7d8,0x775640];
  const data=new Uint8Array(64*4*4);colors.forEach((base,i)=>{for(let k=0;k<16;k++){
    const c=i===14&&((k>=5&&k<=9)||(k>=10&&k<=14))?0x9d3c30:base;
    const p=((3-Math.floor(i/4))*64+(i%4)*16+k)*4;data.set([c>>16,(c>>8)&255,c&255,255],p);
  }});
  const t=new DataTexture(data,64,4);t.colorSpace=SRGBColorSpace;t.needsUpdate=true;return t;
}

export function WeddingCourt({shadows}:{shadows:boolean}){
  const house=useMemo(makeWeddingArchitecture,[]),map=useBakedSurface(atlasUrl),spray=useBakedSurface(sprayUrl),proof=useMemo(materialProof,[]);
  useEffect(()=>()=>{for(const {geometry} of house)geometry.dispose();},[house]);
  useEffect(()=>{if(map)proof.dispose();return ()=>proof.dispose();},[map,proof]);
  return <group name="wedding:jiangnan-courtyard" pointerEvents="none">
    <ArchitectureHorizon/>
    {house.map(({name,geometry,casts,foliage})=>(!foliage||spray)&&<mesh key={name} name={`wedding:architecture:${name}`} geometry={geometry}
      receiveShadow={shadows&&(casts||name==='ground')} castShadow={shadows&&casts} raycast={noPick}>
      {foliage?<meshStandardMaterial key={spray!.uuid} vertexColors map={spray} alphaTest={.48} side={DoubleSide} roughness={.96}/>:
        <meshStandardMaterial key={map?.uuid??'architecture-flat'} vertexColors map={map??proof} roughness={.91}/>}
    </mesh>)}
    {/* Local soft face lights spill from the sky court and the paper window.
        Neither adds a shadow pass or uses the ceremonial red as a skin light. */}
    <pointLight name="wedding:hall-skylight-bounce" position={[.84,2.73,-3.11]} color="#fff0dc" intensity={6.8} distance={6.8} decay={2}/>
    <pointLight name="wedding:dressing-window-bounce" position={[9.15,2.35,-5.15]} color="#fff3df" intensity={3.7} distance={4.9} decay={2}/>
    <WeddingFurnishings shadows={shadows}/>
  </group>;
}
