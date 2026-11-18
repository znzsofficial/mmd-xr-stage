import { create } from 'zustand';
export type Toy = 'bubbles' | 'post';
export type Hand = 'left' | 'right';
export type CharacterToy = { assetId: string; toy: Toy; hand: Hand; tilt: number; inset: number };
export const POST_Z = -5.15;
export const POST_MARKS = [[-1.7,2.15],[0,2.82],[1.7,2.15]] as const;
export const MARK_RADIUS = .38;
export function markAt(x:number,y:number) {
  return POST_MARKS.findIndex(([a,b]) => (x-a)**2+(y-b)**2 <= MARK_RADIUS**2);
}
export const useStagePlay = create<{
  held: {toy:Toy; hand:Hand} | null; character: CharacterToy | null; stamps:number[];
  give:(assetId:string, hand:Hand)=>void; adjust:(tilt:number,inset:number)=>void;
  equip:(toy:Toy,hand:Hand)=>void; stow:()=>void; stamp:(index:number)=>void; reset:()=>void; newCard:()=>void;
}>((set,get)=>({ held:null,character:null,stamps:[],
  equip:(toy,hand)=>set({held:{toy,hand},character:null}), stow:()=>set({held:null,character:null}),
  give:(assetId,hand)=>{const {held,character}=get();const toy=held?.toy??(character?.assetId===assetId?character.toy:null);
    if(toy)set({held:null,character:{assetId,hand,toy,tilt:0,inset:0}});},
  adjust:(tilt,inset)=>{const c=get().character;if(c)set({character:{...c,tilt:Math.max(-90,Math.min(90,c.tilt+tilt)),inset:Math.max(-5,Math.min(5,c.inset+inset))}});},
  stamp:index=>{const {held,stamps}=get();if(held?.toy==='post' && Number.isInteger(index) && index>=0 && index<3 && !stamps.includes(index))set({stamps:[...stamps,index]});},
  newCard:()=>set({stamps:[]}), reset:()=>set({held:null,character:null,stamps:[]}),
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
