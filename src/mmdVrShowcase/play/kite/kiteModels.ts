import { BufferGeometry, Color, Float32BufferAttribute, Vector3 } from 'three';

type Point = [number, number, number];
const lerp = (a: Point, b: Point, t: number): Point => [a[0]+(b[0]-a[0])*t, a[1]+(b[1]-a[1])*t, a[2]+(b[2]-a[2])*t];

// One faceted, vertex-painted mesh per moving part. The bamboo, lashings and
// paper share a material and need no textures, lights or transparent overlays.
function craft() {
  const positions: number[] = [], colors: number[] = [], c = new Color();
  function tri(a: Point, b: Point, d: Point, tint: string) {
    positions.push(...a, ...b, ...d); c.set(tint);
    for (let i = 0; i < 3; i++) colors.push(c.r, c.g, c.b);
  }
  function quad(a: Point, b: Point, c: Point, d: Point, tint: string) { tri(a,b,c,tint); tri(a,c,d,tint); }
  function rod(a: Point, b: Point, r: number, end: number, tint: string, sides = 8) {
    const axis = new Vector3(b[0]-a[0], b[1]-a[1], b[2]-a[2]).normalize();
    const u = axis.clone().cross(Math.abs(axis.y) < .85 ? new Vector3(0,1,0) : new Vector3(1,0,0)).normalize();
    const v = axis.clone().cross(u);
    const ring = (at: Point, rad: number, i: number): Point => {
      const t = 2*Math.PI*i/sides, x = rad*Math.cos(t), y = rad*Math.sin(t);
      return [at[0]+x*u.x+y*v.x, at[1]+x*u.y+y*v.y, at[2]+x*u.z+y*v.z];
    };
    for (let i=0; i<sides; i++) {
      const p = ring(a,r,i), q = ring(a,r,i+1), s = ring(b,end,i), t = ring(b,end,i+1);
      quad(p,q,t,s,tint); tri(q,p,a,tint); tri(s,t,b,tint);
    }
  }
  function finish() {
    const g = new BufferGeometry();
    g.setAttribute('position', new Float32BufferAttribute(positions,3));
    g.setAttribute('color', new Float32BufferAttribute(colors,3));
    g.computeVertexNormals(); g.computeBoundingSphere(); return g;
  }
  return { tri, quad, rod, finish };
}

export const GUIDE: Point = [0,.159,-.039];
export function makeReel() {
  const m = craft(), bamboo = '#dfa959', bindings = '#245965', y = .089;
  // Hollow hexagonal flanges like two bamboo wagon wheels, and a lacquered
  // offset crank. Keep the part actually in the palm at the standard toy grip.
  m.rod([0,-.076,.014],[0,.048,0],.015,.02,bamboo);
  for (const h of [-.065,-.056,.031]) m.rod([0,h,.007-h*.10],[0,h+.006,.007-h*.10],.02,.02,bindings);
  for (const sign of [-1,1]) {
    const x = sign*.043, rim = (i: number): Point => [x, y+.056*Math.cos(i*Math.PI/3), .056*Math.sin(i*Math.PI/3)];
    m.rod([0,.034,0],[x,y,0],.007,.006,'#906439');
    for (let i=0; i<6; i++) {
      m.rod(rim(i),rim(i+1),.006,.006,bamboo,6);
      if (i%2===0) m.rod([x,y,0],rim(i),.005,.004,'#ca994f',6);
    }
  }
  m.rod([-.055,y,0],[.058,y,0],.009,.009,'#995b39');
  m.rod([-.036,y,0],[.036,y,0],.039,.039,'#e1d2a7',14);
  // Ridged thread with an indigo leader: discrete bindings, merged in this draw.
  for (let i=0; i<13; i++) {
    const x = -.034+i*.0054; m.rod([x,y,0],[x+.002,y,0],.041,.041,i>=10?'#486b71':'#fff0c5',14);
  }
  m.rod([.058,y,0],[.058,y-.027,.019],.004,.005,bindings);
  m.rod([.058,y-.027,.019],[.078,y-.027,.019],.006,.007,bamboo);
  const [x,h,z] = GUIDE;
  m.rod([0,y+.017,-.02],[x,h-.009,z],.005,.003,bindings);
  const hoop = (i: number): Point => [x+.009*Math.cos(i*Math.PI/4), h+.009*Math.sin(i*Math.PI/4), z];
  for (let i=0; i<8; i++) m.rod(hoop(i),hoop(i+1),.0022,.0022,'#b5793b',5);
  return m.finish();
}

