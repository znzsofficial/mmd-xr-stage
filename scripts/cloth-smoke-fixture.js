// Generated in memory only. One skirt panel skinned to an animated waist and
// a solver-owned hem; a translation-limited joint attaches them in Bullet.
export function clothSmokeFixture() {
  const encoder = new TextEncoder();
  let bytes = [];
  const u8 = v => bytes.push(v & 255);
  function num(v, method, size) { const a = new Uint8Array(size); new DataView(a.buffer)[method](0, v, true); bytes.push(...a); }
  const i32 = n => num(n, 'setInt32', 4), u16 = n => num(n, 'setUint16', 2), f = n => num(n, 'setFloat32', 4);
  const vec = (...ns) => ns.forEach(f);
  function str(s) { const a = encoder.encode(s); i32(a.length); bytes.push(...a); }
  function fixed(s, n) { const a = new Uint8Array(n); a.set(encoder.encode(s)); bytes.push(...a); }
  fixed('PMX ', 4); f(2); bytes.push(8,1,0,1,1,1,1,1,1);
  str('skirt'); str('skirt'); str('Generated cloth regression'); str('');
  i32(4);
  for (const [x,y,b] of [[-.1,1,0],[.1,1,0],[-.17,.65,1],[.17,.65,1]]) {
    vec(x,y,0, 0,0,-1, 0,0); u8(0); u8(b); f(1);
  }
  i32(6); bytes.push(0,1,2,2,1,3); i32(0); i32(1);
  str('cloth'); str('cloth'); vec(.4,.4,.8,1, 0,0,0, 1, .3,.3,.3); u8(1); vec(0,0,0,1,0);
  bytes.push(255,255,0,1,0); str(''); i32(6);
  i32(2);
  for(const [name,y,parent] of [['waist',1,-1],['hem',.65,0]]) {
    str(name);str(name);vec(0,y,0);u8(parent);i32(0);u16(0x1e);vec(0,-.35,0);
  }
  i32(0);i32(0);i32(2);
  for(const [name,y,b] of [['waist',1,0],['hem',.65,1]]) {
    str(name);str(name);u8(b);u8(0);u16(0);u8(0);vec(.12,.12,.12, 0,y,0, 0,0,0, b, .18,.2,0,.5);u8(b);
  }
  i32(1);str('seam');str('seam');u8(0);u8(0);u8(1);
  vec(0,.8,0, 0,0,0, 0,-.27,0, 0,.27,0, 0,0,0, 0,0,0, 0,0,0, 0,0,0);
  const pmx = new File([Uint8Array.from(bytes)], 'skirt.pmx'); bytes=[];
  fixed('Vocaloid Motion Data 0002',30);fixed('skirt',20);i32(2);
  for(const [frame,x] of [[0,0],[60,.16]]) {
    fixed('waist',15);i32(frame);vec(x,0,0, 0,0,0,1);
    for(let i=0;i<64;i++)u8(i%16<8?20:107);
  }
  for(let i=0;i<5;i++)i32(0);
  return { pmx, vmd:new File([Uint8Array.from(bytes)],'waist-motion.vmd') };
}
