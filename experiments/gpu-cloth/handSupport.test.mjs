import assert from 'node:assert/strict';
import test from 'node:test';
import {BufferGeometry,Float32BufferAttribute,Uint16BufferAttribute,Vector3} from 'three';
import {GRIP_RADIUS,gripMotion} from './handMotion.js';
import {makeHandSamples} from './handSamples.js';

test('a stationary solver frame retains both grips; losing one on a zero-step frame breaks only its sweep',()=>{
  const m=gripMotion(),frame=new Float32Array(16),a=new Vector3(-.12,.65,.2),b=new Vector3(.12,.67,.2);
  m.observe([a,b]);m.write(frame,0,1,false);assert.deepEqual([frame[3],frame[11]],[0,0]);m.commit();
  a.y+=.12;b.y+=.06;m.observe([a,b]);m.write(frame,0,2,false);
  assert.deepEqual([frame[3],frame[11]],[1,1]);assert.ok(Math.abs(frame[5]-.71)<1e-6);
  m.write(frame,1,2,false);assert.ok(Math.abs(frame[1]-.71)<1e-6&&Math.abs(frame[5]-.77)<1e-6);m.commit();
  m.observe([new Vector3(0,-100,0),b]); // no solve, then new source inside the cloth
  const replacement=new Vector3(-.11,.82,.2);b.y+=.021;m.observe([replacement,b]);m.write(frame,0,1,false);
  assert.equal(frame[3],0);assert.equal(frame[1],frame[5]);assert.equal(frame[11],1);assert.ok(Math.abs(frame[13]-frame[9]-.021)<1e-6);m.commit();
  m.observe([null,b]);m.write(frame,0,1,false);assert.equal(frame[7],0);assert.equal(frame[11],1);
  b.x+=.51;m.observe([null,b]);m.write(frame,0,1,false);assert.equal(frame[11],0);assert.equal(frame[8],frame[12]);
});

test('real panel interior between distant nodes maps force to both mobile corners, with no bridge across an authored gap',()=>{
  // The same three bone weights need not imply that two disconnected faces
  // cover the space between them. Corner zero is attached to a pinned node.
  const g=new BufferGeometry(),corners=[-.18,.8,0,.18,.8,0,0,.55,0];
  g.setAttribute('position',new Float32BufferAttribute([...corners,...corners.map((x,i)=>i%3===2?x+.3:x)],3));
  g.setAttribute('skinIndex',new Uint16BufferAttribute([0,1,2,0,1,2].flatMap(x=>[x,0,0,0]),4));
  g.setAttribute('skinWeight',new Float32BufferAttribute(Array.from({length:6},()=>[1,0,0,0]).flat(),4));
  g.setIndex([0,1,2,3,4,5]);g.addGroup(0,6,0);
  const rig={scale:1,byBone:new Map([[0,0],[1,1],[2,2]]),nodes:[{pin:true},{pin:false},{pin:false}]};
  const {faces,ranges,refs}=makeHandSamples({geometry:g,material:{visible:true,opacity:1}},rig);
  assert.ok(faces.every(f=>f.z<1e-6||f.z>.299));assert.equal(ranges[1],0);
  const centre=new Vector3(0,.715,0);assert.ok([0,3,6].every(i=>centre.distanceTo(new Vector3().fromArray(corners,i))>GRIP_RADIUS));
  const samples=faces.flatMap((s,i)=>centre.distanceTo(s)<.024?[i]:[]);assert.ok(samples.length);
  for(const i of [1,2]){const links=refs.subarray(2*ranges[i*2],2*(ranges[i*2]+ranges[i*2+1]));
    assert.ok(links.some((id,j)=>j%2===0&&samples.includes(id)&&links[j+1]>.2));}
});
