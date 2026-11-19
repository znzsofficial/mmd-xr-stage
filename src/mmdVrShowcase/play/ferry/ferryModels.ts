import { BoxGeometry, BufferGeometry, Color, CylinderGeometry, Float32BufferAttribute, TorusGeometry } from 'three';
import { GATE_RADIUS, GATE_Y, WATER_Y, type FerrySide } from './voyage';

type Point = [number, number, number];
const cream = '#fff0cc', teal = '#296c70', coral = '#ce644b', navy = '#254953', brass = '#c29b55';

// One opaque draw per model: enamel bands, glazing and timber are painted into the mesh.
class Model {
  private positions: number[] = [];
  private colors: number[] = [];
  private tint = new Color();
  tri(a: Point, b: Point, c: Point, ink: string) {
    this.positions.push(...a, ...b, ...c);
    const {r,g,b: blue} = this.tint.set(ink);
    for (let i=0;i<3;i++) this.colors.push(r,g,blue);
  }
  quad(a:Point,b:Point,c:Point,d:Point,ink:string) { this.tri(a,b,c,ink); this.tri(a,c,d,ink); }
  add(g: BufferGeometry, ink: string) {
    const p=g.getAttribute('position'), ix=g.getIndex(), tint=this.tint.set(ink);
    for (let j=0, n=ix?.count ?? p.count;j<n;j++) {
      const i=ix ? ix.getX(j) : j;
      this.positions.push(p.getX(i),p.getY(i),p.getZ(i)); this.colors.push(tint.r,tint.g,tint.b);
    }
    g.dispose();
  }
  box(x:number,y:number,z:number,w:number,h:number,d:number,ink:string) {
    this.add(new BoxGeometry(w,h,d).translate(x,y,z),ink);
  }
  drum(x:number,y:number,z:number,rTop:number,rBase:number,h:number,ink:string,stretchZ=1) {
    this.add(new CylinderGeometry(rTop,rBase,h,16).scale(1,1,stretchZ).translate(x,y,z),ink);
  }
  finish() {
    const g=new BufferGeometry();
    g.setAttribute('position',new Float32BufferAttribute(this.positions,3));
    g.setAttribute('color',new Float32BufferAttribute(this.colors,3)); g.computeVertexNormals(); return g;
  }
}

/** Paired buoy-mounted hoops. Local origin is the point one aims the controller at. */
export function makeGate(side: FerrySide) {
  const m=new Model(), paint=side==='left' ? coral : teal, water=WATER_Y-GATE_Y;
  for (const x of [-GATE_RADIUS, GATE_RADIUS]) {
    m.drum(x,water+.01,0,.144,.098,.13,paint,1.75);
    m.drum(x,water+.092,0,.10,.139,.035,cream,1.72);
    m.drum(x,water/2,0,.056,.056,-water,paint);
    for (const y of [water+.20,-.13]) m.drum(x,y,0,.058,.058,.084,cream);
    m.drum(x,0,0,.068,.068,.049,brass);
  }
  // Narrow porcelain index marks flank the brass keystone; the open centre stays clear.
  for (let i=0;i<24;i++) {
    const arc=new TorusGeometry(GATE_RADIUS,.057,8,2,Math.PI/24).rotateZ(Math.PI*i/24);
    m.add(arc, i===11||i===12 ? brass : [3,4,8,15,19,20].includes(i) ? cream : paint);
  }
  return m.finish();
}

