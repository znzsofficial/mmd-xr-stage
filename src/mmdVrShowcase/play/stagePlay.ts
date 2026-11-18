import { create } from 'zustand';
export type Toy = 'bubbles' | 'post';
export type Hand = 'left' | 'right';
export const POST_Z = -5.15;
export const POST_MARKS = [[-1.7,2.15],[0,2.82],[1.7,2.15]] as const;
export const MARK_RADIUS = .38;
export function markAt(x:number,y:number) {
  return POST_MARKS.findIndex(([a,b]) => (x-a)**2+(y-b)**2 <= MARK_RADIUS**2);
}
export const useStagePlay = create<{
  held: {toy:Toy; hand:Hand} | null; stamps:number[];
  equip:(toy:Toy,hand:Hand)=>void; stow:()=>void; stamp:(index:number)=>void; reset:()=>void; newCard:()=>void;
}>((set,get)=>({ held:null,stamps:[],
  equip:(toy,hand)=>set({held:{toy,hand}}), stow:()=>set({held:null}),
  stamp:index=>{const {held,stamps}=get();if(held?.toy==='post' && Number.isInteger(index) && index>=0 && index<3 && !stamps.includes(index))set({stamps:[...stamps,index]});},
  newCard:()=>set({stamps:[]}), reset:()=>set({held:null,stamps:[]}),
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
