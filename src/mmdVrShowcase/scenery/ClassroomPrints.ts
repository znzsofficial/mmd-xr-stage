import { CanvasTexture, SRGBColorSpace } from 'three';
import { CLASS_FIXTURES, CLASS_SUN, ROOM, STUDENTS, WINDOWS, seededRandom } from './ClassroomLayout';

type Ink = CanvasRenderingContext2D;
function paper(w: number, h: number, draw: (g: Ink) => void) {
  const canvas = document.createElement('canvas'); canvas.width = w; canvas.height = h;
  const g = canvas.getContext('2d')!; draw(g);
  const map = new CanvasTexture(canvas);
  map.colorSpace = SRGBColorSpace; map.anisotropy = 4;
  return map;
}

// A whole-room light bake, rather than scores of alpha-blended decals. The
// basketweave blocks rotate their grain as well as their joints. Mips keep the
// thin veneer and endgrain marks quiet at grazing angles in stereo.
export function parquet(shadows: boolean) {
  const size = 1024, { w, d } = ROOM, rand = seededRandom(203);
  return paper(size, size, g => {
    g.fillStyle = '#997e62'; g.fillRect(0, 0, size, size);
    const n = 20, block = size / n, strip = block / 4;
    for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
      g.save(); g.translate((i + .5) * block, (j + .5) * block);
      if ((i + j) % 2) g.rotate(Math.PI / 2);
      g.translate(-block / 2, -block / 2);
      for (let k = 0; k < 4; k++) {
        const t = Math.round(rand() * 14);
        g.fillStyle = `rgb(${186 + t},${147 + t},${104 + t})`;
        g.fillRect(.25, k * strip + .35, block - .45, strip - .7);
        // Fine open grain and the irregular tips of growth rings.
        for (let m = 0; m < 3; m++) {
          const y = (k + rand() * .78 + .1) * strip, x = rand() * .23 * block;
          g.beginPath(); g.moveTo(x, y); g.quadraticCurveTo(block * .55, y + rand() * 2.3, block * .96, y + .7);
          g.quadraticCurveTo(block * .43, y + 1.8, x, y);
          g.fillStyle = m === 1 ? '#f4d8af60' : '#765e4925'; g.fill();
        }
      }
      g.restore();
    }
    // Narrow border of long boards follows the perimeter, as in a real lay-up.
    g.strokeStyle = '#ae8866'; g.lineWidth = size * .032; g.strokeRect(0, 0, size, size);
    g.strokeStyle = '#7f6e57'; g.lineWidth = 1.8; g.strokeRect(16, 16, size - 32, size - 32);
    const shade = g.createLinearGradient(0, 0, size, size * .07);
    shade.addColorStop(0, '#c0b99e12'); shade.addColorStop(.3, '#c0b99e00'); shade.addColorStop(1, '#54463c46');
    g.fillStyle = shade; g.fillRect(0, 0, size, size);
    const px = (x: number) => size * (.5 + x / w), py = (z: number) => size * (.5 + z / d);
    if (!shadows) {
      // Project the actual window lights down the same vector as the stage sun.
      const [sx, sy, sz] = CLASS_SUN;
      const project = (y: number, z: number): [number, number] => [px(-w / 2 - y * sx / sy), py(z - y * sz / sy)];
      const layer = document.createElement('canvas'); layer.width = size; layer.height = size;
      const light = layer.getContext('2d')!;
      light.fillStyle = '#fff0c5'; light.shadowBlur = 4; light.shadowColor = '#fff1d3';
      for (const { z, width } of WINDOWS) for (let pane = 0; pane < 2; pane++) {
        const a = z - width / 2 + pane * width / 2 + (pane === 0 ? .24 : .035), b = z - width / 2 + (pane + 1) * width / 2 - .05;
        for (const [y0, y1] of [[ROOM.sill + .06, ROOM.transom - .036], [ROOM.transom + .035, ROOM.lintel - .04]]) {
          light.beginPath(); light.moveTo(...project(y0, a)); light.lineTo(...project(y0, b)); light.lineTo(...project(y1, b)); light.lineTo(...project(y1, a)); light.closePath(); light.fill();
        }
      }
      light.shadowBlur = 0; light.globalCompositeOperation = 'destination-out';
      for (const { desk,chair } of STUDENTS) for(const [f,height] of [[desk,.74],[chair,.45]] as const) {
        light.save(); light.translate(px(f.x-height*sx/sy),py(f.z-height*sz/sy)); light.rotate(-(f.yaw??0));
        const ww=size*f.w/w,dd=size*f.d/d;
        light.beginPath(); light.roundRect(-ww/2,-dd/2,ww,dd,3); light.fill(); light.restore();
      }
      g.save(); g.globalAlpha=.57; g.drawImage(layer,0,0); g.restore();
    }
    for (const f of CLASS_FIXTURES) {
      g.save(); g.translate(px(f.x + .035), py(f.z + .025)); g.rotate(-(f.yaw ?? 0));
      g.scale(size * f.w / w * .8, size * f.d / d * .92);
      const ao = g.createRadialGradient(0, 0, 0, 0, 0, 1);
      ao.addColorStop(0, '#463a3160'); ao.addColorStop(.53, '#54463839'); ao.addColorStop(1, '#725e4600');
      g.fillStyle = ao; g.fillRect(-1, -1, 2, 2); g.restore();
    }
    // Alpha is an independent indirect-light mask. Keep the baked window
    // projection and floor pigment in RGB: the A/B needs no alternate albedo.
    const pixels=g.getImageData(0,0,size,size),data=pixels.data;
    function glide(x:number,z:number){
      const cx=px(x),cy=py(z),r=.18;
      for(let j=Math.max(0,Math.floor(cy-r*size/d));j<=Math.min(size-1,Math.ceil(cy+r*size/d));j++)
        for(let i=Math.max(0,Math.floor(cx-r*size/w));i<=Math.min(size-1,Math.ceil(cx+r*size/w));i++){
          const d2=((i+.5-cx)*w/size)**2+((j+.5-cy)*d/size)**2, off=(j*size+i)*4+3;
          const visibility=1.-.55*Math.exp(-d2/.0012)-.32*Math.exp(-d2/.006);
          data[off]=Math.round(data[off]*visibility);
        }
    }
    for(const {desk,chair} of STUDENTS){
      const yaw=chair.yaw??0,c=Math.cos(yaw),s=Math.sin(yaw);
      for(const a of [-1,1]){
        glide(desk.x+a*.366,desk.z-.224);glide(desk.x+a*.367,desk.z+.219);
        for(const [x,z] of [[a*.20,-.207],[a*.21,.224]])glide(chair.x+x*c+z*s,chair.z-x*s+z*c);
      }
    }
    g.putImageData(pixels,0,0);
  });
}

