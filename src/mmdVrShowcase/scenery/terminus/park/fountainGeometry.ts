import {
  BufferGeometry, Color, Float32BufferAttribute, LatheGeometry, QuadraticBezierCurve3,
  TubeGeometry, Vector2, Vector3,
} from 'three';
import { box, PaintedParts, rod, turn } from '../../../play/modelParts';
import { fountainCourt } from '../parkLayout';

const tau = 2 * Math.PI;
export const waterline = .365;

// Each lip, stream, splash and wave source is on the same ballistic trajectory.
function spout(bearing: number, lipY: number, throwRadius: number, lift: number) {
  const radial = new Vector3(Math.cos(bearing), 0, Math.sin(bearing));
  const mouth = radial.clone().multiplyScalar(.55).setY(lipY);
  const impact = radial.clone().multiplyScalar(throwRadius).setY(waterline);
  const flight = (lift + Math.sqrt(lift * lift + 2 * 9.81 * (lipY - waterline))) / 9.81;
  const control = mouth.clone().lerp(impact, .5).setY(lipY + .5 * lift * flight);
  return { bearing, mouth, impact, flight, path: new QuadraticBezierCurve3(mouth, control, impact) };
}

export const fountainSpouts = [
  spout(.35, 1.752, 1.80, 2.05),
  spout(2.55, 1.335, 1.56, 2.38),
  spout(4.52, 1.086, 1.72, 2.15),
];

export function fountainStone() {
  const parts = new PaintedParts();
  // A recessed toe, shadow joint below the coping, and continuous dark grout
  // behind the radial saw cuts. The inner return continues below the water.
  parts.add(turn([[2.70, 0], [2.70, .065], [2.75, .073], [2.75, .317], [2.70, .33],
    [2.70, .355], [2.778, .368], [2.778, .444], [2.46, .444], [2.46, .34]], 96), '#a9a89a');
  parts.add(turn([[2.46, .34], [2.46, .16], [2.43, .124], [2.32, .115], [.001, .115]], 96), '#83978e');
  const radius = fountainCourt.radius;
  const coping = [[2.754, .351], [2.791, .36], [radius, .374], [radius, .434], [2.792, .451],
    [2.775, .46], [2.466, .46], [2.448, .45], [2.44, .436], [2.44, .352]].map(([r, y]) => new Vector2(r, y));
  const stones = ['#e9dfc8', '#e7dfcf', '#ded7c8', '#e4dbc9', '#e9e1d0'];
  for (let i = 0; i < 24; i++) {
    parts.add(new LatheGeometry(coping, 5, tau * i / 24 + .0015, tau / 24 - .003), stones[i % stones.length]);
  }
  // Exposed top is a single stone pierced by the three cast bronze stems.
  parts.add(turn([[.46, .12], [.485, .15], [.485, .54], [.49, .555], [.49, .58],
    [.47, .60], [.001, .60]], 64), '#566461');
  const geometry = parts.finish();
  const points = geometry.getAttribute('position');
  const uv = [];
  for (let i = 0; i < points.count; i++) {
    uv.push(points.getX(i) * .85 + points.getY(i) * .41, points.getZ(i) * .85 + points.getY(i) * .86);
  }
  geometry.setAttribute('uv', new Float32BufferAttribute(uv, 2));
  return geometry;
}

