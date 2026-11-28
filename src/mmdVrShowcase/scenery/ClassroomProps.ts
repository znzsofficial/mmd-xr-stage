import type { Part } from './SceneryBatch';
import { CAMPUS_DOOR, campusPassageParts } from './CampusLayout';
import { BOOKCASE, CHALK_TRAY, CLERESTORY, HIGH_PANES, DOOR_CENTERS, LECTERN, REAR_CASE, ROOM, STUDENTS, WINDOWS, seededRandom, type Footprint } from './ClassroomLayout';

type V = Part['p'];
const bindings = ['#52777e', '#c0835a', '#b9b993', '#647a63', '#a65049', '#d0ad70'];

export function classroomProps() {
  const shell: Part[] = [], trim: Part[] = [], round: Part[] = [], leaves: Part[] = [], luminous: Part[] = [];
  const hardwareEnds: number[] = [];
  const slabs: Part[] = [], veneers: Part[] = [], deskFrames: Part[] = [], chairFrames: Part[] = [], backs: Part[] = [];
  const rand = seededRandom(2203), {w, d, h} = ROOM, X=w/2, Z=d/2;
  const add = (list: Part[], p: V, s: V, color: string, ry=0, rz=0, rx=0) => list.push({p,s,color,ry,rz,rx});
  const box = (p: V, s: V, c: string, ry=0, rz=0, rx=0) => add(trim,p,s,c,ry,rz,rx);
  const wall = (p: V,s: V,c: string) => add(shell,p,s,c);
  const cyl = (p: V,s: V,c: string,ry=0,rz=0,rx=0) => add(round,p,s,c,ry,rz,rx);
  const slab = (p: V,s: V,c: string,ry=0) => add(slabs,p,s,c,ry);
  const plaster='#eeefe9', sage='#adc2ac', dark='#56675f', molding='#a6926e', wood='#bb9065', ply='#b18360';

  wall([0,h+.08,0],[w+.24,.16,d+.24],'#f2f1e9');
  for (const s of [-1,1]) {
    const spans=s===-1?[[-X-.16,X+.16]]:[[-X-.16,CAMPUS_DOOR-.93],[CAMPUS_DOOR+.93,X+.16]];
    for(const [a,b] of spans){const x=(a+b)/2;
      if(s<0){
        const {sill,head,z}=CLERESTORY;
        wall([x,sill/2,z],[b-a,sill,.16],plaster);
        wall([x,(head+h)/2,z],[b-a,h-head,.16],plaster);
        let edge=a;
        for(const pane of HIGH_PANES){
          wall([(edge+pane.left)/2,(sill+head)/2,z],[pane.left-edge,head-sill,.16],plaster);
          box([(pane.left+pane.right)/2,sill-.025,z+.035],[pane.right-pane.left,.05,.22],molding);
          edge=pane.right;
        }
        wall([(edge+b)/2,(sill+head)/2,z],[b-edge,head-sill,.16],plaster);
      }else wall([x,h/2,s*(Z+.08)],[b-a,h,.16],plaster);
      box([x,.47,s*(Z-.012)],[b-a,.94,.05],sage);box([x,.95,s*(Z-.05)],[b-a,.06,.095],molding);box([x,.072,s*(Z-.035)],[b-a,.144,.085],dark);}
    if(s===1){wall([CAMPUS_DOOR,(h+2.4)/2,Z+.08],[1.86,h-2.4,.16],plaster);for(const k of [-1,1])box([CAMPUS_DOOR+k*.91,1.21,Z],[.09,2.42,.25],dark);box([CAMPUS_DOOR,2.41,Z],[1.93,.12,.25],dark);}
  }
  wall([X+.08,h/2,0],[.16,h,d],plaster);
  box([X-.01,.47,0],[.05,.94,d],sage);
  wall([-X-.08,ROOM.sill/2,0],[.16,ROOM.sill,d],sage);
  wall([-X-.08,(h+ROOM.lintel)/2,0],[.16,h-ROOM.lintel,d],plaster);
  for (const s of [-1,1]) {
    box([s*(X-.04),.075,0],[.08,.15,d],dark);
    box([s*(X-.045),s<0?ROOM.sill:.95,0],[s<0?.24:.09,s<0?.094:.06,d],molding);
    box([s*(X-.08),h-.095,0],[.16,.19,d], '#ddd5bf');
  }
  // Layer the reveal, painted sash and thin inner stop so sighting along the
  // windows shows their depth (there is no transparent glass over the room).
  for (const {z,width} of WINDOWS) {
    wall([-X-.02,2,z-width/2],[.23,2.29,.14],'#a7997e');
    wall([-X-.068,ROOM.transom,z],[.075,.065,width],'#8e9d90');
    wall([-X-.08,1.79,z],[.076,1.77,.053],'#859a8f');
    box([-X+.035,2,z-width/2+.075],[.038,2.28,.035],'#eee3c6');
    box([-X+.026,ROOM.sill+.068,z],[.082,.045,width],'#e4dbc0');
    box([-X-.086,2.91,z],[.06,.48,.044],'#a3aa97');
    box([-X+.003,1.64,z+.032],[.064,.132,.035],dark);
  }
  cyl([-X+.17,3.22,0],[.034,d,.034],'#ad946e',0,0,Math.PI/2);
  hardwareEnds.push(round.length); // full-length curtain rod
  // Overhead concrete ribs, suspended twin diffuser lights and end caps.
  for (const z of [-3.67,0,3.67]) {
    box([0,h-.065,z],[w,.13,.19],'#e5dcc7');
    for (const x of [-2.9,0,2.9]) {
      for(const dx of [-.46,.46]) box([x+dx,3.285,z+.43],[.021,.32,.021],'#889389');
      box([x,3.15,z+.43],[1.38,.065,.22],'#81918a');
      for(const dz of [-.056,.056]) add(luminous,[x,3.107,z+.43+dz],[1.27,.029,.067],'#f5efd9');
    }
  }
  // Broad teaching wall with a separate wooden rail, chalk sticks and felt eraser.
  box([-.70,1.97,-Z+.08],[5.96,1.55,.12], '#796448');
  box([-.70,1.97,-Z+.145],[5.88,1.47,.038],'#b89468');
  box([CHALK_TRAY.x,1.17,CHALK_TRAY.z],[CHALK_TRAY.w,.067,CHALK_TRAY.d],wood);
  // White enamel chalk tin at the standing portrait, lit like the tray.
  const tinZ=CHALK_TRAY.z+.044;
  cyl([-.53,1.279,tinZ],[.14,.15,.14],'#edeee9');
  cyl([-.53,1.351,tinZ],[.146,.014,.146],'#758d87');
  cyl([-.549,1.368,tinZ],[.023,.070,.023],'#fff5d8',0,-.15);
  cyl([-.505,1.367,tinZ+.018],[.023,.064,.023],'#dcbda1',0,.12);
  for(let i=0;i<4;i++) cyl([-2.95+i*.18,1.213,-Z+.23],[.018,.113,.018],i%2?'#e7cb8b':'#f6efd9',0,Math.PI/2);
  slab([.70,1.228,-Z+.21],[.19,.047,.078],'#59675b');box([.70,1.256,-Z+.21],[.185,.019,.071],'#bc7955');
  box([3.76,1.95,-Z+.078],[2.18,1.32,.12],'#8e7456');box([3.76,1.95,-Z+.148],[2.07,1.21,.045],'#c8ab7e');
  for(const [x,y] of [[3.18,2.36],[4.16,2.4],[3.81,1.9]]) cyl([x,y,-Z+.199],[.034,.018,.034],'#ab6450',0,0,Math.PI/2);
  // Tick positions stay legible in peripheral view, with a red second hand.
  const cx=-.70, cy=3.025;
  cyl([cx,cy,-Z+.10],[.433,.065,.433],dark,0,0,Math.PI/2); cyl([cx,cy,-Z+.139],[.393,.018,.393],'#faf0d6',0,0,Math.PI/2);
  hardwareEnds.push(round.length); // teaching wall
  for(let i=0;i<12;i++){ const a=i*Math.PI/6; box([cx+.167*Math.sin(a),cy+.167*Math.cos(a),-Z+.158],[.011,i%3?.022:.037,.007],dark,0,-a); }
  box([cx-.044,cy+.018,-Z+.171],[.022,.104,.012],dark,0,1.14);box([cx+.024,cy+.066,-Z+.169],[.016,.144,.012],dark,0,-.35);
  box([cx+.021,cy-.068,-Z+.18],[.009,.155,.008],'#ac654b',0,.29);

  // Corridor-side paired sliding doors, recessed glazed lights and kickplates.
  for (const z of DOOR_CENTERS) {
    box([X-.063,1.20,z],[.085,2.40,1.51],dark);box([X-.115,1.17,z],[.045,2.27,1.40],'#caa67f');
    for(const dz of [-.345,.345]) {
      box([X-.142,1.73,z+dz],[.022,.76,.57],'#806e56');box([X-.157,1.73,z+dz],[.012,.69,.49],'#9bada5');
      box([X-.17,1.73,z+dz-.12],[.012,.69,.033],'#d4c6a6');box([X-.15,.20,z+dz],[.022,.23,.565],'#a5a396');
    }
    box([X-.153,1.15,z],[.023,2.25,.034],'#968269');box([X-.17,.99,z+.179],[.032,.19,.045],dark);
    box([X-.108,2.69,z],[.07,.32,.44],wood);
  }

  function notebook(x:number,y:number,z:number,a:number,tint:string,open=false) {
    if (open) {
      const c=Math.cos(a),s=Math.sin(a);
      for (const side of [-1,1]) {
        const ox=x+side*.080*c, oz=z-side*.080*s;
        slab([ox,y+.012,oz],[.159,.021,.211],'#f0eee5',a);
        for(let line=0;line<4;line++) {
          const dz=-.04+line*.022;box([ox+dz*s,y+.024,oz+dz*c],[.109,.003,.004],'#969c8b',a);
        }
      }
    } else {
      slab([x,y+.005,z],[.205,.010,.269],tint,a); slab([x,y+.018,z],[.198,.019,.262],'#f2e5c5',a);
      slab([x,y+.030,z],[.205,.009,.269],tint,a);
      const dz=-.05;box([x+Math.sin(a)*dz,y+.036,z+Math.cos(a)*dz],[.122,.002,.04],'#dfd8b5',a);
    }
  }
  for (const { desk, chair, i } of STUDENTS) {
    const { x,z,w,d }=desk, a=chair.yaw??0;
    const veneer=['#d6ab76','#ca9e6d','#d7b383','#ce9e70'][i%4];
    add(veneers,[x,.725,z],[w,.030,d],veneer);
    box([x,.633,z-.195],[.63,.115,.045],'#8f9181'); box([x,.588,z+.004],[.64,.026,.36],'#7e887d');
    for(const side of [-1,1]) box([x+side*.313,.637,z],[.024,.10,.35],'#a9b5a2');
    if (i%4===1 || i%4===2) box([x+.045,.623,z+.075],[.245,.04,.22],bindings[i%6],.034);
    deskFrames.push({p:[x,0,z],s:[1,1,1],color:'#818f83'});
    chairFrames.push({p:[chair.x,0,chair.z],s:[1,1,1],ry:a,color:'#718378'});
    add(veneers,[chair.x,.435,chair.z],[.444,.037,.414],ply,a);
    backs.push({p:[chair.x,0,chair.z],s:[1,1,1],ry:a,color:veneer});
    if (i%4!==0) notebook(x+.12*Math.sin(i),.741,z-.04,.12*Math.sin(i*1.3),bindings[i%6],i%5===2);
    if(i%3===0) { const p=x+.20; cyl([p,.751,z+.105],[.013,.171,.013],'#b8794d',.2,Math.PI/2); }
  }

  hardwareEnds.push(round.length); // pencils
  const L=LECTERN;
  slab([L.x,.866,L.z],[L.w,.055,L.d],'#c59c6e');box([L.x,.53,L.z-.12],[1.46,.60,.27],'#bcaa89');
  for (const dx of [-.69,.69]) box([L.x+dx,.43,L.z],[.075,.86,.52],molding);
  notebook(L.x+.35,.894,L.z,.10,bindings[2],true);
  // Small terrestrial globe on a tilted brass cradle.
  const gx=L.x-.45,gz=L.z; cyl([gx,.914,gz],[.22,.04,.22],dark);cyl([gx,.975,gz],[.042,.10,.042],molding);
  cyl([gx,1.172,gz],[.012,.39,.012],'#ad935f',0,-.32);
  for(let i=0;i<14;i++){
    const a=-.32+Math.PI*(i+.5)/14;
    cyl([gx+.193*Math.sin(a),1.172+.193*Math.cos(a),gz],[.012,.049,.012],'#c19a5b',0,Math.PI/2-a);
  }
  hardwareEnds.push(round.length); // globe cradle
  // Pinned student work along the side wall: aluminium rail, paper corners,
  // a muted field map on each sheet. The wall face stays flush and placeable.
  box([X-.047,2.43,.02],[.08,.046,3.02],molding);
  for(let i=0;i<4;i++){
    const z=-1.12+i*.74;
    box([X-.051,2.06,z],[.016,.58,.443],i%2?'#deceb4':'#c8d2ba');
    box([X-.068,2.335,z],[.036,.039,.075],dark);
  }

  function shelf(f:Footprint,bays:number) {
    const {x,z,w,d}=f, inward=z<0?1:-1;
    box([x,.535,z-inward*d*.42],[w,1.02,.055],'#9c8066');
    for(const y of [.085,.55,1.03]) box([x,y,z],[w,.05,d],wood);
    for(let i=0;i<=bays;i++)box([x+(i/bays-.5)*(w-.048),.55,z],[.046,.99,d],wood);
    for(let i=0;i<bays;i++)for(let k=0;k<2;k++){
      const cx=x+w*(-.5+(i+.5)/bays), y=(k?.575:.11), left=cx-w/bays*.36;
      if((i+k)%3===0){box([cx,y+.114,z+inward*.04],[w/bays*.70,.221,d*.70],'#a3b5a6');box([cx,y+.133,z+inward*(d*.35+.047)],[.128,.054,.01],'#e6d9bb');}
      else for(let j=0;j<5;j++){
        const hh=.227+rand()*.124,xx=left+j*.06;
        box([xx,y+hh/2,z+inward*.042],[.046,hh,.245],bindings[(i+j+k)%6]);
        box([xx,y+hh*.78,z+inward*.168],[.041,.015,.008],'#d9cba9');
      }
    }
  }
  shelf(BOOKCASE,3);shelf(REAR_CASE,5);
  function plant(x:number,y:number,z:number,s:number) {
    cyl([x,y+.086*s,z],[.179*s,.17*s,.179*s],'#b47556');cyl([x,y+.170*s,z],[.202*s,.038*s,.202*s],'#c68961');
    hardwareEnds.push(round.length);
    for(let i=0;i<7;i++) {const a=i*2.399; add(leaves,[x+.066*s*Math.cos(a),y+(.265+.049*rand())*s,z+.066*s*Math.sin(a)],
      [.112*s,.28*s,.071*s],i%2?'#7e9b69':'#598570',a,.48*Math.cos(a),-.48*Math.sin(a));}
  }
  plant(BOOKCASE.x+.62,1.055,BOOKCASE.z,1.35);
  plant(REAR_CASE.x-.92,1.055,REAR_CASE.z,1.68);
  trim.push(...campusPassageParts());

  // Window bank first. Only the plain steel batches change order: the birch
  // shader's gl_InstanceID is the original student's veneer sample.
  for (const frames of [deskFrames,chairFrames]) frames.sort((a,b)=>Number(a.p[0]>0)-Number(b.p[0]>0));
  return {shell,trim,round,hardwareEnds,leaves,luminous,slabs,veneers,deskFrames,chairFrames,backs};
}
