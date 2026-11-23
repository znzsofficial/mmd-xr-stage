import {createStore} from 'zustand/vanilla';
import type {ConceptionEvent} from './game';
import {PICTURE_END} from './pictureClock';

// Local to a mounted observation sheet. Only transport changes notify the UI;
// elapsed time is sampled by the visible diagram, never by the actor or VMD.
export function createEggReplay(){
  const state=createStore<{event?:ConceptionEvent;paused:boolean}>(()=>({paused:false}));
  let seconds=0,previous:number|undefined;
  return {state,
    start(event:ConceptionEvent){seconds=0;previous=undefined;state.setState({event,paused:false});},
    stop(){if(state.getState().event)state.setState({event:undefined,paused:false});},
    pause(paused:boolean){previous=undefined;state.setState({paused});},
    suspend(){previous=undefined;},
    sample(event:ConceptionEvent|undefined,now:number,canDraw:boolean){
      const take=state.getState();if(!event||take.event!==event)return undefined;
      if(!take.paused&&(previous!==undefined||canDraw)){
        if(previous!==undefined)seconds=Math.min(PICTURE_END,seconds+Math.max(0,now-previous)/1000);
        previous=now;
      }
      return seconds;
    },
  };
}
export type EggReplay=ReturnType<typeof createEggReplay>;
