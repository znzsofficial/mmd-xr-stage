import { useEffect, useMemo } from 'react';
import { DataTexture, DoubleSide, SRGBColorSpace } from 'three';
import { noPick } from '../sceneryPaint';
import { useBakedSurface } from '../useBakedSurface';
import { WEDDING_ANCHORS } from './weddingLayout';
import { WEDDING_WINDOW_PAPER } from './architectureHouse';
import { makeFeast } from './furnishingsFeast';
import { makeAltar, makeChair, makeVanity } from './furnishingsHall';
import { Surface, white } from './furnishingsMesh';
import { makeSedan } from './furnishingsSedan';
import {makeBridalBed,makeBridalTrunk,makeWeddingCups} from './bridalFurniture';
import {BED,CUP_TABLE,TRUNK} from './bridalLayout';
import {BridalCurtains} from './BridalCurtains';
import atlas from './wedding-furnishings.webp';
import {CeremonyDetails} from './ceremonyDetails';

// The page can present its first XR or screen frame while the full print is
// still decoding. Keep USE_MAP in that first program and retain the local
// colours of silk, wood and porcelain, even on a slow or failed request.
function makePaletteProof(){
  const w=48,h=32,data=new Uint8Array(w*h*4);
  for(let j=0;j<h;j++)for(let i=0;i<w;i++){
    const swatch=j<16?(i<16?0xb84340:i<32?0x813544:0xb53637):i>=32?0xecebdc:i>=16?0x633b3a:
      j<21?0xdee4d8:i===15&&j<=22?0xffffff:j<27?0xaa724f:0xc6af82;
    const index=((h-1-j)*w+i)*4;
    data[index]=swatch>>16;data[index+1]=swatch>>8;data[index+2]=swatch;data[index+3]=255;
  }
  const map=new DataTexture(data,w,h);map.colorSpace=SRGBColorSpace;map.needsUpdate=true;return map;
}

/** Static meshes are batched by station and material, not by individual cup,
 * tassel or chair spindle. Paired tables/chairs reuse the same GPU geometry. */
export function WeddingFurnishings({shadows=false}:{shadows?:boolean}={}){
  const map=useBakedSurface(atlas),proof=useMemo(makePaletteProof,[]),paint=map??proof;
  useEffect(()=>{if(map)proof.dispose();return ()=>proof.dispose();},[map,proof]);
  const pieces=useMemo(()=>({sedan:makeSedan(),feast:makeFeast(),altar:makeAltar(),chair:makeChair(),vanity:makeVanity(),bed:makeBridalBed(),cups:makeWeddingCups(),trunk:makeBridalTrunk()}),[]);
  const windowBirds=useMemo(()=>{
    const s=new Surface();for(const k of [-1,1])s.grid(1,1,(u,v)=>[k*.2275+(u-.5)*.221,(v-.5)*.173,0],white,'pairBird',(u,v)=>[k<0?u:1-u,v]);
    return s.finish();
  },[]);
  useEffect(()=>()=>windowBirds.dispose(),[windowBirds]);
  useEffect(()=>()=>{for(const piece of Object.values(pieces))for(const g of Object.values(piece))g?.dispose();},[pieces]);
  const a=WEDDING_ANCHORS;
  const draw=(name:string,anchor:{x:number;z:number},p:ReturnType<typeof makeSedan>)=>
    <group key={name} name={`wedding:${name}`} position={[anchor.x,0,anchor.z]}>
      <mesh name={`wedding:${name}-wood-silk-glaze`} geometry={p.body} raycast={noPick} castShadow={shadows} receiveShadow>
        <meshStandardMaterial key={paint.uuid} map={paint} vertexColors roughness={.69} side={DoubleSide}/>
      </mesh>
      {p.metal&&<mesh name={`wedding:${name}-bronze`} geometry={p.metal} raycast={noPick} receiveShadow>
        <meshStandardMaterial key={paint.uuid} map={paint} vertexColors roughness={.42} metalness={.30} side={DoubleSide}/>
      </mesh>}
      {p.paper&&map&&<mesh name={`wedding:${name}-papercut`} geometry={p.paper} raycast={noPick}>
        <meshStandardMaterial map={map} vertexColors roughness={.94} alphaTest={.47}/>
      </mesh>}
    </group>;
  return <><group name="wedding:furnishings" pointerEvents="none">
    <CeremonyDetails cloth={paint}/>
    {draw('sedan',a.sedan,pieces.sedan)}{a.feasts.map((r,i)=>draw(`feast-${i}`,r,pieces.feast))}
    {draw('altar',a.altar,pieces.altar)}{a.chairs.map((r,i)=>draw(`armchair-${i}`,r,pieces.chair))}{draw('vanity',a.vanity,pieces.vanity)}
    {draw('canopy-bed',BED,pieces.bed)}{draw('joined-cups',CUP_TABLE,pieces.cups)}{draw('trousseau-chest',TRUNK,pieces.trunk)}
    {map&&<mesh name="wedding:dressing-window-birds" geometry={windowBirds} position={[WEDDING_WINDOW_PAPER.x,WEDDING_WINDOW_PAPER.y,WEDDING_WINDOW_PAPER.z]} raycast={noPick}>
      <meshStandardMaterial map={map} roughness={.94} alphaTest={.47}/>
    </mesh>}
  </group><BridalCurtains print={paint}/></>;
}
