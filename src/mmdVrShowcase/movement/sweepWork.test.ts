import {expect,it} from 'vitest';
import {observePlanet,planetCounters,samplePlanetMovement} from './planetDiagnostics';
import {discardSweepWork,finishSweepFrame,recordShellSweep,takeSweepWork} from './sweepWork';

it('exports only this visible window’s sweep peaks, independent of a retired planet driver',()=>{
  const retire=observePlanet(planetCounters());recordShellSweep(199,'salt');finishSweepFrame();
  const stop=observePlanet(planetCounters());try{retire();recordShellSweep(60,'tide');recordShellSweep(68,'glaze');finishSweepFrame();recordShellSweep(90,'home');finishSweepFrame();
    expect(samplePlanetMovement()).not.toHaveProperty('shellWork'); // an observer may peek without consuming the recorder's counters
    expect(samplePlanetMovement(takeSweepWork())?.shellWork).toEqual({sweeps:3,evaluations:218,maxFrame:128,maxSweep:90,peakWorld:'home'});
    expect(takeSweepWork()).toBeUndefined();recordShellSweep(27,'home');discardSweepWork();expect(takeSweepWork()).toBeUndefined();
  }finally{stop();}recordShellSweep(300,'home');expect(samplePlanetMovement()).toBeUndefined();
});
