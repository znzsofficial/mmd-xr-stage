import {Vector3} from 'three';
import {amberMoon,moons} from './windAtlas';
import {moonRadius} from './moonSurface';
import {leapRoutes,twinPad,type LeapRoute} from './leapAtlas';

type Point=[number,number,number];
export const twinSurveys=moons.flatMap(moon=>{
  const pad=twinPad(moon);if(!pad)return [];
  const salt=moon.id==='salt',up=new Vector3(0,1,0);
  const station=moon.station,approach=up.clone().addScaledVector(station.up,-station.up.y).normalize();
  const lateral=new Vector3().crossVectors(approach,station.up);
  const eyeUp=station.up.clone().multiplyScalar(moon.radius).addScaledVector(approach,2.4).addScaledVector(lateral,.95).normalize();
  return [{moon,pad,portrait:{key:salt?'saltPortrait' as const:'glazePortrait' as const,
    eye:eyeUp.clone().multiplyScalar(moonRadius(moon,eyeUp.x,eyeUp.y,eyeUp.z)+1.16).add(moon.centre).toArray() as Point,
    aim:station.base.clone().addScaledVector(station.up,.61).toArray() as Point,up:eyeUp.toArray() as Point},
    leapView:{key:salt?'saltLeap' as const:'glazeLeap' as const,
    // A level screen camera looks obliquely through the gap, rather than
    // looking straight into the opposite ground. The XR frame follows the foot.
    eye:pad.foot.clone().addScaledVector(pad.up,1.65).toArray() as Point,
    aim:pad.foot.clone().addScaledVector(pad.up,9.65).addScaledVector(up,.25).add(new Vector3(0,0,-1.8)).toArray() as Point}}];
});

// Frame the strait from the sunward side; its composition follows the pair if
// the system is moved to clear an existing portrait of the distant sky.
const mid=twinSurveys[0].moon.centre.clone().lerp(twinSurveys[1].moon.centre,.5);
export const straitPortrait={key:'twinPortrait' as const,eye:mid.clone().add(new Vector3(-.4,3.7,17.6)).toArray() as Point,aim:mid.toArray() as Point};

// A close look at the sunward fern window, rather than the opposing planet
// seen from the jump mark. This is an inspection shot, not a new jump route.
const fossilUp=new Vector3(-.2,.88,-.51).normalize(),fossilSide=new Vector3(.4,.2,.8).projectOnPlane(fossilUp).normalize();
const fossil=amberMoon.centre.clone().addScaledVector(fossilUp,moonRadius(amberMoon,fossilUp.x,fossilUp.y,fossilUp.z));
export const amberPortrait={key:'amberFossil' as const,eye:fossil.clone().addScaledVector(fossilUp,1.7).addScaledVector(fossilSide,-1.50).toArray() as Point,
  aim:fossil.toArray() as Point,up:fossilUp.toArray() as Point};

function steppingView<K extends string>(key:K,route:LeapRoute){
  const {pad,sight,crest}=route,eye=pad.foot.clone().addScaledVector(pad.up,1.65);
  return {key,eye:eye.toArray() as Point,aim:eye.clone().addScaledVector(pad.up,8).addScaledVector(crest,.25).addScaledVector(sight,1.8).toArray() as Point};
}
const viewTo=(from:LeapRoute['pad']['id'],to:LeapRoute['target']['id'])=>leapRoutes.find(r=>r.pad.id===from&&r.target.id===to)!;
export const steppingViews=[steppingView('glazeMicaLeap',viewTo('glaze','mica')),steppingView('micaSulfurLeap',viewTo('mica','sulfur')),
  steppingView('sulfurMicaLeap',viewTo('sulfur','mica')),steppingView('micaGlazeLeap',viewTo('mica','glaze')),
  steppingView('lanternAmberLeap',viewTo('lantern','amber')),steppingView('amberLanternLeap',viewTo('amber','lantern'))] as const;
