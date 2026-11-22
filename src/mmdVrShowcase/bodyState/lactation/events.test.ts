import {expect,it} from 'vitest';
import {clearBackpack,useBackpack} from '../../backpack';
import {beginBodyPreview,cancelBodyPreview,commitBodyPreview,drainBodySide,patchBodyPreview,advanceLiveBodies,useBodyState} from '../store';
import {subscribeMilkEffects,type MilkEffectEvent} from './events';

it('offers exactly the real debit to the current room; only a new drain can produce an effect',()=>{
  useBackpack.setState({entries:[{id:'a',kind:'model',file:new File([],'actor.pmx'),path:'actor.pmx'}],
    selected:'a',live:{a:{runtimeId:'r',position:[0,0,0],visible:true}}});
  const events:MilkEffectEvent[]=[];let exposed=false;
  const stop=subscribeMilkEffects(e=>{events.push(e);return exposed;});
  try{
    beginBodyPreview('a',true);patchBodyPreview('a',{lactating:true,left:.1,right:.6});
    expect(drainBodySide('a','left')).toEqual({before:.1,after:0,visible:false});
    exposed=true;expect(drainBodySide('a','left')).toBe(null);advanceLiveBodies(['a'],1);
    patchBodyPreview('a',{right:.5});expect(drainBodySide('a','right')).toEqual({before:.5,after:.25,visible:true});
    commitBodyPreview('a');beginBodyPreview('a');patchBodyPreview('a',{left:0});cancelBodyPreview('a');
    expect(useBodyState.getState().byAsset.a.right).toBe(.25);
    expect(events).toEqual([{kind:'drain',assetId:'a',runtimeId:'r',side:'left',amount:.1},
      {kind:'drain',assetId:'a',runtimeId:'r',side:'right',amount:.25},{kind:'clear',assetId:'a'}]);
  }finally{stop();clearBackpack();}
});