// Neutral birch veneer modulates instance colors. Only furniture receives
// this small map; printed covers and books don't inherit the grain.
export function veneerGrain() {
  const rand=seededRandom(631);
  return paper(256,128,g=>{
    g.fillStyle='#fbfaf6';g.fillRect(0,0,256,128);
    for(let i=0;i<120;i++){
      const y=rand()*140-6,x=rand()*84-38,width=95+rand()*140,bow=rand()*10-4;
      g.beginPath();g.moveTo(x,y);g.bezierCurveTo(x+38,y+bow,x+width*.68,y+bow+2,x+width,y-1);
      g.bezierCurveTo(x+width*.64,y+bow+3,x+27,y+bow+1,x,y);
      g.fillStyle=i%5?'#ab9b8420':'#b3a3933a';g.fill();
    }
  });
}

export function globeChart() {
  return paper(512,256,g=>{
    g.fillStyle='#72a8b8';g.fillRect(0,0,512,256);
    g.strokeStyle='#d1ddc380';g.lineWidth=.8;
    for(let i=1;i<24;i++)line(g,i*512/24,0,i*512/24,256);
    for(let i=1;i<12;i++)line(g,0,i*256/12,512,i*256/12);
    // Simplified continental silhouettes in longitude/latitude, drawn here
    // so the globe stays legible even when pressed right up to the lectern.
    const land=(points:number[][])=>{g.beginPath();points.forEach(([lon,lat],i)=>{const u=(lon+180)*512/360,v=(90-lat)*256/180;i?g.lineTo(u,v):g.moveTo(u,v)});g.closePath();g.fillStyle='#dcc58d';g.fill();g.strokeStyle='#9da279';g.lineWidth=1.1;g.stroke();};
    land([[-168,67],[-148,71],[-131,68],[-106,73],[-91,74],[-76,80],[-63,74],[-80,62],[-76,54],[-61,60],[-54,51],[-75,43],[-80,31],[-81,25],[-85,30],[-97,26],[-96,19],[-83,18],[-78,9],[-90,15],[-104,21],[-114,32],[-124,40],[-127,50],[-139,59],[-153,60],[-164,54]]);
    land([[-80,10],[-71,12],[-61,10],[-48,2],[-36,-6],[-40,-19],[-55,-33],[-64,-41],[-68,-55],[-75,-48],[-75,-26],[-81,-6]]);
    land([[-53,59],[-61,67],[-56,78],[-37,84],[-18,81],[-27,70]]);
    land([[-17,15],[-12,30],[0,37],[14,33],[24,32],[32,31],[35,22],[44,12],[51,12],[48,2],[41,-9],[37,-17],[34,-27],[26,-35],[18,-34],[12,-18],[10,-5],[8,4],[1,6],[-9,5]]);
    land([[-10,36],[-9,44],[-2,44],[0,50],[6,54],[10,55],[5,59],[19,71],[30,71],[25,62],[40,67],[66,71],[104,78],[128,71],[158,70],[179,66],[172,58],[143,47],[135,43],[129,35],[123,40],[119,31],[111,22],[106,21],[107,10],[102,14],[100,7],[93,20],[87,21],[78,8],[72,19],[65,25],[56,26],[51,20],[44,12],[38,18],[34,30],[27,36],[23,40],[23,36],[17,39],[13,45],[9,44],[8,42],[3,42]]);
    land([[114,-22],[122,-15],[131,-12],[137,-16],[143,-11],[151,-23],[153,-33],[145,-39],[133,-33],[117,-35]]);
    land([[48,-13],[50,-17],[46,-25],[44,-23]]);land([[130,32],[138,36],[143,44],[145,43],[140,34]]);land([[-6,50],[-4,57],[-6,58],[-3,59],[2,52]]);
    g.strokeStyle='#e0d4ad';g.lineWidth=1.6;line(g,0,128,512,128);
  });
}