function foldedBlade(spout: typeof fountainSpouts[number]) {
  const positions: number[] = [], colors: number[] = [], indices: number[] = [];
  // Six longitudinal faces of a folded, twisting bronze leaf. A narrow
  // polished arris survives at walking distance against the broad patina.
  const section = [[1, 0], [.40, .78], [0, 1], [-1, .08], [-.36, -.90], [.26, -1]];
  const patina = ['#81958a', '#c6aa7c', '#527b72', '#597d73', '#b79b70', '#759487'];
  const steps = 14;
  const throat = spout.path.getTangent(0).multiplyScalar(-.065).add(spout.mouth);
  for (let face = 0; face < section.length; face++) {
    const tint = new Color(patina[face]);
    const start = positions.length / 3;
    for (let i = 0; i <= steps; i++) {
      const t = i / steps, belly = Math.sin(Math.PI * t);
      const angle = spout.bearing + .97 * (1 - t) ** 1.4;
      const radius = .24 * (1 - t) + Math.hypot(throat.x, throat.z) * t - .13 * belly;
      const width = .095 * (1 - t) + .041 * t + .088 * belly;
      for (const j of [face, (face + 1) % section.length]) {
        const [r, s] = section[j], d = radius + (.044 + .024 * belly) * r;
        positions.push(d * Math.cos(angle) - width * s * Math.sin(angle), .59 + (throat.y - .59) * t,
          d * Math.sin(angle) + width * s * Math.cos(angle));
        colors.push(tint.r, tint.g, tint.b);
      }
      if (i < steps) {
        const a = start + 2 * i;
        indices.push(a, a + 2, a + 1, a + 1, a + 2, a + 3);
      }
    }
  }
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new Float32BufferAttribute(positions, 3));
  geometry.setAttribute('color', new Float32BufferAttribute(colors, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

export function fountainMetal() {
  const parts = new PaintedParts();
  for (const spout of fountainSpouts) {
    parts.add(foldedBlade(spout));
    const socket = spout.path.getTangent(0).multiplyScalar(-.095).add(spout.mouth);
    parts.add(rod(socket.toArray(), spout.mouth.toArray(), .052, .041, 20), '#be9e73');
  }
  parts.add(turn([[.476, .505], [.49, .51], [.49, .519], [.476, .524]], 64), '#bda374');
  // The radial intake grille sits just below the surface. Its dark slots
  // give the eye a fixed reference underneath moving highlights.
  parts.add(turn([[.785, .132], [.785, .171], [.495, .171]], 64), '#344b47');
  for (let i = 0; i < 48; i++) {
    parts.add(box(.637, .176, 0, .277, .011, .023).rotateY(tau * i / 48), '#99a59a');
  }
  return parts.finish();
}

export function fountainStreams() {
  const parts = new PaintedParts();
  const displacement: number[][] = [[], []], slope: number[][] = [[], []];
  for (const { path, flight } of fountainSpouts) {
    const geometry = new TubeGeometry(path, 42, .034, 10, false);
    const points = geometry.getAttribute('position'), colors: number[] = [];
    const center = new Vector3(), tangent = new Vector3(), p = new Vector3(), n = new Vector3();
    const glass = new Color('#b3d5d0'), aerated = new Color('#e9f2e8'), tint = new Color();
    const vx = Math.hypot(path.v2.x - path.v0.x, path.v2.z - path.v0.z) / flight;
    const vy = 2 * (path.v1.y - path.v0.y) / flight;
    for (let row = 0; row <= 42; row++) {
      const u = path.getUtoTmapping(row / 42, 0);
      path.getPoint(u, center);
      path.getTangent(u, tangent);
      // The falling water accelerates and narrows. Entrained air whitens
      // part of the descending strand without turning the arc into white pipe.
      const speed = Math.hypot(vx, vy - 9.81 * flight * u);
      const width = Math.sqrt(Math.hypot(vx, vy) / speed);
      for (let side = 0; side <= 10; side++) {
        const i = row * 11 + side;
        p.fromBufferAttribute(points, i).sub(center).multiplyScalar(width).add(center);
        points.setXYZ(i, p.x, p.y, p.z);
        tint.copy(glass).lerp(aerated, (.42 + .4 * Math.cos(side * tau / 10)) * u);
        colors.push(tint.r, tint.g, tint.b);
        n.fromBufferAttribute(geometry.getAttribute('normal'), i);
        for (let k = 0; k < 2; k++) {
          const phase = 25 * flight * u + .72 * Math.sin(side * tau / 10) + k * Math.PI / 2;
          const amplitude = .005 * u, dr = amplitude * Math.sin(phase);
          const gradient = -amplitude * 25 * Math.cos(phase) / speed;
          displacement[k].push(n.x * dr, n.y * dr, n.z * dr);
          slope[k].push(tangent.x * gradient, tangent.y * gradient, tangent.z * gradient);
        }
      }
    }
    geometry.setAttribute('color', new Float32BufferAttribute(colors, 3));
    parts.add(geometry);
  }
  const merged = parts.finish();
  merged.morphTargetsRelative = true;
  merged.morphAttributes.position = displacement.map(values => new Float32BufferAttribute(values, 3));
  merged.morphAttributes.normal = slope.map(values => new Float32BufferAttribute(values, 3));
  return merged;
}
