import type { TranslationKey as Key } from '../../languageStore';
import type { SceneryId } from '../scenery/catalog';
import type { Vector3 } from 'three';
import { getKiteWind, resetKite, setKiteWind } from './kite/kiteStore';
import { aimFerry, launchFerry, resetFerry } from './ferry/voyage';
import { aimEncore, dyeEncore, resetEncore } from './encore/encoreRound';
import { clearCard } from './lunarCard';
import { retractBlade, toggleBlade } from './saberLight';
import { cycleWand, stopWand } from './wandMotor';
import { clearRemoteEgg, cycleRemoteEgg } from './remote/remoteMotor';
import { constellationGrip, ribbonPenGrip, lanternGrip } from './festival/fittings';

export type Hand = 'left' | 'right';
type Story = { name:Key; help:Key; left:Key; right:Key; cue:(side:Hand)=>void };
type Definition = {
  label:Key; homeLabel:Key; homeName?:Key;
  /** The handheld effect can travel even when a station stays in its own set. */
  portable?:boolean;
  guide:{vr:Key; screen:Key; end:Key};
  // Type-only link. Import the actual components only on the rendering side.
  view:keyof typeof import('./propViews');
  /** Point in the rendered Piece under the character's fingers, in metres;
   * pitch cancels a controller-specific handle rake when fitted to a palm. */
  grip:{point:readonly [number,number,number];pitch:number};
  /** Named screen action at the actor's wrist. Omit held seconds for a single start frame. */
  screenUse?:{label:Key;duration?:number};
  onGrip?:(at:Vector3, dir:Vector3)=>void;
  onEquip?:()=>void; onScreenEquip?:()=>void; onStow?:()=>void; onLeave?:()=>void;
  story?:Story;
} & ({home:SceneryId; visit:Key} | {home:null; visit:null});

