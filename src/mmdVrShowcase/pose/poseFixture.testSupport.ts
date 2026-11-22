/** Synthetic PMX 2.0 / VMD: articulated actor, native leg IK, append-driven
 * sleeve, grouped bone morph, wrist-weighted triangle and two Bullet bodies. */
export function poseFixture(partial = false) {
  const enc = new TextEncoder(), bytes: number[] = [], scratch = new DataView(new ArrayBuffer(4));
  const u8 = (v: number) => { bytes.push(v & 255); };
  const u16 = (v: number) => { u8(v); u8(v >> 8); };
  const i32 = (v: number) => { u16(v); u16(v >> 16); };
  const vec = (...ns: number[]) => ns.forEach(n => { scratch.setFloat32(0, n, true); bytes.push(...new Uint8Array(scratch.buffer)); });
  const str = (s: string) => { const a = enc.encode(s); i32(a.length); bytes.push(...a); };
  const fixed = (s: string, n: number) => { const a = new Uint8Array(n); a.set(enc.encode(s)); bytes.push(...a); };
  type Joint = [string, number, number, number, number]; // name, rest XYZ, parent
  const joints: Joint[] = [['Pelvis', 0, 1, 0, -1], ['Spine', 0, 1.2, 0, 0], ['Neck', 0, 1.55, 0, 1], ['Head', 0, 1.72, 0, 2]];
  for (const side of ['Left', 'Right']) {
    const sign = side === 'Left' ? 1 : -1, i = joints.length;
    joints.push([side+'Arm', sign*.18, 1.48, 0, 1], [side+'Elbow', sign*.48, 1.46, .025, i],
      [side+'Hand', sign*.78, 1.46, 0, partial ? -1 : i+1], [side+'Index1', sign*.87, 1.46, 0, i+2],
      [side+'Thigh', sign*.12, .98, 0, 0], [side+'Knee', sign*.12, .51, -.025, i+4], [side+'Foot', sign*.12, .04, 0, i+5]);
  }
  joints.push(['Sleeve', -.32, 1.4, 0, 11], ['Cloth', -.32, 1.18, 0, 18], ['LegGoal', .12, .10, -.09, -1]);
  fixed('PMX ',4); vec(2); bytes.push(8,1,0,1,1,1,1,1,1); str('Actor'); str('Actor'); str(''); str('');
  i32(3); for (const x of [-.77,-.8,-.83]) { vec(x,1.45,-.05, 0,0,-1, 0,0); u8(0); u8(13); vec(1); }
  i32(3); bytes.push(0,1,2); i32(0); i32(1); str('sleeve'); str('sleeve');
  vec(.6,.6,.7,1, 0,0,0, 1, .3,.3,.3); u8(1); vec(0,0,0,1,0); bytes.push(255,255,0,1,0); str(''); i32(3);
  i32(joints.length);
  joints.forEach(([name,x,y,z,parent], i) => {
    str(name); str(name); vec(x,y,z); u8(parent); i32(i >= 18 ? 1 : 0);
    u16(0x1e | (i === 18 ? 0x100 : i === 20 ? 0x20 : 0)); vec(0,.05,0);
    if (i === 18) { u8(11); vec(.6); }
    if (i === 20) { u8(10); i32(20); vec(.22); i32(2); u8(9); u8(0); u8(8); u8(0); }
  });
  i32(2);
  str('WristMorph'); str('WristMorph'); u8(4); u8(2); i32(1); u8(13); vec(0,.016,.01, Math.sin(.13),0,0,Math.cos(.13));
  str('Gesture'); str('Expression'); u8(4); u8(0); i32(1); u8(0); vec(.7);
  i32(0); i32(2);
  for (const [i,name,x,y,b] of [[13,'cuff',-.78,1.46,0],[19,'hem',-.32,1.18,1]] as const) {
    str(name); str(name); u8(i); u8(0); u16(0); u8(0); vec(.04,.04,.04, x,y,0, 0,0,0, b, .05,.1,0,.5); u8(b);
  }
  i32(0); const pmx = Uint8Array.from(bytes); bytes.length = 0;
  fixed('Vocaloid Motion Data 0002',30); fixed('Actor',20);
  i32(6);
  for (const [name,frame,x,y,z,angle] of [
    ['Pelvis',0,0,0,0,0], ['Pelvis',60,.18,.07,.04,.2], ['RightArm',0,0,0,0,-.12], ['RightArm',60,0,0,0,.55],
    ['RightHand',0,0,0,0,.05], ['RightHand',60,0,0,0,.28],
  ] as const) {
    fixed(name,15); i32(frame); vec(x,y,z, 0,0,Math.sin(angle/2),Math.cos(angle/2));
    for(let j=0;j<64;j++) u8(j%16<8?20:107);
  }
  i32(2); for(const [frame,w] of [[0,.12],[60,.83]]) { fixed('Gesture',15); i32(frame); vec(w); }
  for(let j=0;j<4;j++) i32(0);
  return { pmx, vmd: Uint8Array.from(bytes) };
}
