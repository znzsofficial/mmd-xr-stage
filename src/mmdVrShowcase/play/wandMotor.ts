import { create } from 'zustand';

type Speed = 0 | 1 | 2;
// The motor belongs to the single equipped wand. Changing the holder does not
// restart it. Keep the menu/ownership entry point independent of rendering.
export const useWandMotor = create<{speed:Speed}>(()=>({speed:0}));
export const cycleWand = () => useWandMotor.setState(({speed})=>({speed:speed===0?1:speed===1?2:0}));
export const stopWand = () => {if(useWandMotor.getState().speed)useWandMotor.setState({speed:0});};
