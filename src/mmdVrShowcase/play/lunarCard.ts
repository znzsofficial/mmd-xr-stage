import { create } from 'zustand';

export const POST_Z = -5.15;
export const POST_MARKS = [[-1.7,2.15],[0,2.82],[1.7,2.15]] as const;
export function markAt(x:number,y:number) {
  return POST_MARKS.findIndex(([a,b]) => (x-a)**2+(y-b)**2 <= .38**2);
}
export const useLunarCard = create<{stamps: readonly number[]}>(() => ({stamps: []}));
export function stamp(index: number) {
  const {stamps} = useLunarCard.getState();
  if (Number.isInteger(index) && index >= 0 && index < POST_MARKS.length && !stamps.includes(index))
    useLunarCard.setState({stamps:[...stamps,index]});
}
export function clearCard() { if (useLunarCard.getState().stamps.length) useLunarCard.setState({stamps:[]}); }
