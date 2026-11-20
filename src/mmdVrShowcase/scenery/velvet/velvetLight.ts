import type {StageLighting} from '../../stage/lighting';

// Per-page studio equipment: keep the setting on a tour away and back. A new
// visit starts on the camera-left strip, with the original room exposure.
export type VelvetLightState=Readonly<{rail:0|1|2;power:0|1|2}>;
const power=[.56,1.12,1.75] as const;
export const stripAim=[0,1.15,-.35] as const;
export const stripY=2.71,stripZ=.42;
const railX=[-2.04,-.13,1.79] as const;
export const stripX=(state:VelvetLightState)=>railX[state.rail];
let current:VelvetLightState={rail:0,power:1};
const listeners=new Set<()=>void>();
export const getVelvetLight=()=>current;
export function subscribeVelvetLight(listener:()=>void){listeners.add(listener);return ()=>{listeners.delete(listener);};}
export type StripControl='rail'|'power';
export function advanceVelvetLight(control:StripControl){
  current={...current,[control]:(current[control]+1)%3};
  listeners.forEach(fn=>fn());
}
export function resolveVelvetLight(base:StageLighting,state:VelvetLightState):StageLighting{
  // StageRoom aims its shared directional light at the world origin. Use the
  // *fixture-to-subject direction*, not the position or a second PMX-only sun.
  return {...base,sunPos:[stripX(state)-stripAim[0],stripY-stripAim[1],stripZ-stripAim[2]],
    ambient:base.ambient*.84,hemi:base.hemi*1.18,sun:base.sun*power[state.power]};
}
