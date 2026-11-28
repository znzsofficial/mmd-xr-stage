import type {PickDeck} from '../routes/types';

// World metres in the continuous station district. The east edge meets the
// street; the level grass is itself the pick deck, not another layer of paving.
export const cityGreenDeck:PickDeck = {x:15, z:49, w:6, d:5, y:0};
export const CITY_KITE_SEAT = {x:15, z:48, yaw:0} as const;
export const cityGreenBlocks = [
  {x:CITY_KITE_SEAT.x, z:CITY_KITE_SEAT.z, w:1.85, d:.58, bottom:0, top:.915},
];

export function onCityGreen(x:number,z:number){
  return Math.abs(x-cityGreenDeck.x)<=cityGreenDeck.w/2 && Math.abs(z-cityGreenDeck.z)<=cityGreenDeck.d/2;
}