function letter(g: Ink, text: string, x: number, y: number, font: string, ink: string) {
  g.font = font; g.fillStyle = ink; g.fillText(text, x, y);
}
function ellipse(g: Ink, x: number, y: number, rx: number, ry: number, angle = 0) {
  g.beginPath(); g.ellipse(x, y, rx, ry, angle, 0, 2 * Math.PI);
}
function line(g: Ink, a: number, b: number, c: number, d: number) {
  g.beginPath(); g.moveTo(a, b); g.lineTo(c, d); g.stroke();
}
// Original classroom artwork; no external font, image fetch, or text mesh.
// Atlas: chalk lesson above, three field prints and a room plaque below.
export function lessonAtlas() {
  const rand = seededRandom(42);
  return paper(1024, 512, g => {
    const chalk = '#e6ecd9', amber = '#f1cb86', blue = '#a9d4d2';
    const wash = g.createLinearGradient(0, 0, 1000, 210);
    wash.addColorStop(0, '#456864'); wash.addColorStop(.58, '#34544f'); wash.addColorStop(1, '#2c4d48');
    g.fillStyle = wash; g.fillRect(0, 0, 1024, 256);
    for (let i = 0; i < 45; i++) {
      const x = rand() * 1024, y = rand() * 256;
      ellipse(g, x, y, rand() * 65 + 15, rand() * 3 + 1, rand() * .14); g.fillStyle = '#f6efd005'; g.fill();
    }
    letter(g, 'NATURAL SCIENCES     /     FIELD STUDY  04', 32, 32, 'bold 13px sans-serif', blue);
    letter(g, 'The lunar cycle', 28, 85, 'italic 49px Georgia, serif', chalk);
    g.strokeStyle = amber; g.lineWidth = 2; line(g, 30, 95, 319, 92);
    letter(g, 'Reflected sunlight', 37, 136, 'italic 23px Georgia, serif', chalk);
    letter(g, 'One lunation  ≈  29.5 days', 37, 170, 'italic 21px Georgia, serif', chalk);
    letter(g, 'Sketch the Moon after sunset.', 38, 224, 'italic 18px Georgia, serif', blue);
    g.strokeStyle = '#c2d4c36b'; line(g, 365, 43, 365, 224);
    // Four observational sketches, each with a terminator and a label.
    const names = ['NEW', 'FIRST QTR', 'FULL', 'LAST QTR'];
    for (let i = 0; i < 4; i++) {
      const x = 426 + i * 77;
      ellipse(g, x, 110, 25, 25); g.fillStyle = '#314b4a'; g.fill(); g.save(); g.clip();
      g.fillStyle = '#e6d8a8';
      if (i === 1) g.fillRect(x, 80, 30, 60);
      if (i === 2) g.fillRect(x - 30, 80, 60, 60);
      if (i === 3) g.fillRect(x - 30, 80, 30, 60);
      g.restore(); g.strokeStyle = chalk; g.lineWidth = 1.5; g.stroke();
      g.textAlign = 'center'; letter(g, names[i], x, 158, '11px sans-serif', chalk); g.textAlign = 'left';
    }
    letter(g, 'Phases as seen from Earth', 402, 207, 'italic 19px Georgia, serif', amber);
    g.strokeStyle = blue; g.lineWidth = 2; ellipse(g, 870, 135, 92, 40, -.30); g.stroke();
    g.strokeStyle = '#9ab8af'; g.setLineDash([4, 7]); line(g, 769, 167, 976, 99); g.setLineDash([]);
    ellipse(g, 870, 135, 22, 22); g.fillStyle = '#80adab'; g.fill(); g.strokeStyle = chalk; g.stroke();
    g.strokeStyle = '#537b73'; ellipse(g, 870, 135, 11, 21, -.32); g.stroke();
    ellipse(g, 940, 97, 7, 7); g.fillStyle = amber; g.fill(); letter(g, 'Moon', 925, 79, 'italic 16px Georgia', chalk);
    letter(g, 'orbital plane', 823, 211, 'italic 17px Georgia', blue);
    const print = (left: number, bg: string, ink: string, code: string, title: string) => {
      g.fillStyle = bg; g.fillRect(left, 256, 256, 256);
      letter(g, code, left + 18, 281, 'bold 12px sans-serif', ink);
      g.strokeStyle = ink; g.lineWidth = 1; line(g, left + 18, 289, left + 237, 289);
      letter(g, title, left + 18, 481, 'italic 28px Georgia', ink);
    };
    print(0, '#e9d8a7', '#374f52', 'CELESTIAL ATLAS     01', 'Summer skies');
    g.fillStyle = '#395865'; g.fillRect(17, 301, 222, 142);
    for (let i = 0; i < 46; i++) { ellipse(g, 26 + rand() * 199, 308 + rand() * 127, 1.1, 1.1); g.fillStyle = chalk; g.fill(); }
    const stars = [[40, 368], [74, 353], [103, 354], [127, 364], [134, 398], [177, 387], [187, 354], [127, 364]];
    stars.forEach(([x,y],i) => { if(i) {g.strokeStyle = '#afcaca'; line(g, ...stars[i-1] as [number, number], x,y);} ellipse(g,x,y,3.2,3.2); g.fillStyle=amber; g.fill(); });
    print(256, '#bfcec3', '#344c44', 'BOTANY SERIES     07', 'Fern fronds');
    g.strokeStyle = '#466552'; g.lineWidth = 3; line(g, 333, 438, 427, 302);
    for (let n = 0; n < 12; n++) { const x = 339 + n * 7.4, y = 428 - n * 10.6, r = 25 - n * 1.8;
      for (const s of [-1,1]) { ellipse(g, x + s * r * .69, y - r * .45, r, r * .24, s === 1 ? -.36 : 1.12); g.fillStyle = n%2 ? '#50765c' : '#658364'; g.fill(); }}
    print(512, '#f4e8d2', '#92583e', 'OBSERVATION LOG', 'Field journal');
    for(let i=0;i<7;i++){ g.strokeStyle='#9e9f87';line(g,534,310+i*19,746,310+i*19); }
    g.fillStyle='#3c6961';g.fillRect(768,256,256,256);
    letter(g,'SCIENCE',791,315,'bold 25px sans-serif','#d8e8d3');
    letter(g,'203',784,432,'84px Georgia','#fbebcd');
    g.strokeStyle='#c5ab70';g.lineWidth=4;line(g,790,461,997,461);
  });
}
