import {expect,it} from 'vitest';
import {PerspectiveCamera,Vector3} from 'three';
import {
  WEDDING_ANCHORS as pieces,WEDDING_DOORS as doors,WEDDING_ENTRY,WEDDING_MARKS as marks,WEDDING_SHOTS,WEDDING_VIEW,
  weddingClear as clear,weddingVisible as visible,weddingSightline as sight,moveInWedding as move,
} from './weddingLayout';

type Point={x:number;z:number};
type XYZ=readonly [number,number,number];
const point=([x,y,z]:XYZ)=>({x,y,z});
const shot=(key:(typeof WEDDING_SHOTS)[number]['key'])=>WEDDING_SHOTS.find(s=>s.key===key)!;
const place=(x:number,z:number)=>clear(x,z,true);

it('walks from the lane through the gate, past the banquets, across the hall and into the side room, then back out',()=>{
  let p:Point=WEDDING_ENTRY;
  function walk(x:number,z:number){
    p=move(p.x,p.z,x-p.x,z-p.z);
    expect(p.x).toBeCloseTo(x,5);expect(p.z).toBeCloseTo(z,5);
  }
  const tour=(key:Parameters<typeof shot>[0])=>{const [x,,z]=shot(key).eye;walk(x,z);};
  walk(WEDDING_VIEW[0][0],WEDDING_VIEW[0][2]);walk(WEDDING_ENTRY.x,WEDDING_ENTRY.z);
  walk(0,8.48);walk(marks.sedan.x,marks.sedan.z);walk(0,8.48);walk(0,6);walk(0,4.04);tour('weddingGate');
  walk(0,3.68);walk(0,-1.27);tour('weddingFeast');walk(0,-1.27);tour('weddingHall');
  for(const {x,z} of marks.pair)walk(x,z);
  walk(4,-4.98);tour('weddingReturn');walk(5.3,-4.8);walk(6.3,-4.8);tour('weddingFromRoom');tour('weddingVanity');
  walk(marks.vanity.x,marks.vanity.z);walk(7.58,-4.8);walk(5.3,-4.8);walk(4,-4.8);walk(4,-1.27);
  walk(0,-1.27);walk(0,7.3);walk(WEDDING_ENTRY.x,WEDDING_ENTRY.z);
});

it('keeps the full gate crest, both eaves, the sedan and its poles in the default desktop picture',()=>{
  const [eye,aim]=WEDDING_VIEW,camera=new PerspectiveCamera(50,1.65,.03,100);
  camera.position.set(...eye);camera.lookAt(...aim);camera.updateMatrixWorld();
  const {x,z}=pieces.sedan;
  for(const p of [[-2.53,3.94,6.92],[2.53,3.94,6.92],[-2.53,3.94,5.08],[2.53,3.94,5.08],
    [-2.24,4.55,6],[2.24,4.55,6],[0,3.06,6.16],[x,2.21,z],[x,0,z],
    ...[-.7,.7].flatMap(u=>[-1.8,1.8].map(v=>[x+u,.64,z+v]))]){
    const pt=new Vector3().fromArray(p).project(camera);
    expect(Math.max(Math.abs(pt.x),Math.abs(pt.y))).toBeLessThan(.96);expect(Math.abs(pt.z)).toBeLessThan(1);
  }
});

it('protects a 3 × 2 m double-portrait floor, the centre aisle and near-furniture actor marks',()=>{
  const r=marks.pairFloor;
  expect([r.w,r.d]).toEqual([3,2]);
  for(let dz=-1;dz<=1;dz+=.125)for(let dx=-1.5;dx<=1.5;dx+=.125)expect(place(r.x+dx,r.z+dz)).toBe(true);
  for(let z=-4;z<=10;z+=.10)for(const x of [-.75,0,.75])expect(place(x,z)).toBe(true);
  for(const {x,z} of [marks.sedan,marks.vanity,{x:0,z:0}])expect(place(x,z)).toBe(true);
  for(const [x,z] of [[-2.9,10.22],[-2.2,6.81],[-3.5,.35],[4.14,.99],[0,-6.95],[-2,-6.95],[2,-6.95],[8.65,-6.95],
    [-2.4,4.4],[8.1,-3.48],[1.64,5.52],[6.57,-3.855],[2.9,-3.4],[-5.12,.10],[5.8,0],[8.5,-2.2],[7,6.5],[0,13.2],[NaN,0],[0,Infinity]]){
    expect(place(x,z)).toBe(false);expect(clear(x,z)).toBe(false);
  }
  // The diagonal gap outside a round banquet is real, not an enclosing square.
  expect(place(3.5+1.04,.35+1.04)).toBe(true);
});