/** Lofted launch hull, a glazed wheelhouse and an open passenger deck under a striped canvas roof. */
export function makeBoat() {
  const m=new Model();
  // Stations from square transom to raked stem: x, sheer half-beam, sheer height above the water.
  const ribs=[[-.70,.155,.17],[-.55,.24,.15],[-.20,.277,.137],[.21,.272,.14],[.46,.214,.168],[.63,.13,.202],[.76,.009,.25]];
  const levels=[[.60,-.22],[.94,-.096],[.98,-.065],[1,-.030],[1,0]];
  const strakes=[teal, cream, '#477e80', brass];
  const chine=(i:number,l:number,s:number):Point=>[ribs[i][0], ribs[i][2]+levels[l][1], s*ribs[i][1]*levels[l][0]];
  for(let i=0;i<ribs.length-1;i++) {
    for(let l=0;l<4;l++) for(const s of [-1,1]) {
      const a=chine(i,l,s),b=chine(i+1,l,s),c=chine(i+1,l+1,s),d=chine(i,l+1,s);
      if(s>0)m.quad(a,b,c,d,strakes[l]); else m.quad(d,c,b,a,strakes[l]);
    }
    m.quad(chine(i,4,1),chine(i+1,4,1),chine(i+1,4,-1),chine(i,4,-1),'#c79e69');
    m.quad(chine(i,0,-1),chine(i+1,0,-1),chine(i+1,0,1),chine(i,0,1),teal);
  }
  for(let l=0;l<4;l++) {
    m.quad(chine(0,l,-1),chine(0,l,1),chine(0,l+1,1),chine(0,l+1,-1),strakes[l]);
    const n=ribs.length-1;
    m.quad(chine(n,l,1),chine(n,l,-1),chine(n,l+1,-1),chine(n,l+1,1),strakes[l]);
  }
  // Cabin coaming and blue-green windows, inlaid on both sides and the windscreen.
  m.box(.145,.30,0,.39,.35,.34,cream);
  for(const s of [-1,1]) for(const x of [.045,.226]) m.box(x,.367,s*.172,.142,.113,.008,'#426a70');
  for(const z of [-.078,.078]) m.box(.342,.367,z,.008,.113,.124,'#426a70');
  for(const x of [-.46,-.24]) {m.box(x,.19,0,.066,.096,.31,'#a36d47');m.box(x,.245,0,.11,.031,.35,'#cfa16e');}
  for(const s of [-1,1]) m.drum(-.51,.338,s*.186,.014,.014,.39,brass);
  // Eight fabric gores over a gently cambered awning, with a scalloped contrast valance.
  for(let i=0;i<8;i++) {
    const x=-.58+i*.12, ink=i%2 ? cream : coral;
    for(const s of [-1,1]) {
      const a:Point=[x,.565,0],b:Point=[x+.12,.565,0],c:Point=[x+.12,.518,s*.228],d:Point=[x,.518,s*.228];
      m.quad(a,b,c,d,ink); m.quad(d,c,[x+.12,.49,s*.228],[x,.49,s*.228],ink);
      m.tri([x,.49,s*.228],[x+.12,.49,s*.228],[x+.06,.478,s*.228],ink);
    }
  }
  m.drum(.15,.642,0,.047,.059,.164,'#ddaf5e'); m.drum(.15,.725,0,.064,.06,.042,navy);
  for(const s of [-1,1]) {
    const ring=new TorusGeometry(.06,.017,7,28).translate(.22,.229,s*.183); m.add(ring,coral);
    for(const y of [.169,.289]) m.box(.22,y,s*.184,.019,.032,.036,cream);
  }
  m.drum(.585,.333,0,.009,.012,.29,brass);
  m.tri([.58,.471,0],[.58,.39,0],[.398,.448,.018],teal);
  return m.finish();
}

/** A soap-film rim with a broken white glint rather than a billboard over the opening. */
export function makeRing() {
  const g=new TorusGeometry(.315,.024,9,64), uv=g.getAttribute('uv'), colors:number[]=[], tint=new Color();
  for(let i=0;i<uv.count;i++) {
    const t=uv.getX(i), sheen=.5+.5*Math.cos((uv.getY(i)-.19)*Math.PI*2);
    tint.setHSL((.43+t+.04*Math.sin(t*Math.PI*6))%1,.66,.54+sheen*.23);
    if(t>.26&&t<.39&&sheen>.82) tint.set('#fff9dc');
    colors.push(tint.r,tint.g,tint.b);
  }
  g.setAttribute('color',new Float32BufferAttribute(colors,3)); return g;
}

export function makeWake() {
  const m=new Model();
  for (const s of [-1,1]) {
    const edge=(u:number,k:number):Point=>[-.18-u*1.04,.019,s*(.23+.17*u*u+k*.024*Math.sin(u*Math.PI))];
    for(let i=0;i<10;i++) m.quad(edge(i/10,0),edge((i+1)/10,0),edge((i+1)/10,1),edge(i/10,1),'#d8f3e2');
  }
  return m.finish();
}
