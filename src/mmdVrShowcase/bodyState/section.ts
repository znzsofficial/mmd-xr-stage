import type { BodySample } from './data';

/** Magnified section through one uterine wall: lumen above, muscle below.
 * Both dates use the same scale and basal line. Values are relative, not mm. */
type Section = Pick<BodySample, 'lining' | 'shedding'>;
const colors = { lumen: '#fcf7f2', muscle: '#dfc9bb', muscleFiber: '#aa897a', lining: '#d78286',
  surface: '#803f51', gland: '#fce4da', vessel: '#a54e61' };
const width = 128, height = 80, base = 60;
const unit = (n: number) => Math.max(0, Math.min(1, n));

/** Identical paths for the screen canvas and XR texture; no image fetch or async decoding. */
function layers({ lining, shedding }: Section) {
  const t = unit(lining), s = unit(shedding);
  const h = 7 + 38 * t, y = base - h;
  const edge = `M0 ${y+2} C16 ${y+2} 18 ${y-3} 32 ${y-1} S54 ${y+4} 68 ${y+1} S90 ${y-3} 100 ${y} S118 ${y+2} 128 ${y-1}`;
  const paths: { d: string; fill?: string; stroke?: string; weight?: number; opacity?: number }[] = [
    { d: 'M0 0H128V80H0Z', fill: colors.lumen },
    { d: 'M0 59H128V80H0Z', fill: colors.muscle },
    { d: edge + ` L128 ${base} H0Z`, fill: colors.lining },
    { d: `M0 ${base}H128`, stroke: colors.muscleFiber, weight: 1.5 },
    { d: 'M1 69Q11 63 23 67T43 69 M48 66Q61 73 76 66 M86 72Q98 65 115 69 M8 77Q22 70 37 75 M62 78Q77 71 89 76 M114 78L128 73', stroke: colors.muscleFiber, weight: 1.5 },
  ];
  for (const x of [12, 43, 77, 110]) {
    const bend = 2 + 7*t;
    paths.push({ d: `M${x} ${y+2} C${x-bend} ${y+h*.25} ${x+bend} ${y+h*.37} ${x+2} ${y+h*.52} S${x-bend} ${y+h*.80} ${x} ${base-4}`,
      stroke: colors.gland, weight: 2.3 });
  }
  for (const x of [29, 63, 95]) {
    paths.push({ d: `M${x-2} ${base-1} Q${x+5} ${base-h*.24} ${x} ${base-h*.43} T${x+1} ${base-h*.76}`,
      stroke: colors.vessel, weight: 1.7 });
  }
  paths.push({ d: edge, stroke: colors.surface, weight: 2 });
  if (s > 0) for (const [x, lift] of [[23, 5], [56, 9], [89, 6], [115, 11]]) {
    const fy = y - 2 - lift*s;
    paths.push({ d: `M${x-3} ${fy} Q${x} ${fy-4*s} ${x+4} ${fy-2*s}`, stroke: colors.surface, weight: 2.5, opacity: s });
  }
  return paths;
}

export function drawBodySection(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, sample: Section) {
  ctx.save(); ctx.translate(x,y); ctx.scale(w/width,h/height);
  ctx.beginPath(); ctx.rect(0,0,width,height); ctx.clip(); ctx.lineCap = 'round';
  for (const p of layers(sample)) {
    const path = new Path2D(p.d); ctx.globalAlpha = p.opacity ?? 1;
    if (p.fill) { ctx.fillStyle = p.fill; ctx.fill(path); }
    if (p.stroke) { ctx.strokeStyle = p.stroke; ctx.lineWidth = p.weight ?? 1; ctx.stroke(path); }
  }
  ctx.restore();
}
