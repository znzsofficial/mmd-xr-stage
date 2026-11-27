import type { ComponentType } from 'react';
import { LiveHouse } from './LiveHouse';
import { AstralCourt } from './AstralCourt';
import { DawnChapel } from './DawnChapel';
import { Classroom } from './Classroom';
import { Meadow } from './Meadow';
import { PoolTerrace, POOL_SUN } from './PoolTerrace';
import {CLASS_SUN} from './ClassroomLayout';
import {CHAPEL_SUN} from './ChapelLayout';
import {MEADOW_SUN} from './meadowLandmarks';
import { ClinicWard } from './clinic/ClinicWard';
import { Songhouse } from './qinhuai/Songhouse';
import { WeddingCourt } from './wedding/WeddingCourt';
import {LanternSuite,MoonSpa} from './retreat/RetreatRooms';
import {GlassPlanet} from './planet/GlassPlanet';
import {VelvetStudio} from './velvet/VelvetStudio';
import {MedievalChamber} from './chamber/MedievalChamber';
import {ArcadeHall} from './arcade/ArcadeHall';
import {SeasideTerminus} from './terminus/SeasideTerminus';
import type {SceneryId} from './catalog';
import type {RoomLightingOverrides} from '../stage/lighting';

// Deliberately separate from the prep-page catalog. The registry holds
// component types, never mounted meshes, textures or inactive room worlds.
type RoomSetDefinition=RoomLightingOverrides & {view:ComponentType<{shadows:boolean;concert:boolean}>;
  sky?:'day'|'court'|'river'|'stars';warm?:boolean};
const day={sky:'day',hemi:.32,hemiSky:'#d4e5ee',hemiGround:'#a79d8d',fog:'#c5dfe6',warmFog:'#e7c8a7'} as const;
export const roomSets:Record<SceneryId,RoomSetDefinition>={
  seasideTerminus:{...day,view:SeasideTerminus,sun:[-4.2,4.5,2.6],warm:true,hemiSky:'#d7edf3',hemiGround:'#c0aa8d',hemi:.53,fog:'#cddfe0'},
  arcadeHall:{...day,view:ArcadeHall,sun:[-4,6,3],ambient:.33,hemi:.65},
  glassPlanet:{view:GlassPlanet,sky:'stars',sun:[-5,3.2,3.8],hemiSky:'#e2d8fb',hemiGround:'#b4a0bf',hemi:.54,fog:'#15192f'},
  floor:{view:()=>null}, // StudioPlinth belongs to the shared StageFloor.
  liveHouse:{view:LiveHouse},classroom:{...day,view:Classroom,sun:CLASS_SUN},
  lawn:{...day,view:Meadow,sun:MEADOW_SUN,hemiGround:'#72845a'},pool:{...day,view:PoolTerrace,sun:POOL_SUN},
  astralCourt:{view:AstralCourt,sky:'court',hemiSky:'#dadcf5',hemiGround:'#797883',hemi:.42,fog:'#555572'},
  chapel:{view:DawnChapel,sky:'day',sun:CHAPEL_SUN,warm:true,hemiSky:'#f5ede0',hemiGround:'#bcada1',hemi:.56,fog:'#d9d1c7'},
  clinic:{view:ClinicWard,sky:'day',ambient:.2,hemiSky:'#f2f7f8',hemiGround:'#bbc6c1',hemi:.56,fog:'#e1e7e5'},
  qinhuai:{view:Songhouse,sky:'river',sun:[-3,5.8,5.2],ambient:.11,hemiSky:'#f7d9b0',hemiGround:'#a68d7c',hemi:.48,fog:'#a59b98'},
  weddingCourt:{view:WeddingCourt,sky:'day',sun:[-3.4,6.1,5.8],ambient:.13,hemi:.48,hemiSky:'#faebd8',hemiGround:'#bdab98',fog:'#e6d9c6'},
  lanternSuite:{view:LanternSuite,sun:[3.8,3.02,-2.8],ambient:.20,hemi:.50,hemiSky:'#ffe0c8',hemiGround:'#ac8388',fog:'#513d49'},
  moonSpa:{view:MoonSpa,sun:[-2.8,3.18,-4.92],ambient:.23,hemi:.50,hemiSky:'#e5efdf',hemiGround:'#8caaa1',fog:'#89978b'},
  velvetStudio:{view:VelvetStudio,hemiSky:'#e4ced3',hemiGround:'#6f6068',fog:'#28212b'},
  medievalChamber:{view:MedievalChamber,sun:[-3.8,4.6,-2.4],hemiSky:'#d6deeb',hemiGround:'#8f7967',hemi:.24,fog:'#484047'},
};
export function RoomSet({id,shadows,concert}:{id:SceneryId;shadows:boolean;concert:boolean}){
  const Set=roomSets[id].view;return <Set shadows={shadows} concert={concert}/>;
}
