import {Vector3} from 'three';
import {expect,it,vi} from 'vitest';
import {createShellSweep,shellRadius,walkWorlds,type World} from './orbitalSurfaces';
import {recordShellSweep} from './sweepWork';

vi.mock('./sweepWork',()=>({recordShellSweep:vi.fn()}));
// Tide has no cached SphereGeometry facets. On a miss, every tide radius
// read here is one true altitude evaluation (including recursive midpoints).
const reads=vi.hoisted(()=>({tide:0}));
vi.mock('../scenery/planet/moonSurface',async importOriginal=>{
  const m=await importOriginal<typeof import('../scenery/planet/moonSurface')>();
  return {...m,moonRadius:(...args:Parameters<typeof m.moonRadius>)=>{
    if(args[0].relief==='tide')reads.tide++;return m.moonRadius(...args);
  }};
});

const north=new Vector3(0,1,0),sulfur=walkWorlds.find(w=>w.id==='sulfur')!,tide=walkWorlds.find(w=>w.id==='tide')!;
const crown=(w:World)=>w.centre.clone().addScaledVector(north,shellRadius(w,0,1,0));

it('includes the real unclamped tracked head, the offset column and the independent motor sole',()=>{
  const sweep=createShellSweep(),top=crown(sulfur),down=north.clone().negate(),d=new Vector3(0,-.08,0);
  const foot=top.clone().add(new Vector3(6,4.745,0)),eye=new Vector3(-6,-4.6,0);
  const head=sweep(foot,d,down,eye,4.6);
  expect(head).toMatchObject({world:sulfur,part:'head',tracked:true});expect(head!.t).toBeCloseTo(.375,2);
  // Same mutable arguments, now a short upright stance. The tracked foot
  // reaches the rock but the motor foot stays six metres off to the side.
  foot.copy(top).add(new Vector3(6,.035,0));eye.set(-6,.8,0);
  const tracked=sweep(foot,d,north,eye,.8);
  expect(tracked).toMatchObject({world:sulfur,part:'foot',tracked:true});
  foot.x-=6;eye.x=6;
  expect(sweep(foot,d,north,eye,.8)).toMatchObject({world:sulfur,part:'foot',tracked:false});
});

it('counts real terrain reads; only the same flight reuses an exactly repeated endpoint',()=>{
  const a=createShellSweep(),b=createShellSweep(),foot=crown(tide).addScaledVector(north,.26);
  const d=new Vector3(0,-.01,0),eye=new Vector3(0,1.75,0);
  function miss(sweep:typeof a,height=1.75){
    reads.tide=0;vi.mocked(recordShellSweep).mockClear();
    expect(sweep(foot,d,north,eye,height)).toBeNull();
    expect(vi.mocked(recordShellSweep).mock.calls).toEqual([[reads.tide,'tide']]);return reads.tide;
  }
  miss(a);foot.add(d);const cold=miss(b),warm=miss(a);
  expect(warm).toBeLessThan(cold);
  foot.add(d);eye.x=.27;eye.y=1.09;const changed=miss(a,1.09);
  expect(changed).toBeGreaterThan(0);expect(changed).toBeLessThanOrEqual(miss(createShellSweep(),1.09));
  const p=foot.clone();foot.set(211,200,300);
  expect(a(foot,d,north,eye,1.09)).toBeNull();expect(recordShellSweep).toHaveBeenLastCalledWith(0,null);
  foot.copy(p).add(d);expect(miss(a,1.09)).toBe(miss(createShellSweep(),1.09));
  expect(a(foot,d.clone().setScalar(0),north,eye)).toBeNull();expect(recordShellSweep).toHaveBeenLastCalledWith(0,null);
});

it('uses the current head radius when a height change puts the crown at an old body sample',()=>{
  const sweep=createShellSweep(),up=north.clone().negate(),short=.15+9*.15625,tall=short+.15625;
  const foot=crown(sulfur).addScaledVector(north,short+.12),eye=up.clone().multiplyScalar(tall),outward=north.clone().multiplyScalar(1/64);
  // Face down: the future head position starts within the old 15 cm body
  // radius and moves outwards. Shortening by one section keeps its position.
  expect(sweep(foot,outward,up,eye,tall)).toBeNull();foot.add(outward);eye.copy(up).multiplyScalar(short);
  const inward=north.clone().multiplyScalar(-.04),hit=sweep(foot,inward,up,eye,short);
  expect(hit).toMatchObject({world:sulfur,part:'head',tracked:true});
  expect(hit!.t).toBeCloseTo((.12+1/64-.115)/.04,2);
  expect(hit!.t).toBe(createShellSweep()(foot,inward,up,eye,short)!.t);
});
