import {Vector3} from 'three';
import {expect,it} from 'vitest';
import {courseUp,courseDistance} from './opalCourse';
import {stations,stationBlocks,crustRadius,makeCrust} from './opalTerrain';
import {PAD_RADIUS,PLANET_RADIUS as R} from './planetLayout';
import {blankSurvey,lampSpectrum,opalSurveyShots,surveyRelease,surveySight,surveySites} from './opalSurvey';

it('walks the painted line past both readers and between the existing solids to the back beacon',()=>{
  const near={dial:Infinity,aqua:Infinity,coral:Infinity,beacon:Infinity};
  for(let i=0;i<720;i++){
    const up=courseUp(i*Math.PI/720),foot=up.clone().multiplyScalar(crustRadius(up.x,up.y,up.z));foot.y-=R;
    expect(Math.abs(courseDistance(up.x,up.y,up.z))).toBeLessThan(1e-5);
    expect(stationBlocks(foot,.26,1.65)).toBe(false);
    for(const site of ['dial','aqua','coral'] as const)near[site]=Math.min(near[site],foot.distanceTo(surveySites[site].lens));
    near.beacon=Math.min(near.beacon,foot.distanceTo(stations.find(s=>s.style==='beacon')!.base));
  }
  expect(Math.max(near.dial,near.aqua,near.coral)).toBeLessThan(1.35);
  expect(near.beacon).toBeLessThan(2);
  const visible=makeCrust(),solid=makeCrust(false);
  try{expect(Buffer.from(visible.attributes.position.array.buffer as ArrayBuffer).equals(Buffer.from(solid.attributes.position.array.buffer as ArrayBuffer))).toBe(true);}
  finally{visible.dispose();solid.dispose();}
});
it('has reachable finite rays for all three views but cannot read through a cluster, through rock, or across the planet',()=>{
  for(const [i,name] of (['dial','aqua','coral'] as const).entries()){
    const s=surveySites[name],eye=new Vector3(...opalSurveyShots[i].eye);
    expect(surveySight(eye,s.lens)).toBe(true);
    expect(surveySight(s.lens.clone().addScaledVector(s.up,4.25),s.lens)).toBe(false);
    expect(surveySight(s.base.clone().addScaledVector(s.up,-.38),s.lens)).toBe(false);
    if(name!=='dial')expect(surveySight(s.lens.clone().addScaledVector(s.front,-2.6),s.lens)).toBe(false);
  }
  // Dock plate and its hit area stay outside the allowed actor circle even at the inner corners.
  const dock=surveySites.dial;
  expect(Math.hypot(dock.lens.x,dock.lens.z)-.26*Math.abs(Math.cos(dock.tilt))).toBeGreaterThan(PAD_RADIUS-.22);
});
it('captures only aligned cuts, displays either single colour or both only on docking, and removes them when lifted',()=>{
  let s=blankSurvey;
  const tap=(p:'dial'|'aqua'|'coral',n=1)=>{while(n--)s=surveyRelease(s,p);};
  tap('aqua',5);expect(s).toBe(blankSurvey);
  for(const place of ['aqua','coral'] as const){
    tap('dial');const steps=place==='aqua'?2:4;
    tap(place,steps-1);expect(s.samples).toBe(0);tap(place);const got=s;tap(place);expect(s).toBe(got);
    expect(lampSpectrum(s)).toBe(0);tap('dial');expect(lampSpectrum(s)).toBe(place==='aqua'?1:2);
  }
  tap('dial');expect(s.samples).toBe(0);expect(lampSpectrum(s)).toBe(0);
  tap('coral',4);tap('aqua',4);expect(s.samples).toBe(3);tap('dial');expect(lampSpectrum(s)).toBe(3);
  tap('dial');tap('dial');expect(s).toEqual(blankSurvey);
});
