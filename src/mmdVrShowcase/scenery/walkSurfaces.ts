import type {SceneryId} from './catalog';
import {canWalkInClinic,moveInClinic} from './clinic/clinicLayout';
import {canWalkByLawnClinic,moveByLawnClinic} from './clinic/clinicApproach';
import {XR_ENTRY,moveInSonghouse,songhouseClear,songhouseHeight} from './qinhuai/songhouseLayout';
import {WEDDING_ENTRY,moveInWedding,weddingClear} from './wedding/weddingLayout';

type Foot={x:number;z:number};
type WalkSurface={entry:Foot;clear:(x:number,z:number)=>boolean;move:(x:number,z:number,dx:number,dz:number)=>Foot;height?:(x:number,z:number)=>number};

// An entry is used on menu selection or view reset. Walking across a shared
// doorway keeps the tracked pose and uses the link's translation instead.
export const walkSurfaces:Partial<Record<SceneryId,WalkSurface>>={
  clinic:{entry:{x:0,z:2.8},clear:canWalkInClinic,move:moveInClinic},
  lawn:{entry:{x:0,z:0},clear:canWalkByLawnClinic,move:moveByLawnClinic},
  qinhuai:{entry:XR_ENTRY,clear:songhouseClear,move:moveInSonghouse,height:songhouseHeight},
  weddingCourt:{entry:WEDDING_ENTRY,clear:weddingClear,move:moveInWedding},
};
