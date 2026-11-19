import type { TranslationKey as Key } from '../../languageStore';
import type { SceneryId } from '../scenery/catalog';
import type { Vector3 } from 'three';
import { getKiteWind, resetKite, setKiteWind } from './kite/kiteStore';
import { aimFerry, launchFerry, resetFerry } from './ferry/voyage';
import { aimEncore, dyeEncore, resetEncore } from './encore/encoreRound';
import { clearCard } from './lunarCard';
import { retractBlade, toggleBlade } from './saberLight';

export type Hand = 'left' | 'right';
type Story = { name:Key; help:Key; left:Key; right:Key; cue:(side:Hand)=>void };
type Definition = {
  label:Key; homeLabel:Key; homeName?:Key;
  guide:{vr:Key; screen:Key; end:Key};
  // Type-only link. Import the actual components only on the rendering side.
  view:keyof typeof import('./propViews');
  onGrip?:(at:Vector3, dir:Vector3)=>void;
  onEquip?:()=>void; onScreenEquipAtHome?:()=>void; onStow?:()=>void; onLeave?:()=>void;
  story?:Story;
} & ({home:SceneryId; visit:Key} | {home:null; visit:null});

const catalog = {
  kite: {
    label:'toyKite', home:'lawn', homeLabel:'hudLawn', visit:'visitKite', view:'meadowReel',
    guide:{vr:'guideKiteVr', screen:'guideKiteScreen', end:'guideKiteEnd'},
    story:{name:'storyKite', help:'storyKiteHelp', left:'storyWindLeft', right:'storyWindRight', cue:setKiteWind},
    onGrip:()=>setKiteWind(getKiteWind()==='left'?'right':'left'), onStow:resetKite,
  },
  encore: {
    label:'toyEncore', home:'liveHouse', homeLabel:'toyClubName', visit:'visitEncore', view:'ribbonMic',
    guide:{vr:'guideEncoreVr', screen:'guideEncoreScreen', end:'guideEncoreEnd'},
    story:{name:'storyEncore', help:'storyEncoreHelp', left:'storyDyeLeft', right:'storyDyeRight', cue:dyeEncore},
    onGrip:(at,dir)=>{const side=aimEncore(at,dir); if(side)dyeEncore(side);}, onLeave:resetEncore,
  },
  bubbles: {
    label:'toyBubbles', home:'pool', homeLabel:'hudPool', homeName:'toyShell', visit:'visitFerry', view:'shellBlower',
    guide:{vr:'guideBubblesVr', screen:'guideBubblesScreen', end:'guideBubblesEnd'},
    story:{name:'storyFerry', help:'storyFerryHelp', left:'storyFerryLeft', right:'storyFerryRight', cue:launchFerry},
    onGrip:(at,dir)=>{const side=aimFerry(at,dir); if(side)launchFerry(side,at);}, onStow:resetFerry,
  },
  post: {
    label:'toyPost', home:'floor', homeLabel:'toyStudioName', visit:'visitPost', view:'lunarPunch',
    guide:{vr:'guidePostVr', screen:'guidePostScreen', end:'guidePostEnd'}, onLeave:clearCard,
  },
  saber: {
    label:'toySaber', home:'astralCourt', homeLabel:'hudAstralCourt', visit:'visitSaber', view:'astralHilt',
    guide:{vr:'guideSaberVr', screen:'guideSaberScreen', end:'guideSaberEnd'},
    onGrip:toggleBlade, onEquip:retractBlade, onScreenEquipAtHome:toggleBlade, onStow:retractBlade,
  },
  dildo: {
    label:'toyDildo', home:null, homeLabel:'allSets', visit:null, view:'silicone',
    guide:{vr:'guideDildoVr', screen:'guideDildoScreen', end:'guideDildoEnd'},
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