const catalog = {
  kite: {
    label:'toyKite', home:'lawn', homeLabel:'hudLawn', visit:'visitKite', view:'meadowReel',grip:{point:[0,-.057,-.054],pitch:.10},
    guide:{vr:'guideKiteVr', screen:'guideKiteScreen', end:'guideKiteEnd'},
    story:{name:'storyKite', help:'storyKiteHelp', left:'storyWindLeft', right:'storyWindRight', cue:setKiteWind},
    onGrip:()=>setKiteWind(getKiteWind()==='left'?'right':'left'), onStow:resetKite,
  },
  encore: {
    label:'toyEncore', home:'liveHouse', homeLabel:'toyClubName', visit:'visitEncore', view:'ribbonMic',grip:{point:[0,-.065,-.055],pitch:.12},
    guide:{vr:'guideEncoreVr', screen:'guideEncoreScreen', end:'guideEncoreEnd'},
    story:{name:'storyEncore', help:'storyEncoreHelp', left:'storyDyeLeft', right:'storyDyeRight', cue:dyeEncore},
    onGrip:(at,dir)=>{const side=aimEncore(at,dir); if(side)dyeEncore(side);}, onLeave:resetEncore,
  },
  bubbles: {
    label:'toyBubbles', portable:true, home:'pool', homeLabel:'allSets', homeName:'toyShell', visit:'visitFerry', view:'shellBlower',grip:{point:[0,-.054,-.057],pitch:0},
    guide:{vr:'guideBubblesVr', screen:'guideBubblesScreen', end:'guideBubblesEnd'},
    story:{name:'storyFerry', help:'storyFerryHelp', left:'storyFerryLeft', right:'storyFerryRight', cue:launchFerry},
    onGrip:(at,dir)=>{const side=aimFerry(at,dir); if(side)launchFerry(side,at);}, onStow:resetFerry,
  },
  post: {
    label:'toyPost', home:'floor', homeLabel:'toyStudioName', visit:'visitPost', view:'lunarPunch',grip:{point:[0,-.054,-.059],pitch:0},
    guide:{vr:'guidePostVr', screen:'guidePostScreen', end:'guidePostEnd'}, onLeave:clearCard,
  },
  saber: {
    label:'toySaber', portable:true, home:null, homeLabel:'allSets', visit:null, view:'astralHilt',grip:{point:[0,-.056,-.046],pitch:.69},
    guide:{vr:'guideSaberVr', screen:'guideSaberScreen', end:'guideSaberEnd'},
    onGrip:toggleBlade, onEquip:retractBlade, onScreenEquip:toggleBlade, onStow:retractBlade,
  },
  dildo: {
    label:'toyDildo', portable:true, home:null, homeLabel:'allSets', visit:null, view:'silicone',grip:{point:[0,.001,-.031],pitch:.32},
    guide:{vr:'guideDildoVr', screen:'guideDildoScreen', end:'guideDildoEnd'},
  },
  wand: {
    label:'toyWand', portable:true, home:null, homeLabel:'allSets', visit:null, view:'cordless',grip:{point:[0,-.034,-.041],pitch:.48},
    guide:{vr:'guideWandVr',screen:'guideWandScreen',end:'guideWandEnd'},
    onGrip:cycleWand, onScreenEquip:cycleWand, onStow:stopWand,
  },
  feather: {
    label:'toyFeather', home:null, homeLabel:'allSets', visit:null, view:'plumeBrush',grip:{point:[0,-.032,-.04],pitch:.40},
    guide:{vr:'guideFeatherVr',screen:'guideFeatherScreen',end:'guideFeatherEnd'},
  },
  lotusFan: {
    label:'toySilkFan',home:null,homeLabel:'allSets',visit:null,view:'roundFan',grip:{point:[0,-.032,-.043],pitch:.34},
    guide:{vr:'guideFanVr',screen:'guideFanScreen',end:'guideFanEnd'},
  },
  remoteEgg: {
    label:'toyRemoteEgg',portable:true,home:null,homeLabel:'allSets',visit:null,view:'eggRemote',grip:{point:[0,-.025,-.046],pitch:.42},
    guide:{vr:'guideEggVr',screen:'guideEggScreen',end:'guideEggEnd'},
    onGrip:cycleRemoteEgg,onStow:clearRemoteEgg,onLeave:clearRemoteEgg,
  },
  constellation:{
    label:'toyConstellation',portable:true,home:null,homeLabel:'allSets',visit:null,view:'constellation',grip:constellationGrip,
    guide:{vr:'guideConstellationVr',screen:'guideConstellationScreen',end:'guideConstellationEnd'},screenUse:{label:'toyCueConstellation'},
  },
  ribbonPen:{
    label:'toyRibbonPen',portable:true,home:null,homeLabel:'allSets',visit:null,view:'ribbonPen',grip:ribbonPenGrip,
    guide:{vr:'guideRibbonPenVr',screen:'guideRibbonPenScreen',end:'guideRibbonPenEnd'},screenUse:{label:'toyCueRibbon',duration:1.2},
  },
  lanternPod:{
    label:'toyLanternPod',portable:true,home:null,homeLabel:'allSets',visit:null,view:'lanternPod',grip:lanternGrip,
    guide:{vr:'guideLanternVr',screen:'guideLanternScreen',end:'guideLanternEnd'},screenUse:{label:'toyCueLantern'},
  },
} as const satisfies Record<string,Definition>;

export type Toy = keyof typeof catalog;
export const TOYS: Readonly<Record<Toy,Definition>> = catalog;
export const shelfToys = Object.keys(catalog) as readonly Toy[];
export function toyLabel(toy:Toy, room:SceneryId) {
  const {home, homeName, label} = TOYS[toy];
  return home===room && homeName ? homeName : label;
}

type WithStory = Extract<(typeof catalog)[Toy],{story:Story}>;
export type StoryRoom = WithStory['home'];
// Only rooms with a two-sided story expose the additional quick cues/camera.
export const STORIES = Object.fromEntries(shelfToys.flatMap(toy => {
  const item = TOYS[toy];
  return item.home && item.story ? [[item.home,{toy,...item.story}]] : [];
})) as Record<StoryRoom, Story & {toy:Toy}>;
export function isStoryRoom(room:SceneryId):room is StoryRoom {return Object.hasOwn(STORIES,room);}
