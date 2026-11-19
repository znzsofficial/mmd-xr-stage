import { Vector3, type Object3D } from 'three';

export const REEL_NAME = 'play:piece:kite';
export const EYELET_NAME = 'kite:eyelet';
const eyelets = new WeakMap<Object3D, Set<Object3D>>();

/** Both the stand/controller and the wrist mount the very same reel. Don't
 * search every imported PMX bone to find it, or retain unmounted attachments. */
export function registerEyelet(scene: Object3D, eyelet: Object3D) {
  let set = eyelets.get(scene);
  if (!set) eyelets.set(scene, set = new Set());
  set.add(eyelet);
  return () => { set.delete(eyelet); };
}

export function displayedEyelet(scene: Object3D, character: boolean) {
  const candidates = eyelets.get(scene);
  if (candidates) for (const eyelet of candidates) {
    let onWrist = false;
    for (let p: Object3D | null = eyelet; p && p.visible; p = p.parent) {
      if (p.name === 'play:character') onWrist = true;
      if (p === scene && onWrist === character) return eyelet;
    }
  }
  return null;
}

const heads = new WeakMap<Object3D, Object3D | null>();
export function headOf(root: Object3D) {
  if (!heads.has(root)) {
    let head: Object3D | null = null;
    root.traverse(b => {
      if (head || b.type !== 'Bone') return;
      if ([b.userData.mmdBoneName, b.name].some(n => typeof n === 'string' &&
        /^(頭|head|mixamorighead|bip0*1head)$/.test(n.normalize('NFKC').toLowerCase().split(':').pop()!.replace(/[\s_.-]/g, '')))) head = b;
    });
    heads.set(root, head);
  }
  return heads.get(root) ?? null;
}

const clamp01 = (x: number) => Math.max(0, Math.min(1, x));
/** Viewer-aligned local space: x = viewer's right, origin = face, -z = downwind.
 * Left is a broad low glide; right climbs. A change crosses ABOVE the crown. */
export function flightPoint(out: Vector3, seconds: number, lane: number, held: boolean) {
  const t = clamp01(seconds / 1.65), lift = t * t * (3 - 2 * t);
  const cross = 1 - lane * lane;
  return out.set(lane * (.82 + lift * (1.09 - .16 * lane + .09 * Math.sin(seconds * 1.31))),
    -.07 + lift * (1.01 + .39 * lane) + cross * 1.03 + .075 * lift * Math.sin(seconds * 1.86),
    -.24 - lift * ((held ? 2.36 : 1.25) + .11 * Math.cos(seconds * 1.2)));
}

export const CORD_SAMPLES = 41;
/** Shortest thread around a projected face clearance circle: two tangents
 * with a small arc between them. Ordinary same-side winds stay nearly taut.
 * If the dancer puts the spool in front of their own face, lead immediately
 * out from it; never move the first knot off the displayed spool to fake it. */
export function writeCord(points: Float32Array, a: Vector3, b: Vector3, guardFace: boolean) {
  const radius = .39, da = Math.hypot(a.x, a.y), db = Math.hypot(b.x, b.y);
  const ab = Math.atan2(b.y, b.x), aa = da > .001 ? Math.atan2(a.y, a.x) : ab;
  const delta = Math.atan2(Math.sin(ab - aa), Math.cos(ab - aa)), sign = delta < 0 ? -1 : 1;
  const ta = Math.acos(Math.min(1, radius / Math.max(.001, da))), tb = Math.acos(Math.min(1, radius / Math.max(.001, db)));
  const arc = Math.max(0, Math.abs(delta) - ta - tb);
  const route = guardFace && db > radius && (arc > 0 || da < radius);
  const startAngle = aa + sign * ta, endAngle = startAngle + sign * arc;
  const ax = radius * Math.cos(startAngle), ay = radius * Math.sin(startAngle);
  const bx = radius * Math.cos(endAngle), by = radius * Math.sin(endAngle);
  const first = Math.hypot(ax - a.x, ay - a.y), round = radius * arc, last = Math.hypot(b.x - bx, b.y - by);
  for (let i = 0; i < CORD_SAMPLES; i++) {
    const t = i / (CORD_SAMPLES - 1), s = (first + round + last) * t;
    let x = a.x + (b.x - a.x) * t, y = a.y + (b.y - a.y) * t;
    if (route) {
      if (s < first) { x = a.x + (ax - a.x) * s / first; y = a.y + (ay - a.y) * s / first; }
      else if (s < first + round) { const angle = startAngle + sign * (s - first) / radius; x = radius * Math.cos(angle); y = radius * Math.sin(angle); }
      else { const f = clamp01((s - first - round) / Math.max(1e-8, last)); x = bx + (b.x - bx) * f; y = by + (b.y - by) * f; }
    }
    points[3*i] = x; points[3*i+1] = y - (guardFace ? .035 : .095) * Math.sin(t * Math.PI);
    points[3*i+2] = a.z + (b.z - a.z) * t;
  }
}