export function makeSwallow() {
  const m = craft();
  const beak: Point = [0,.32,.005], chest: Point = [0,.047,.085], belly: Point = [0,-.20,.008];
  for (const side of [-1,1]) {
    const p = (x:number,y:number,z:number):Point => [side*x,y,z];
    const cheek = p(.092,.115,.032), hip = p(.116,-.11,.021), fork = p(.195,-.358,-.023);
    m.tri(beak,cheek,chest,'#ce5544'); m.tri(chest,cheek,hip,'#ffe7a9');
    m.tri(chest,hip,belly,'#dfac5b'); m.tri(belly,hip,fork,'#304f61');
    m.tri(hip,lerp(belly,fork,.39),lerp(belly,fork,.60),'#eb9e62');
    // Sewn cross-sections. Narrow outer cells sweep back and become the
    // swallow's pointed primaries; the stripe is cut into the paper itself.
    const sections = [
      [cheek,hip], [p(.198,.175,.002),p(.183,-.092,.002)],
      [p(.36,.215,-.025),p(.31,-.145,-.045)],
      [p(.515,.238,-.028),p(.435,-.069,-.053)],
      [p(.601,.252,-.039),p(.585,.187,-.046)],
    ];
    const palette = ['#294f63','#ecae62','#ffdec0','#378081','#215969'];
    for (let i=0;i<sections.length-1;i++) {
      const [a,b] = sections[i], [c,d] = sections[i+1];
      const bands = [0,.12,.26,.37,.76,1], next = [0,.12,.26,.37,.76,1];
      if (i%2) {bands[2] = .32; bands[3] = .49;} else {next[2] = .32; next[3] = .49;}
      for (let j=0;j<5;j++) m.quad(lerp(a,b,bands[j]),lerp(c,d,next[j]),lerp(c,d,next[j+1]),lerp(a,b,bands[j+1]),i===2&&j===3?'#4d9792':palette[j]);
    }
    // Bowed spars and a small raised central bridle. The cord terminates at
    // (0,0,0); all the paper sits slightly behind that knot in the assembly.
    m.rod([0,.094,-.009],p(.36,.144,-.041),.005,.004,'#bb884d',6);
    m.rod(p(.36,.144,-.041),p(.596,.245,-.044),.004,.002,'#c99c68',6);
    m.rod(p(.092,.115,.032),[0,0,.149],.002,.002,'#c1a77f',5);
  }
  m.rod(belly,[0,0,.149],.002,.002,'#c1a77f',5);
  return m.finish();
}

/** A cut strip of paper with knots and two folded tail bows. */
export function makeStreamer() {
  const m = craft();
  const path: Point[] = [[0,0,0],[.022,-.067,-.011],[.011,-.143,-.034],[.053,-.207,-.045],[.078,-.291,-.018],[.065,-.376,-.044]];
  for (let i=1;i<path.length;i++) {
    const a=path[i-1], b=path[i], edge = ([x,y,z]:Point):Point=>[x+.011,y,z+.003];
    m.quad(a,edge(a),edge(b),b,i%2?'#cf7052':'#e6a267');
    if (i===2||i===4) {
      const [x,y,z] = b;
      m.tri(b,[x-.045,y+.028,z-.011],[x-.036,y-.018,z+.01],'#ebbd77');
      m.tri(b,[x+.045,y-.029,z-.009],[x+.037,y+.018,z+.011],'#cb6552');
    }
  }
  return m.finish();
}
