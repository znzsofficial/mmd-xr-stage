import { describe, expect, it } from 'vitest';
import { Vector3 } from 'three';
import { defaultPelvicCalibration } from './contract';
import { pelvicCenterline } from './path';
import { canalPlot, outletObservation, sectionEvidence, sectionLayout, sectionYaw } from './sectionProjection';
import {exteriorLens} from './atlas/vulvaSurface';
import type { PelvicProfile, PelvicSample } from './stateTypes';

const length=.092,radius=.024;
const profile:PelvicProfile={calibration:defaultPelvicCalibration,container:'fantasyUterine',fluid:{vaginal:3,fantasyUterine:2},
  capacity:{vaginal:12,fantasyUterine:5},overflow:.8,drained:1.1,showAdapter:false,clothingClear:true,speedHz:.65,stroke:1};
const sample:PelvicSample={tip:[.008,.003,-.033],tail:[-.017,-.005,.121],shaft:[[-.017,-.005,.121],[.001,.002,.04],[.007,.003,-.031]],
  depth:.033,angleDeg:12.7,lengthM:length,radiusM:radius,outletInside:true,outletVisible:false,aligned:true,atCervix:false};
const view=(angle?:Parameters<typeof sectionLayout>[2])=>sectionLayout(length,radius,angle);

