import {BoxGeometry,Mesh,MeshBasicMaterial,Vector3} from 'three';
import {expect,it} from 'vitest';
import {altitude,homeWorld,shellRadius,walkWorlds} from './orbitalSurfaces';
import {startJump,startOrbit,stepOrbit} from './orbitalFlight';
import {createSolidColumns} from './solidColumns';
import type {ReadColumn} from './groundMotor';

const v=(x:number,y:number,z:number)=>new Vector3(x,y,z);
const moon=(id:string)=>walkWorlds.find(w=>w.id===id)!;
const rates=[[20],[36],[72],[90],[120],[144],[20,144,90,36,72,120]];

it('Lantern → Amber: the same off-mark launch clears the slope twice and escapes at six rates and an uneven cadence',()=>{
  const from=moon('lantern'),to=moon('amber'),foot=v(-35.948484,16.812050,9.942410),velocity=v(-5.343272,.844261,-.138435);
  const up=foot.clone().sub(from.centre).normalize(),eye=up.clone().multiplyScalar(1.65),probe=new Vector3();
  let reference:{foot:Vector3;velocity:Vector3}|undefined;
  for(const rate of rates){
    const f=startOrbit(from,foot,velocity);let time=0,clear=0,minGap=Infinity;
    for(let i=0;time<12-1e-10;i++){
      const dt=Math.min(12-time,1/rate[i%rate.length]),before=f.grazes;
      stepOrbit(f,dt,up,eye);time+=dt;
      const gap=altitude(to,probe.copy(f.foot).add(eye))-.115;
      minGap=Math.min(minGap,gap);if(f.grazes===1)clear=Math.max(clear,gap);
      if(f.grazes>before){
        // Independently differentiate clearance along the outgoing HEAD path.
        expect(altitude(to,probe.clone().addScaledVector(f.velocity,.0001))).toBeGreaterThan(gap+.115);
      }
    }
    expect(f.grazes).toBe(2);expect(clear).toBeGreaterThan(.08);expect(minGap).toBeGreaterThan(-.0002);
    expect(f.landing).toBeNull();expect(f.owner).toBeNull();expect(f.velocity.length()).toBeGreaterThan(2);
    if(reference){expect(f.foot.distanceTo(reference.foot)).toBeLessThan(1e-6);expect(f.velocity.distanceTo(reference.velocity)).toBeLessThan(1e-6);}
    else reference={foot:f.foot.clone(),velocity:f.velocity.clone()};
  }
  // Replay the actual thumbstick launch too. The head reaches the other
  // shell without a landing: a footfall or a change of well is too late to
  // choose the takeoff frame. Keep the recorded velocity above as a control.
  const stick=v(-.349687,.726560,.591464).projectOnPlane(up).normalize(),flight=startJump(from,foot,up,stick,2.4);
  expect(flight.velocity.distanceTo(velocity)).toBeLessThan(.000002);
  let minHead=Infinity,minSole=Infinity;
  for(let i=0;i<12*72;i++){
    stepOrbit(flight,1/72,up,eye,undefined,1.65,()=>{throw Error('transported an off-mark transfer');});
    minHead=Math.min(minHead,altitude(to,probe.copy(flight.foot).add(eye)));minSole=Math.min(minSole,altitude(to,flight.foot));
  }
  expect(minHead).toBeGreaterThan(.1148);expect(minSole).toBeGreaterThan(0);expect(flight.grazes).toBe(2);
  expect(flight.landing).toBeNull();expect(flight.owner).toBeNull();expect(flight.foot.distanceTo(reference!.foot)).toBeLessThan(.0002);
});

it('a continuous skim over the ridged Glaze relief keeps tangent momentum; an overlapping flight gets its own first impact',()=>{
  const w=moon('glaze'),p=v(9.874295513809045,24.928643394078133,-27.670172723412033),speed=v(4.438150327055921,-.1584047820048724,-1.8351374878987707);
  const up=p.clone().sub(w.centre).normalize(),eye=up.clone().multiplyScalar(1.65),f=startOrbit(w,p,speed),sweep=f.sweep;
  let contacts=0;f.sweep=(...args)=>{const hit=sweep(...args);if(hit)contacts++;return hit;};
  // Start B on the same slope after A is already in contact, and interleave.
  for(let i=0;i<28;i++)stepOrbit(f,1/120,up,eye);
  const next=startOrbit(w,p,speed);
  for(let i=0;i<40;i++){stepOrbit(f,1/120,up,eye);stepOrbit(next,1/120,up,eye);}
  expect(contacts).toBeGreaterThan(5);expect(f.grazes).toBe(1);expect(next.grazes).toBe(1);
  expect(next.velocity.length()).toBeGreaterThan(4.35);expect(next.foot.distanceTo(p)).toBeGreaterThan(1.5);
  expect(f.landing).toBeNull();expect(next.landing).toBeNull();
});