it('cannot tunnel through the courtyard walls, parked gate leaf, poles, table or side screen on a long frame',()=>{
  for(const [x,z,dx,dz,axis,bound] of [
    [2.4,8,0,-7,'z',6],[-4.8,7.10,4.5,0,'x',-3.6],[-1.95,.35,-4,0,'x',-2.4],
    [.2,5.39,3.2,0,'x',1.6],[8.1,-2.77,0,-3.8,'z',-3.48],[4.1,-6.20,4.5,0,'x',5.8],
  ] as const){
    const q=move(x,z,dx,dz);
    if((axis==='z'?dz:dx)<0)expect(q[axis]).toBeGreaterThan(bound);else expect(q[axis]).toBeLessThan(bound);
    expect(clear(q.x,q.z)).toBe(true);
  }
  const slide=move(5.26,-5.84,1.12,-.52);
  expect(slide.x).toBeLessThan(5.53);expect(slide.z).toBeCloseTo(-6.36);
  expect(move(0,0,NaN,1)).toEqual({x:0,z:0});expect(move(Infinity,0,0,1)).toEqual(WEDDING_ENTRY);
});

it('rejects a valid landing hidden by a wall, open leaf, lintel, pillar or screen; the open corridor sees the same floor',()=>{
  const cases: {target:Point;hidden:XYZ;open:XYZ}[]=[
    {target:{x:0,z:7.1},hidden:[-4.3,1.58,4.8],open:[0,1.58,4.8]},
    {target:{x:7.80,z:-4.8},hidden:[4.70,1.5,-7.3],open:[4.7,1.5,-4.8]},
    {target:{x:7.10,z:-3.16},hidden:[7.10,1.48,-4.45],open:[6.24,1.48,-3.18]},
    {target:{x:-2.4,z:5.14},hidden:[-2.40,1.58,3.67],open:[-3.16,1.5,5.12]},
    {target:{x:8.10,z:-3.04},hidden:[8.10,1.55,-4.06],open:[8.96,1.55,-3.04]},
    {target:{x:3.62,z:-4.12},hidden:[2.18,1.55,-2.68],open:[3.62,1.55,-2.68]},
    {target:{x:0,z:8.2},hidden:[0,3.68,5.84],open:[0,1.55,5.84]},
  ];
  for(const {target:{x,z},hidden,open} of cases){
    expect(place(x,z)).toBe(true);expect(visible(point(hidden),x,z)).toBe(false);expect(visible(point(open),x,z)).toBe(true);
  }
  for(const d of [doors.gate,doors.dressing])expect(clear(d.x,d.z)).toBe(true);
  expect(visible({x:0,y:0,z:0},0,2)).toBe(false);expect(visible({x:0,y:1,z:NaN},0,0)).toBe(false);
});

it('checks height against an individual carrying pole, stool and mirror instead of treating the furniture envelopes as walls',()=>{
  // Crossing the two slender poles (away from the cabin). The far ground is not under the sedan.
  expect(place(-1.66,7.02)).toBe(true);
  expect(visible({x:-4.2,y:.83,z:7.02},-1.66,7.02)).toBe(false);
  expect(visible({x:-4.2,y:1.65,z:7.02},-1.66,7.02)).toBe(true);
  const f=pieces.feasts[1],u=.9/Math.sqrt(2),stool={x:f.x+u,z:f.z+u};
  for(const [y,canSee] of [[.40,false],[.48,true]] as const){
    expect(sight({x:stool.x+.25,y,z:stool.z},{x:stool.x-.20,y,z:stool.z})).toBe(canSee);
  }
  for(const [x,canSee] of [[8.68,false],[8.99,true]] as const){
    expect(sight({x,y:1.16,z:-6.42},{x,y:1.16,z:-7.55})).toBe(canSee);
  }
});