describe('socket-local metre projection',()=>{
  it('recovers the true 3-D displacement between two off-axis measured points using the orthogonal views',()=>{
    const f=view('front'),s=view(),fp=f.project(...sample.tip),ft=f.project(...sample.tail),sp=s.project(...sample.tip),st=s.project(...sample.tail);
    const distance=new Vector3(...sample.tip).distanceTo(new Vector3(...sample.tail));
    expect(f.pxPerM).toBe(s.pxPerM);expect(fp.y-ft.y).toBeCloseTo(sp.y-st.y,12);
    expect(Math.hypot(fp.x-ft.x,sp.x-st.x,fp.y-ft.y)/f.pxPerM).toBeCloseTo(distance,12);
    expect((fp.x-ft.x)/f.pxPerM).toBeCloseTo(sample.tip[0]-sample.tail[0],12);
    expect(s.project(.087,0,0).x).toBeCloseTo(s.entry.x,12);
    for(const a of [-.57,.017,sectionYaw.oblique,.661,1.94,Math.PI]){
      const v=view(a),p=v.project(...sample.tip),q=v.project(...sample.tail);
      expect(p.x-q.x).toBeCloseTo(Math.cos(a)*(fp.x-ft.x)+Math.sin(a)*(sp.x-st.x),10);
      expect(v.pxPerM).toBe(s.pxPerM);
    }
    expect(view('oblique').project(...sample.tip)).toEqual(view(.66).project(...sample.tip));
    expect(s.project(...sample.tip)).toEqual(view(Math.PI/2).project(...sample.tip));
  });

  it('locates the illustrated entry and stop on the actual calibrated arc; the distal tissue joins there at every yaw',()=>{
    for(const [l,r] of [[length,radius],[.035,.008],[.20,.08]])for(const yaw of [0,.66,Math.PI/2,Math.PI,4.66]){
      const v=sectionLayout(l,r,yaw),stop=pelvicCenterline({lengthM:l},l);
      expect(v.entry).toEqual(v.canal[0].center);expect(v.stop).toEqual(v.project(stop.x,stop.y,stop.z));
      expect(v.stop).toEqual(v.canal.at(-1)!.center);expect(v.stop).toEqual(v.cervix[0].center);
      for(const side of [-1,1]){
        expect(v.canal.at(-1)!.at(side,0)).toEqual(v.cervix[0].at(side,0));
        const a=v.cervix.at(-1)!.at(side,0),b=v.uterus[0].at(side,0);
        expect(a.x).toBeCloseTo(b.x,12);expect(a.y).toBeCloseTo(b.y,12);
      }
    }
    const width=(v:ReturnType<typeof view>)=>Math.max(...v.uterus.map(r=>{const a=r.at(1,0),b=r.at(-1,0);return Math.hypot(a.x-b.x,a.y-b.y);}));
    expect(width(view('front'))).toBeGreaterThan(1.7*width(view('side')));
    const ovaries=(v:ReturnType<typeof view>)=>Math.abs(v.adnexa[0].at.x-v.adnexa[1].at.x);
    expect(ovaries(view('front'))).toBeGreaterThan(80);expect(ovaries(view('side'))).toBeLessThan(.001);
  });

  it('turns the same nozzle and mould independently, keeping both fluid planes, readouts and ledger fixed',()=>{
    const before=JSON.stringify([sample,profile]),vs=[view('front'),view('side'),view(.66),view(2.16)];
    const levels=vs.map(v=>[v.levelY('canal',.25),v.levelY('uterus',.40)]);
    for(const [i,v] of vs.entries()){
      const e=sectionEvidence(v,profile,sample);
      expect(e).toMatchObject({state:'inside',depth:.033,lateral:.008,angle:12.7,vaginal:.25,uterine:.4});
      expect(e.tip).toEqual(v.project(...sample.tip));expect(e.shaft).toEqual(sample.shaft!.map(p=>v.project(...p)));
      expect(e.tip).not.toEqual(e.shaft.at(-1));expect(levels[i]).toEqual(levels[0]);
    }
    expect(sectionEvidence(vs[0],{...profile,container:'vaginal'},sample)).toMatchObject({uterine:0,vaginal:.25});
    expect(JSON.stringify([sample,profile])).toBe(before);
  });

  it('never reconstructs a shaft from the depth slider, endpoint pair or reacquired nozzle beyond the stop',()=>{
    const v=view('front'),lost=sectionEvidence(v,profile,null);
    expect(lost).toMatchObject({state:'absent',tip:null,shaft:[],depth:null});
    const unknown={...sample,outletInside:false,atCervix:true,depth:length,tip:[.006,.028,-.119] as const};
    const unverified=sectionEvidence(v,profile,unknown);
    expect(unverified).toMatchObject({state:'unverified',tip:v.project(...unknown.tip),shaft:[],atCervix:true});
    expect(unverified.tip).not.toEqual(v.stop);
    const outside=sectionEvidence(v,profile,{...sample,outletInside:false,outletVisible:true,tip:[.02,.003,.011],shaft:undefined});
    expect(outside).toMatchObject({state:'outside',tip:v.project(.02,.003,.011),shaft:[]});
  });

  it('registers both close-ups at the same physical opening; a turn changes their bearing, never a crossing',()=>{
    for(const yaw of [0,.66,Math.PI/2,-Math.PI/2]){
      const v=sectionLayout(length,radius,yaw,true),face=exteriorLens(yaw,radius),center=face(0,0,0),x=face(radius,0,0),z=face(0,0,radius);
      const front=exteriorLens(0,radius);
      expect(Math.hypot(x.x-center.x,z.x-center.x)).toBeCloseTo(front(radius,0,0).x-front(0,0,0).x);
      expect(v.canal[0].center).toEqual(v.project(0,0,0));expect(v.stop).toEqual(v.cervix[0].center);
      expect(v.stop.y).toBeGreaterThan(canalPlot.top);expect(v.entry.y).toBeLessThan(canalPlot.bottom);
      const parked=sectionEvidence(v,profile,sample,true);expect(parked).toMatchObject({state:'parked',tip:v.project(...sample.tip),shaft:sample.shaft!.map(p=>v.project(...p)),depth:null,atCervix:false});
    }
    const unknown={...sample,outletInside:false,outletVisible:false,depth:0};
    expect(outletObservation(null)).toBe('waiting');expect(outletObservation(unknown)).toBe('unknown');
    expect(outletObservation({...unknown,tip:[0,0,-.17]})).toBe('past');
    expect(outletObservation({...unknown,tip:[.055,0,-.01]})).toBe('offset');
    expect(outletObservation({...unknown,tip:[0,0,0]})).toBe('plane');
    expect(outletObservation({...unknown,tip:[0,0,.002],outletVisible:true})).toBe('approach');
    expect(outletObservation({...unknown,tip:[0,0,.02],exteriorCovered:true})).toBe('coveredOutside');
    expect(outletObservation({...unknown,tip:[0,0,.002],outletVisible:true,aligned:false})).toBe('outsideOffset');
  });
});
