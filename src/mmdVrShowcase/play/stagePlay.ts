import { create } from 'zustand';
import type { SceneryId } from '../scenery/catalog';
export const TOYS = {
  kite: { label:'toyKite', hint:'toyKiteHint', home:'lawn', visit:'visitKite' },
  encore: { label:'toyEncore', hint:'toyEncoreHint', home:'liveHouse', visit:'visitEncore' },
  bubbles: { label:'toyBubbles', hint:'toyBubblesHint', home:'pool', visit:'visitFerry' },
  post: { label:'toyPost', hint:'toyPostHint', home:'floor', visit:'visitPost' },
  saber: { label:'toySaber', hint:'toySaberHint', home:null, visit:null },
} as const;
export type Toy = keyof typeof TOYS;
export const shelfToys = Object.keys(TOYS) as readonly Toy[];
export type Hand = 'left' | 'right';
export const STORIES = {
  lawn: {name:'storyKite', toy:'kite', left:'storyWindLeft', right:'storyWindRight'},
  pool: {name:'storyFerry', toy:'bubbles', left:'storyFerryLeft', right:'storyFerryRight'},
  liveHouse: {name:'storyEncore', toy:'encore', left:'storyDyeLeft', right:'storyDyeRight'},
} as const;
export type StoryRoom = keyof typeof STORIES;
export function isStoryRoom(room: SceneryId):room is StoryRoom {return Object.hasOwn(STORIES,room);}
export type CharacterToy = { assetId: string; toy: Toy; hand: Hand; tilt: number; inset: number };
export const POST_Z = -5.15;
export const POST_MARKS = [[-1.7,2.15],[0,2.82],[1.7,2.15]] as const;
export const MARK_RADIUS = .38;
export function markAt(x:number,y:number) {
  return POST_MARKS.findIndex(([a,b]) => (x-a)**2+(y-b)**2 <= MARK_RADIUS**2);
}
export const useStagePlay = create<{
  held: {toy:Toy; hand:Hand} | null; character: CharacterToy | null; stamps:number[];
  saberLit:boolean; toggleSaber:()=>void;
  give:(assetId:string, hand:Hand)=>void; adjust:(tilt:number,inset:number)=>void;
  equip:(toy:Toy,hand:Hand)=>void; stow:()=>void; stamp:(index:number)=>void; reset:()=>void; newCard:()=>void;
}>((set,get)=>({ held:null,character:null,stamps:[],saberLit:false,
  toggleSaber:()=>{if(get().held?.toy==='saber')set({saberLit:!get().saberLit});},
  equip:(toy,hand)=>set({held:{toy,hand},character:null,saberLit:false}), stow:()=>set({held:null,character:null,saberLit:false}),
  give:(assetId,hand)=>{const {held,character}=get();const toy=held?.toy??(character?.assetId===assetId?character.toy:null);
    if(toy)set({held:null,character:{assetId,hand,toy,tilt:0,inset:0}});},
  adjust:(tilt,inset)=>{const c=get().character;if(c)set({character:{...c,tilt:Math.max(-90,Math.min(90,c.tilt+tilt)),inset:Math.max(-5,Math.min(5,c.inset+inset))}});},
  stamp:index=>{const {held,stamps}=get();if(held?.toy==='post' && Number.isInteger(index) && index>=0 && index<3 && !stamps.includes(index))set({stamps:[...stamps,index]});},
  newCard:()=>set({stamps:[]}), reset:()=>set({held:null,character:null,stamps:[],saberLit:false}),
}));

/** After UI, tracking loss or transfer, a held grip must be released before use. */
export function gripLatch() {
  let armed=false, down=false;
  return (usable:boolean,pressed:boolean) => {
    if(!usable){armed=false;down=false;return 'off';}
    if(!pressed){armed=true;down=false;return 'off';}
    if(!armed)return 'off';
    if(!down){down=true;return 'start';}
    return 'held';
  };
}
