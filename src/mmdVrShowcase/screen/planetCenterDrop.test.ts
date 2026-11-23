import {Vector3} from 'three';
import {expect,it} from 'vitest';
import {lanternShots} from '../scenery/planet/lanternShots';
import {clearingDeck,lanternCentre} from '../scenery/planet/lanternClearing';
import {planetCenterDrop} from './planetCenterDrop';

it('places from the clearing portrait on its flat deck, retains the mother stage at entry and rejects the hidden nearest deck',()=>{
  const {x,y,z}=clearingDeck;
  const eye=new Vector3().fromArray(lanternShots.find(s=>s.key==='lanternClearingView')!.eye);
  expect(planetCenterDrop(eye)).toEqual({x,y,z});expect(planetCenterDrop({x:0,y:2.18,z:3.45})).toEqual({x:0,y:0,z:0});
  expect(planetCenterDrop(lanternCentre.clone().add(new Vector3(-8,-1,1)))).toBeNull();
});