it('a changed head pose between two fractions of a chord can avoid or make the impending head-first landing',()=>{
  const w=moon('amber'),up=v(0,-1,0),p=w.centre.clone().add(v(0,shellRadius(w,0,1,0)+1.65+.115+.003,0));
  for(const avoid of [true,false]){
    const f=startOrbit(w,p,v(0,-1,0)),eye=up.clone().multiplyScalar(avoid?1.65:.90);
    expect(stepOrbit(f,.001,up,eye)).toBe(false);
    eye.copy(up).multiplyScalar(avoid?.90:1.65);
    expect(stepOrbit(f,.006,up,eye)).toBe(!avoid);
    if(!avoid){expect(f.part).toBe('head');expect(f.landing).toBe(w);expect(altitude(w,f.point)).toBeCloseTo(0,6);}
  }
});

// Mesh dimensions in world metres. Use the real imported-solid triangle
// query; a lookup by centre alone misses its step and vertical-span rules.
function withBoxes(boxes:number[][],run:(read:ReadColumn)=>void){
  const cols=createSolidColumns(),mat=new MeshBasicMaterial();
  const roots=boxes.map(([x,y,width,height])=>{const mesh=new Mesh(new BoxGeometry(width,height,1.4),mat);mesh.position.set(x,y,1.9);return mesh;});
  try{run((x,z,y,c)=>cols.sample(roots,x,z,y,c));}finally{cols.invalidate();roots.forEach(m=>m.geometry.dispose());mat.dispose();}
}

it('north pad: a 6 cm roof belongs to the tracked eye column and floor support stays with the actual motor sole',()=>{
  const up=v(0,1,0);
  for(const [eyeX,roofX,plinthX] of [[0,0,3],[.50,.50,3],[.50,0,3],[.50,.50,0],[.50,.50,.50]]){
    const seated=plinthX===0,underRoof=eyeX===roofX;
    withBoxes([[roofX,2.08,.26,.06],[plinthX,.14,.26,.28]],read=>{
      for(const rate of rates){
        const f=startOrbit(homeWorld,v(0,seated?.28:0,1.9),v(0,1.9,0)),eye=v(eyeX,1.65,0);let peak=-Infinity;
        for(let i=0;i<500&&!f.landing;i++){
          stepOrbit(f,1/rate[i%rate.length],up,eye,read,1.65);peak=Math.max(peak,f.foot.y+eye.y);
        }
        if(underRoof){expect(peak).toBeLessThanOrEqual(2.05-.115+1e-6);expect(peak).toBeGreaterThan(1.93);}
        else expect(peak).toBeGreaterThan(2.30); // a roof over the empty tracking origin cannot catch this head
        expect(f.landing).toBe(homeWorld);expect(f.point.y).toBeCloseTo(seated?.28:0,6);expect(f.velocity.lengthSq()).toBe(0);
      }
    });
  }
});

it('a real 0.50 m lean into a panel moves the eyes immediately; refusal of further virtual ascent does not push them back',()=>{
  withBoxes([[.5,1.81,.26,.06]],read=>{
    const up=v(0,1,0),eye=v(0,1.65,0),f=startOrbit(homeWorld,v(0,0,1.9),v(0,1.9,0));
    stepOrbit(f,.09,up,eye,read);const foot=f.foot.clone(),oldEye=foot.clone().add(eye);eye.x=.5;
    stepOrbit(f,0,up,eye,read);expect(f.foot.equals(foot)).toBe(true);
    const leaned=f.foot.clone().add(eye);expect(leaned.distanceTo(oldEye)).toBe(.5);
    expect(leaned.y).toBeGreaterThan(1.78);expect(leaned.y).toBeLessThan(1.84);
    stepOrbit(f,.001,up,eye,read);expect(f.foot.x).toBe(foot.x);expect(f.foot.y).toBe(foot.y);
    expect(f.velocity.y).toBe(0);expect(eye.equals(v(.5,1.65,0))).toBe(true);
  });
});

it('an airborne virtual strafe into the side of that same thin panel stops the offset head',()=>{
  withBoxes([[.8,2.08,.10,.06]],read=>{
    const up=v(0,1,0),eye=v(.5,1.65,0),f=startOrbit(homeWorld,v(0,.43,1.9),v(2.4,-.015,0));
    for(let i=0;i<8;i++)stepOrbit(f,1/120,up,eye,read);
    expect(f.foot.x).toBeGreaterThan(.06);expect(f.foot.x+eye.x).toBeLessThan(.8-.05-.15);
    expect(f.velocity.x).toBeLessThan(.04);expect(f.foot.y).toBeLessThan(.43);
  });
});