it('blocks the outer edge of the tread and the two transverse pole ties without filling the open space below',()=>{
  const {x,z}=pieces.sedan;
  const across=(u:number,y:number,za:number,zb:number)=>sight({x:x+u,y,z:z+za},{x:x+u,y,z:z+zb});
  for(const s of [-1,1]){
    expect(across(s*.409,.21,-.92,-.595)).toBe(false);  // outside the old 66 cm step
    expect(across(s*.405,.14,-.92,-.595)).toBe(false);  // two short bearers, not a solid riser
    expect(across(0,.14,-.92,-.595)).toBe(true);
    expect(across(.613,.719,s*.46-.12,s*.46+.12)).toBe(false);
    expect(across(.613,.757,s*.46-.12,s*.46+.12)).toBe(true);
  }
});

// Project the eight corners of each grey standing volume at the screen tour's
// actual 50° lens. Check depth, frame borders, body-to-body separation AND
// physical sightlines: two in-frame boxes behind a front post aren't a shot.
function actorFrame(key:Parameters<typeof shot>[0],aspect:number,foot:Point,height:number){
  const {eye,aim}=shot(key),camera=new PerspectiveCamera(50,aspect,.03,100);
  camera.position.fromArray(eye);camera.lookAt(aim[0],aim[1],aim[2]);camera.updateMatrixWorld();
  const corners=[];
  for(const dx of [-.28,.28])for(const dz of [-.16,.16])for(const y of [.012,height]){
    const p=new Vector3(foot.x+dx,y,foot.z+dz);
    expect(sight(camera.position,p)).toBe(true);
    p.project(camera);expect(p.z).toBeGreaterThan(-1);expect(p.z).toBeLessThan(1);
    corners.push(p);
  }
  return {left:Math.min(...corners.map(p=>p.x)),right:Math.max(...corners.map(p=>p.x)),
    bottom:Math.min(...corners.map(p=>p.y)),top:Math.max(...corners.map(p=>p.y))};
}

it.each(['weddingFeast','weddingHall'] as const)('%s frames both complete grey actors in landscape and portrait',key=>{
  for(const aspect of [16/9,9/16]){
    const pair=marks.pair.map((foot,i)=>actorFrame(key,aspect,foot,[1.68,1.83][i]));
    for(const b of pair){
      expect(b.left).toBeGreaterThan(-.90);expect(b.right).toBeLessThan(.90);
      expect(b.bottom).toBeGreaterThan(-.90);expect(b.top).toBeLessThan(.90);
      expect((b.top-b.bottom)/2).toBeGreaterThan(.32);
    }
    expect(pair[1].left-pair[0].right).toBeGreaterThan(.075);
  }
});

it('frames the procession from the open gate and from inside the eastern hall; the west gate jamb crops the outer poles in the distant shot',()=>{
  const {x,z}=pieces.sedan;
  for(const key of ['weddingGate','weddingReturn'] as const){
    const eye=point(shot(key).eye);
    const looksAt=(dx:number,y:number,dz:number)=>sight(eye,{x:x+dx,y,z:z+dz});
    // Samples just outside the visible timber/fringe surface, not inside a solid.
    for(const dz of [-.48,-.25,0,.25,.48])for(const y of [.36,1.42,1.72])expect(looksAt(.533,y,dz)).toBe(true);
    for(const dx of [.23,.32,.46])expect(looksAt(dx,1.15,-.572)).toBe(true);
    expect(looksAt(0,2.18,-.102)).toBe(true);
    for(const aspect of [16/9,9/16]){
      const b=actorFrame(key,aspect,marks.sedan,1.83);
      expect(Math.max(-b.left,b.right,-b.bottom,b.top)).toBeLessThan(.93);
    }
    // The closer shot clears the west jamb across the full curtain width and the east pole tip.
    expect(looksAt(-.52,1.2,-.572)).toBe(key==='weddingGate');
    expect(looksAt(.70,.64,-1.802)).toBe(key==='weddingGate');
  }
  for(const p of marks.pair)expect(visible(point(shot('weddingFromRoom').eye),p.x,p.z)).toBe(true);
  expect(visible(point(shot('weddingVanity').eye),marks.vanity.x,marks.vanity.z)).toBe(true);
});
