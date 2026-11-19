import type { ComponentType } from 'react';
import { LiveHouse } from '../components/LiveHouse';
import { AstralCourt } from './AstralCourt';
import { DawnChapel } from './DawnChapel';
import { Classroom } from './Classroom';
import { Meadow } from './Meadow';
import { PoolTerrace, POOL_SUN } from './PoolTerrace';
import {CLASS_SUN} from './ClassroomLayout';
import {CHAPEL_SUN} from './ChapelLayout';
import {MEADOW_SUN} from './placementAreas';
import { ClinicWard } from './clinic/ClinicWard';
import type {SceneryId} from './catalog';

// Deliberately separate from the prep-page catalog. The registry holds
// component types, never mounted meshes, textures or inactive room worlds.
type RoomSetDefinition={view:ComponentType<{shadows:boolean;concert:boolean}>;
  sky?:'day'|'court';sun?:[number,number,number];warm?:boolean; hemi?:number;ambient?:number;
  hemiSky?:string;hemiGround?:string;fog?:string;warmFog?:string};
const day={sky:'day',hemi:.32,hemiSky:'#d4e5ee',hemiGround:'#a79d8d',fog:'#c5dfe6',warmFog:'#e7c8a7'} as const;
export const roomSets:Record<SceneryId,RoomSetDefinition>={
  floor:{view:()=>null}, // StudioPlinth belongs to the shared StageFloor.
  liveHouse:{view:LiveHouse},classroom:{...day,view:Classroom,sun:CLASS_SUN},
  lawn:{...day,view:Meadow,sun:MEADOW_SUN,hemiGround:'#72845a'},pool:{...day,view:PoolTerrace,sun:POOL_SUN},
  astralCourt:{view:AstralCourt,sky:'court',hemiSky:'#dadcf5',hemiGround:'#797883',hemi:.42,fog:'#555572'},
  chapel:{view:DawnChapel,sky:'day',sun:CHAPEL_SUN,warm:true,hemiSky:'#f5ede0',hemiGround:'#bcada1',hemi:.56,fog:'#d9d1c7'},
  clinic:{view:ClinicWard,ambient:.2,hemiSky:'#f2f7f8',hemiGround:'#bbc6c1',hemi:.56,fog:'#e1e7e5'},
};
export function RoomSet({id,shadows,concert}:{id:SceneryId;shadows:boolean;concert:boolean}){
  const Set=roomSets[id].view;return <Set shadows={shadows} concert={concert}/>;
}
