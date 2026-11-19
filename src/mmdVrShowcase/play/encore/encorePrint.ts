import { paintedSurface } from '../../scenery/sceneryPaint';
import type { Wing } from './encoreRound';

const TAU = Math.PI * 2;
const sunrise = { ground: '#502d44', base: '#34283c', mid: '#8a485b', silk: '#d37b66', trim: '#e9ae78', foil: '#ffdfa3' };
const nocturne = { ground: '#24485c', base: '#242b48', mid: '#3a677b', silk: '#63a09f', trim: '#adcdc0', foil: '#f1dfb8' };

function circle(g: CanvasRenderingContext2D, x: number, y: number, r: number, color: string) {
  g.beginPath(); g.arc(x, y, r, 0, TAU); g.fillStyle = color; g.fill();
}

function star(g: CanvasRenderingContext2D, x: number, y: number, r: number, color: string) {
  g.beginPath(); g.moveTo(x, y - r);
  for (let n = 1; n < 8; n++) {
    const a = n * Math.PI / 4, k = n % 2 ? .22 * r : r;
    g.lineTo(x + Math.sin(a) * k, y - Math.cos(a) * k);
  }
  g.closePath(); g.fillStyle = color; g.fill();
}

// Matching emblems on the dye wells and the finished cloth. The crescent cutout
// is a path, so it can sit over a gradient, a dark disc or a metallic grille.
function emblem(g: CanvasRenderingContext2D, day: boolean, x: number, y: number, r: number, color: string) {
  g.save(); g.translate(x, y); g.scale(r, r);
  if (day) {
    for (let i = 0; i < 16; i++) {
      g.save(); g.rotate(i * TAU / 16); g.fillStyle = color;
      g.beginPath(); g.moveTo(-.038, -.7); g.lineTo(0, i % 2 ? -.86 : -1); g.lineTo(.038, -.7); g.fill(); g.restore();
    }
    circle(g, 0, 0, .58, color);
  } else {
    g.beginPath(); g.moveTo(.20, -.87); g.bezierCurveTo(-1.02, -.78, -1.16, .76, -.03, .88);
    g.bezierCurveTo(.39, .92, .69, .62, .76, .37); g.bezierCurveTo(-.09, .67, -.68, -.36, .20, -.87);
    g.fillStyle = color; g.fill(); star(g, .56, -.43, .23, color);
  }
  g.restore();
}

export function badgeTexture(side: Wing, stamped: boolean) {
  const day = side === 'left', p = day ? sunrise : nocturne;
  return paintedSurface(256, 256, g => {
    const cx = 128, cy = 128;
    // An enamel record, cut with concentric grooves and four brass registration dots.
    circle(g, cx, cy, 125, '#352c34'); circle(g, cx, cy, 120, p.trim); circle(g, cx, cy, 114, p.base);
    for (let r = 105; r >= 83; r -= 7) {
      g.beginPath(); g.arc(cx, cy, r, 0, TAU); g.strokeStyle = p.mid; g.lineWidth = 2; g.stroke();
    }
    circle(g, cx, cy, 73, stamped ? p.trim : p.ground);
    emblem(g, day, cx, cy, 56, stamped ? p.base : p.foil);
    for (const a of [.25, .75, 1.25, 1.75]) circle(g, cx + 99 * Math.cos(a * Math.PI), cy + 99 * Math.sin(a * Math.PI), 3.7, p.foil);
  });
}

export function silkTexture(first: Wing) {
  const day = first === 'left', p = day ? sunrise : nocturne;
  return paintedSurface(1024, 640, g => {
    if (!day) { g.translate(1024, 0); g.scale(-1, 1); }
    const sky = g.createLinearGradient(0, 0, 560, 640);
    sky.addColorStop(0, p.mid); sky.addColorStop(.55, p.ground); sky.addColorStop(1, p.base);
    g.fillStyle = sky; g.fillRect(0, 0, 1024, 640);

    // The signature motif is at the leading selvedge. The first tap alone
    // exposes the whole emblem; keep the centre quiet behind a performer's face.
    g.save(); g.translate(168, 145);
    if (day) {
      for (let i = 0; i < 23; i++) {
        g.rotate(TAU / 23); g.beginPath(); g.moveTo(-2, -76); g.lineTo(-4, -680);
        g.lineTo(6, -680); g.lineTo(2, -76); g.fillStyle = 'rgba(233,174,120,.15)'; g.fill();
      }
    } else {
      g.rotate(-.36);
      for (let i = 0; i < 5; i++) {
        g.beginPath(); g.ellipse(0, 0, 123 + i * 55, 94 + i * 24, 0, 0, TAU);
        g.strokeStyle = i === 2 ? p.trim : p.mid; g.lineWidth = i === 2 ? 1.8 : 3; g.stroke();
      }
    }
    g.restore(); emblem(g, day, 168, 145, 77, p.foil);

    for (const [x,y,r] of [[315,73,9],[408,153,4],[81,265,6],[768,203,5],[895,121,12],[955,72,4]]) star(g, x, y, day ? .55*r : r, p.trim);

    // Several screen-printed ribbons travel as one broad gesture: sweeping
    // fan pleats for the matinée, a curling tide for the night print.
    for (let i = 0; i < 8; i++) {
      const y = 250 + i * 23;
      g.beginPath(); g.moveTo(-20, y);
      if (day) g.bezierCurveTo(235, y - 18, 560, 718 - i * 8, 1044, 364 + i * 18);
      else g.bezierCurveTo(190, y + 334, 566, y - 81, 1044, y + 92);
      g.strokeStyle = [p.mid, p.silk, p.trim, p.silk, p.ground, p.trim, p.mid, p.silk][i];
      g.lineWidth = [20, 15, 2.5, 8, 11, 3, 18, 5][i]; g.stroke();
    }

    // Goldwork stitched into the hem, with a narrow dark binding on each edge.
    g.strokeStyle = p.base; g.lineWidth = 18; g.strokeRect(0, 0, 1024, 640);
    g.strokeStyle = p.trim; g.lineWidth = 2; g.strokeRect(12, 12, 1000, 616);
    for (let x = 25; x < 1024; x += 27) {
      star(g, x, 608, 3.8, p.trim);
      g.strokeStyle = p.mid; g.beginPath(); g.moveTo(x + 6, 608); g.lineTo(x + 20, 608); g.stroke();
    }
  });
}
