import {Vector3} from 'three';
import {expect,it} from 'vitest';
import {surveySites} from '../scenery/planet/opalSurvey';
import {clearingDeck,clearingRadius,onClearing} from '../scenery/planet/lanternClearing';
import {PAD_RADIUS,planetPlace} from '../scenery/planet/planetLayout';
import {windFloor,windTerminals,type WindTerminal} from '../scenery/planet/windTerminalLayout';
import {planetSight} from '../scenery/planet/planetSightline';
import {departureAt} from '../scenery/planet/windAtlas';
import {moonWalk} from './moonWalk';
import {fixtureBodyBlocked} from './planetFixtures';
import {createTraveller,surfaceStep,transport} from './planetTravel';
import {altitude,homeWorld,shellRadius} from './orbitalSurfaces';
import {jumpVelocity,startOrbit,stepOrbit} from './orbitalFlight';

function at(site:WindTerminal,x:number,z:number){
  const p=new Vector3(x,0,z).applyQuaternion(site.rotation).add(site.base);
  return p.addScaledVector(site.port.up,windFloor(site.lane,site.back,p));
}

it('slides off the tilted tops and falls to actual ground instead of hovering on the cases',()=>{
  const cases=[...windTerminals.map(t=>({id:`${t.world}/${t.lane.moon.id}`,world:t.back?t.lane.moon:homeWorld,face:t.face,base:t.base})),
    ...Object.entries(surveySites).map(([id,s])=>({id,world:homeWorld,face:s.lens,base:s.lens}))];
  for(const {id,world,face,base} of cases)for(const dt of [1/72,.05]){
    const up=base.clone().sub(world.centre).normalize(),eye=up.clone().multiplyScalar(1.65);
    const f=startOrbit(world,face.clone().addScaledVector(up,.85),new Vector3());
    for(let t=0;t<5&&!f.landing;t+=dt){
      const prev=f.foot.clone();stepOrbit(f,dt,up,eye);
      expect(f.foot.distanceTo(prev),id).toBeLessThan(5*dt);
      expect(fixtureBodyBlocked(world.id,f.foot,up,eye,.16),id).toBe(false);
    }
    expect(f.landing?.id,`${id} at dt=${dt}; altitude ${altitude(world,f.foot).toFixed(3)} m`).toBe(world.id);
    expect(Math.abs(altitude(world,f.point)),id).toBeLessThan(.001);
  }
});
const empty=()=>{};
for(const back of [false,true]){
  const site=windTerminals.find(t=>t.back===back&&t.lane.moon.id==='ember')!,world=back?site.lane.moon:homeWorld;
  it(`${world.id}: the walking motor stops on either face but can sprint past the cabinet's side`,()=>{
    for(const startSide of [-1,1])for(const clear of [false,true]){
      const x=clear?1.04:0,s=createTraveller(),dir=new Vector3(),eye=new Vector3(),goal=at(site,x,-startSide*.9);
      s.foot.copy(at(site,x,startSide*.9));transport(s,world.centre);
      for(let i=0;i<20&&s.foot.distanceTo(goal)>.06;i++){
        dir.subVectors(goal,s.foot);const speed=Math.min(8,dir.length()/.05);dir.projectOnPlane(s.up).normalize();eye.copy(s.up).multiplyScalar(1.65);
        if(back)moonWalk(site.lane.moon,s,dir,speed,.05,false,shellRadius,eye);
        else surfaceStep(s,dir,speed,.05,false,empty,1.745,eye);
        expect(fixtureBodyBlocked(world.id,s.foot,s.up,eye.copy(s.up).multiplyScalar(1.65),back?.19:.22)).toBe(false);
      }
      if(clear)expect(s.foot.distanceTo(goal)).toBeLessThan(.07);
      else {
        const z=s.foot.clone().sub(site.base).dot(site.front)*startSide;
        expect(z).toBeGreaterThan(.12);expect(z).toBeLessThan(.76);
      }
    }
    expect(departureAt(site.port.foot,back?site.lane.moon:null)).toBe(site.lane);
  });
  it(`${world.id}: an ordinary hop hits the mounted panel, loses forward travel and returns to ground`,()=>{
    const foot=at(site,0,-.72),up=foot.clone().sub(world.centre).normalize(),eye=up.clone().multiplyScalar(1.60);
    const dir=site.front.clone().projectOnPlane(up).normalize(),f=startOrbit(world,foot,jumpVelocity(world,up,dir,2.4,new Vector3()));
    let peak=0,front=-Infinity;
    for(let i=0;i<280&&!f.landing;i++){
      stepOrbit(f,1/72,up,eye);peak=Math.max(peak,f.foot.clone().sub(foot).dot(up));
      front=Math.max(front,f.foot.clone().sub(site.base).dot(site.front));
      expect(fixtureBodyBlocked(world.id,f.foot,up,eye,.16)).toBe(false);
    }
    expect(peak).toBeGreaterThan(.06);expect(front).toBeLessThan(-.13);expect(f.landing).toBe(world);
  });
}

it('a backpack ray to the landing stops on the north compass glass; the same landing is visible from the side or in front',()=>{
  const dial=surveySites.dial,end=new Vector3(0,.012,0),through=dial.lens.clone().sub(end).normalize();
  const eye=dial.lens.clone().addScaledVector(through,1.0);
  expect(planetSight(eye,0,0,0)).toBe(false);
  expect(planetSight(dial.lens.clone().addScaledVector(through,-.35),0,0,0)).toBe(true);
  eye.add(new Vector3(1.5,0,0).applyQuaternion(dial.q));expect(planetSight(eye,0,0,0)).toBe(true);
});

it.each([false,true])('a backpack ray to the north deck clips the intervening Ember board (on moon: %s)',back=>{
  const site=windTerminals.find(t=>t.back===back&&t.lane.moon.id==='ember')!,end=new Vector3(0,.012,0);
  const delta=site.face.clone().sub(end).normalize(),eye=site.face.clone().addScaledVector(delta,.45);
  expect(planetSight(eye,0,0,0)).toBe(false);
  expect(planetSight(site.face.clone().addScaledVector(delta,-.24),0,0,0)).toBe(true);
  expect(planetSight(eye.add(new Vector3(1.4,0,0).applyQuaternion(site.rotation)),0,0,0)).toBe(true);
});

it('retains both actor placement areas, including their rims beside the consoles',()=>{
  const decks=[['home',0,0,0,PAD_RADIUS,planetPlace],
    ['lantern',clearingDeck.x,clearingDeck.y,clearingDeck.z,clearingRadius,onClearing]] as const;
  const foot=new Vector3(),up=new Vector3(0,1,0),eye=new Vector3(0,1.75,0);
  for(const [world,x,y,z,r,place] of decks)for(let i=0;i<=80;i++)for(let j=0;j<120;j++){
    const a=j*Math.PI/60,d=r*i/80;foot.set(x+d*Math.cos(a),y,z+d*Math.sin(a));
    if(place(foot.x,foot.z)&&fixtureBodyBlocked(world,foot,up,eye,.22))throw new Error(`${world} actor obstructed at ${foot.toArray()}`);
  }
});
