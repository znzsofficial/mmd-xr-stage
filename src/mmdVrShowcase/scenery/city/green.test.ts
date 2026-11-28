import {expect,it} from 'vitest';
import {roomGround} from '../../movement/roomGround';
import {resolvePlacementHeight,roomPickDecks,visiblePick} from '../placementAreas';
import {cityGreenDeck,CITY_KITE_SEAT} from './green';

it('joins the street and clinic walk to the kite green, with one pick deck and a solid bench',()=>{
  const room='seasideTerminus',seat=CITY_KITE_SEAT;
  expect(roomPickDecks(room).filter(d=>Math.abs(d.x-seat.x)<d.w/2&&Math.abs(d.z-seat.z)<d.d/2)).toEqual([cityGreenDeck]);
  for(const [x,z] of [[18.1,49],[18,49],[17.9,49],[16,51.4],[16,51.5],[16,51.6],[13.2,48],[15,47.1]]){
    expect(roomGround(room,x,z),`${x},${z}`).toBe(0);
    expect(resolvePlacementHeight(room,x,z,0),`${x},${z}`).toBe(0);
  }
  expect(resolvePlacementHeight(room,seat.x,seat.z,0)).toBeNull();
  const eye={x:seat.x,y:1.45,z:50.8};
  expect(visiblePick(room,eye,seat.x,0,47.1)).toBe(false);
  expect(visiblePick(room,{...eye,x:13.2},13.2,0,48)).toBe(true);
});
