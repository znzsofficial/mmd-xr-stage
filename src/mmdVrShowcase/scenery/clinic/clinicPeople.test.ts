import {expect,it} from 'vitest';
import {useMmdVrStore} from '../../mmdVrStore';
import {canPlaceInScenery,visiblePick} from '../placementAreas';
import {roomGround} from '../../movement/roomGround';
import {FIXTURES} from './clinicLayout';

it('opens only the nurse sight lines and leaves the consultation furniture occupied',()=>{
  const {prefs,setPrefs}=useMmdVrStore.getState();
  // Each ray travels east to a valid mark. The first passes above the seat,
  // the other two through the space between the chair and the desk.
  const through=(y:number,z:number)=>visiblePick('clinic',{x:-6.76,y,z},-4.60,0,z);
  try {
    for(const shown of [true,false,true]){
      setPrefs({showSceneryPeople:shown});
      for(const [y,z] of [[1.38,3.46],[.95,3.8],[.52,3.8]]){
        expect(canPlaceInScenery('clinic',-4.60,z)).toBe(true);
        expect(through(y,z)).toBe(!shown);
      }
      expect(through(.57,3.41)).toBe(false); // chair still occludes the low ray
      for(const f of [FIXTURES.consultDesk,FIXTURES.deskSeat,FIXTURES.examCabinet]){
        expect(canPlaceInScenery('clinic',f.x,f.z)).toBe(false);
        expect(roomGround('clinic',f.x,f.z)).toBe(-Infinity);
      }
      expect(visiblePick('clinic',{x:-7.48,y:1.6,z:-2.92},-7.48,0,-1.29)).toBe(false); // teaching exhibit
    }
  } finally {setPrefs({showSceneryPeople:prefs.showSceneryPeople});}
});
