import {expect,it} from 'vitest';
import {Vector3} from 'three';
import {capEdge,lanternCanopyBlocks,lanternCanPlant,lanternCentre,lanternCup,lanternGround,lanternPoint,lanternRadius,
  lanternSeedPosition,lanternSeedStart,lanternStation,lanternTrail,lanternTrees,lanternTrunkBlocks} from './lanternBiosphere';
import {clearingDeck,clearingRadius} from './lanternClearing';

it('keeps a standing corridor from the north collar to the west jump print, including the receiving pad',()=>{
  const n=new Vector3(),p=new Vector3();
  for(let i=0;i<=40;i++)for(const side of [-.40,0,.40]){
    const theta=Math.PI*.5*i/40;n.set(-Math.sin(theta),Math.cos(theta),side/lanternRadius).normalize();
    const ground=lanternPoint(n);expect(lanternTrunkBlocks(ground,.19,2)).toBe(false);
    for(let h=.3;h<=2.001;h+=.1)expect(lanternCanopyBlocks(p.copy(ground).addScaledVector(n,h))).toBe(false);
    expect(lanternCanPlant(n,.02)).toBe(false);
  }
  for(let i=0;i<16;i++){const a=Math.PI*i/8,d=1.05/lanternRadius;n.set(-Math.cos(d),Math.sin(d)*Math.cos(a),Math.sin(d)*Math.sin(a));
    expect(lanternGround(n.x,n.y,n.z)).toBeCloseTo(0,7);expect(lanternCanPlant(n,0)).toBe(false);}
});

it('leaves the upright performers’ deck and winding nursery path free while the stalks and the actual roofs occlude',()=>{
  for(let i=0;i<=24;i++){
    const a=i*Math.PI/12,r=i===24?0:clearingRadius;
    const p=new Vector3(clearingDeck.x+r*Math.cos(a),clearingDeck.y,clearingDeck.z+r*Math.sin(a));
    expect(lanternCanPlant(p.clone().sub(lanternCentre).normalize(),.03)).toBe(false);
    expect(lanternTrunkBlocks(p,.19,2)).toBe(false);
    for(let j=0;j<12;j++){expect(lanternCanopyBlocks(p)).toBe(false);p.y+=.18;}
  }
  for(let i=1;i<lanternTrail.length;i++)for(let j=0;j<=8;j++){
    const t=j/8,[ax,az]=lanternTrail[i-1],[bx,bz]=lanternTrail[i];
    const x=ax*(1-t)+bx*t,z=az*(1-t)+bz*t,n=new Vector3(x,Math.sqrt(lanternRadius**2-x*x-z*z),z).normalize();
    expect(lanternTrunkBlocks(lanternPoint(n),.48,1.95)).toBe(false);
  }
  for(const s of lanternTrees){expect(lanternTrunkBlocks(s.base.clone().add(lanternCentre),.12,1.7)).toBe(true);
    const roof=capEdge(s,.21,.69).add(lanternCentre);
    expect(lanternCanopyBlocks(roof)).toBe(true);
    expect(lanternCanopyBlocks(roof.addScaledVector(s.up,.35))).toBe(false);}
});

it('carries seed from a living cap into the station cup without touching the pole or crossing the actor platform',()=>{
  const p=new Vector3(),n=new Vector3();
  for(let lane=0;lane<8;lane++){
    expect(lanternSeedPosition(0,lane,p).distanceTo(lanternSeedStart)).toBeLessThan(.001);
    expect(lanternSeedPosition(1,lane,p).distanceTo(lanternCup)).toBeLessThan(.001);
    for(let i=0;i<=32;i++){
      lanternSeedPosition(i/32,lane,p);n.copy(p).normalize();
      expect(p.length()-lanternRadius-lanternGround(n.x,n.y,n.z)).toBeGreaterThan(.35);
      expect(Math.hypot(p.x,p.z)).toBeGreaterThan(1.12);
      expect(Math.hypot(p.x-clearingDeck.x+lanternCentre.x,p.z-clearingDeck.z+lanternCentre.z)).toBeGreaterThan(clearingRadius+.20);
    }
  }
  expect(lanternCup.clone().normalize().distanceTo(lanternStation)).toBeLessThan(.001);
});
