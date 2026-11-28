import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Vector3 } from 'three';
import { canUseGrip, giveScreenToy, gripLatch, handleGripStart, useStagePlay } from './stagePlay';
import { hasToyStation, shelfToys, STORIES, TOYS, toyLabel } from './propCatalog';
import {sceneryIds} from '../scenery/catalog';
import { markAt, POST_MARKS, stamp, useLunarCard } from './lunarCard';
import { saberLit } from './saberLight';
import { useWandMotor } from './wandMotor';
import { advanceFerry, GATE_X, GATE_Y } from './ferry/voyage';
import { BADGE_X, BADGE_Y, useEncorePrint } from './encore/encoreRound';
import { useKiteStore } from './kite/kiteStore';
import { beginMmdVrAssetSession, endMmdVrAssetSession } from '../backpack/sessionAssets';

vi.mock('@react-three/fiber',()=>{throw Error('Prop metadata/ownership loaded a scene renderer');});
const get=useStagePlay.getState, forward=new Vector3(0,0,-1);
beforeEach(()=>get().reset());

describe('shared prop catalog and ownership',()=>{
  it('shares all thirteen props in the solo room, replacing the existing owner',()=>{
    beginMmdVrAssetSession([], 'webgpu');
    try {
      get().mountStand('actor');
      get().equip('remoteEgg','right');expect(get().held?.toy).toBe('remoteEgg');expect(get().stand).toBeNull();
      expect(shelfToys).toHaveLength(13);
      for(const toy of shelfToys.filter(toy=>toy!=='remoteEgg')){
        get().equip(toy,'left');expect(get().held).toEqual({toy,hand:'left'});expect(get().stand).toBeNull();
        get().give('actor','right');expect(get().character).toMatchObject({toy,assetId:'actor',hand:'right'});
        get().stow();expect(get().held).toBeNull();expect(get().character).toBeNull();
      }
    } finally {endMmdVrAssetSession();get().reset();}
  });
  it('can assign each wrist prop to either wrist without also holding a second copy',()=>{
    expect(shelfToys).toEqual(expect.arrayContaining(['bubbles','post','saber','kite','encore','dildo','wand','feather']));
    for(const toy of shelfToys.filter(t=>t!=='remoteEgg')){
      get().equip(toy,'left');get().give('actor','right');get().give('other','left');
      expect(get().character).toMatchObject({toy,assetId:'actor',hand:'right'});
      get().give('actor','left');expect(get().character?.hand).toBe('left');expect(get().held).toBeNull();
      get().stow();expect(get().character).toBeNull();
    }
    expect(toyLabel('bubbles','pool')).toBe('toyShell');expect(toyLabel('bubbles','classroom')).toBe('toyBubbles');
  });
  it('uses the actual controller, room and current owner; a wrist transfer cannot fire an old grip',()=>{
    get().equip('saber','right');expect(canUseGrip(get(),'saber','left','astralCourt')).toBe(false);
    expect(canUseGrip(get(),'saber','right','chapel')).toBe(true);
    expect(canUseGrip(get(),'saber','right','astralCourt')).toBe(true);
    TOYS.saber.onGrip!(new Vector3(),forward);get().give('actor','left');get().give('actor','right');
    expect(canUseGrip(get(),'saber','right','astralCourt')).toBe(false);expect(saberLit()).toBe(true);
    get().equip('saber','right');expect(saberLit()).toBe(false);
    TOYS.saber.onGrip!(new Vector3(),forward);get().equip('post','right');expect(saberLit()).toBe(false);
  });
  it('transfers one tool to an explicit stand and never silently gives its piece to a wrist',()=>{
    get().equip('wand','left');handleGripStart('wand','floor',new Vector3(),forward);
    get().mountStand('actor');expect(get()).toMatchObject({stand:{assetId:'actor',toy:'dildo'},held:null,character:null});
    expect(useWandMotor.getState().speed).toBe(0);
    get().give('other','right');expect(get().stand?.assetId).toBe('actor');expect(get().character).toBeNull();
    get().equip('dildo','right');expect(get().stand).toBeNull();expect(get().held?.hand).toBe('right');
    get().mountStand('actor');get().stow();expect(get().stand).toBeNull();
  });
  it('lights a freshly equipped screen saber in any set; switching wrists preserves the blade',()=>{
    giveScreenToy('actor','saber','left','chapel');expect(saberLit()).toBe(true);
    get().reset();giveScreenToy('actor','saber','left','astralCourt');expect(saberLit()).toBe(true);
    giveScreenToy('actor','saber','right','astralCourt');expect(saberLit()).toBe(true);
    get().stow();expect(saberLit()).toBe(false);
  });
  it('cycles the wand once per new usable squeeze; transfers keep speed but a shelf swap, return or new room cuts power',()=>{
    const speed=()=>useWandMotor.getState().speed,latch=gripLatch();
    const sample=(pressed:boolean,blocked=false)=>{
      if(latch(!blocked&&canUseGrip(get(),'wand','left','floor'),pressed)==='start')handleGripStart('wand','floor',new Vector3(),forward);
      return speed();
    };
    get().equip('wand','left');
    expect([sample(false),sample(true),sample(true),sample(false),sample(true),sample(false),sample(true)]).toEqual([0,1,1,1,2,2,0]);
    expect([sample(true,true),sample(true),sample(false),sample(true)]).toEqual([0,0,0,1]);
    const running=useWandMotor.getState();get().equip('wand','right');expect(useWandMotor.getState()).toBe(running);
    get().give('actor','right');get().give('actor','left');expect(sample(true)).toBe(1);
    get().equip('feather','right');expect(speed()).toBe(0);
    giveScreenToy('actor','wand','right','chapel');giveScreenToy('actor','wand','left','chapel');expect(speed()).toBe(1);
    get().stow();expect(speed()).toBe(0);
    giveScreenToy('actor','wand','right','floor');get().reset();expect(speed()).toBe(0);expect(get().character).toBeNull();
  });
  it('keeps the in-flight ferry on handoff, ends it on replacement, and leaves no kite after a zone switch',()=>{
    get().equip('bubbles','left');expect(canUseGrip(get(),'bubbles','left','clinic')).toBe(true);
    const aimed=new Vector3(-GATE_X,GATE_Y,2);
    handleGripStart('bubbles','clinic',aimed,forward);expect(advanceFerry(0)).toBeNull();
    handleGripStart('bubbles','pool',new Vector3(0,1,2),forward);expect(advanceFerry(0)).toBeNull();
    handleGripStart('bubbles','pool',aimed,forward);expect(advanceFerry(.5)?.side).toBe('left');
    get().give('actor','right');expect(advanceFerry(0)?.elapsed).toBe(.5);
    get().equip('kite','right');expect(advanceFerry(0)).toBeNull();
    STORIES.seasideTerminus.cue('right');TOYS.kite.onGrip!(new Vector3(),forward);get().give('actor','left');
    expect(useKiteStore.getState()).toEqual({active:true,wind:'left'});
    get().reset();expect(useKiteStore.getState()).toEqual({active:false,wind:'right'});
  });
  it('flies from either owner in every set; only the city has an actor-free kite cue',()=>{
    expect(STORIES.seasideTerminus.toy).toBe('kite');
    expect(sceneryIds.filter(room=>hasToyStation('kite',room))).toEqual(['seasideTerminus']);
    for(const room of sceneryIds){
      get().equip('kite','left');expect(useKiteStore.getState()).toEqual({active:true,wind:'right'});
      expect(canUseGrip(get(),'kite','left',room)).toBe(true);
      handleGripStart('kite',room,new Vector3(-4,1.2,9),forward);expect(useKiteStore.getState().wind).toBe('left');
      get().give('actor','right');expect(canUseGrip(get(),'kite','left',room)).toBe(false);
      giveScreenToy('actor','kite','left',room);expect(useKiteStore.getState().wind).toBe('left');
      TOYS.kite.wristCues!.cue('right');expect(useKiteStore.getState().wind).toBe('right');
      get().equip('bubbles','right');expect(useKiteStore.getState().active).toBe(false);
      giveScreenToy('actor','kite','left',room);expect(useKiteStore.getState().active).toBe(true);
      get().stow();expect(useKiteStore.getState().active).toBe(false);
    }
  });
  it('retains completed curtain and postcard when stowed, clears unowned artwork on leaving',()=>{
    const badge=new Vector3(BADGE_X,BADGE_Y,0);
    get().equip('encore','left');handleGripStart('encore','floor',badge,forward);expect(useEncorePrint.getState().first).toBeNull();
    handleGripStart('encore','liveHouse',badge,forward);
    STORIES.liveHouse.cue('left');get().stow();expect(useEncorePrint.getState()).toEqual({first:'right',complete:true});
    get().equip('post','left');expect(canUseGrip(get(),'post','left','liveHouse')).toBe(false);
    expect(canUseGrip(get(),'post','left','floor')).toBe(true);expect(markAt(0,0)).toBe(-1);
    for(const i of [1,1,5,-1,0,2]){const point=POST_MARKS[i];stamp(point?markAt(point[0],point[1]):i);}
    get().stow();expect(useLunarCard.getState().stamps).toEqual([1,0,2]);
    get().reset();expect(useLunarCard.getState().stamps).toEqual([]);expect(useEncorePrint.getState().first).toBeNull();
  });
  it('requires a fresh squeeze after a menu or lost tracking rather than activating on recovery',()=>{
    const step=gripLatch();expect(step(true,true)).toBe('off');step(true,false);
    expect(step(true,true)).toBe('start');expect(step(true,true)).toBe('held');
    step(false,true);expect(step(true,true)).toBe('off');step(true,false);expect(step(true,true)).toBe('start');
  });
});
