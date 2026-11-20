import {useMmdVrStore} from '../../mmdVrStore';
import {canPlaceInClinic,canWalkInClinic,clinicPlacementVisible,moveInClinic} from './clinicLayout';
import type {Eye} from './clinicApproach';

// Runtime edge only: the bake script imports the pure layout directly. Each
// pick/step sees the current preference without subscribing the whole ward.
const people=()=>useMmdVrStore.getState().prefs.showSceneryPeople;
export const clinicNavigation={
  clear:(x:number,z:number)=>canWalkInClinic(x,z,people()),
  place:(x:number,z:number)=>canPlaceInClinic(x,z,people()),
  visible:(from:Eye,x:number,z:number)=>clinicPlacementVisible(from,x,z,people()),
  move:(x:number,z:number,dx:number,dz:number)=>moveInClinic(x,z,dx,dz,people()),
};
