import { BufferGeometry, Float32BufferAttribute, Object3D } from 'three';
import { fountainSpouts, waterline } from './fountainGeometry';

const tau = Math.PI * 2;

function waveHeight(x: number, z: number, mode: number) {
  // Sine/cosine partners are combined at draw time, so the crests travel
  // outwards from the stream ends, rather than pumping up and down in place.
  const shift = (mode % 2) * Math.PI / 2;
  if (mode >= 2) {
    return .006 * Math.sin(6.8 * x - 5.7 * z + .72 * Math.sin(2.1 * z) + shift)
      + .003 * Math.sin(9.4 * z + 2.7 * x + shift);
  }
  let height = 0;
  for (const { impact, bearing } of fountainSpouts) {
    const d = Math.sqrt((x - impact.x) ** 2 + (z - impact.z) ** 2 + .0025);
    height += .015 * Math.sin(15.8 * d + bearing + shift) / (1 + 3.2 * d * d);
  }
  return height;
}

export function fountainSurface() {
  // A square-to-disc grid keeps comparable sampling density near every
  // splash. A polar grid would waste almost all of its detail under the plinth.
  const cells = 56, positions: number[] = [], normals: number[] = [], indices: number[] = [];
  for (let j = 0; j <= cells; j++) {
    for (let i = 0; i <= cells; i++) {
      const u = 2 * i / cells - 1, v = 2 * j / cells - 1;
      positions.push(2.468 * u * Math.sqrt(1 - v * v / 2), waterline, 2.468 * v * Math.sqrt(1 - u * u / 2));
      normals.push(0, 1, 0);
      if (i < cells && j < cells) {
        const a = j * (cells + 1) + i, b = a + cells + 1;
        indices.push(a, b, a + 1, b, b + 1, a + 1);
      }
    }
  }
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new Float32BufferAttribute(positions, 3));
  geometry.setAttribute('normal', new Float32BufferAttribute(normals, 3));
  geometry.setIndex(indices);
  geometry.morphTargetsRelative = true;
  geometry.morphAttributes.position = [];
  geometry.morphAttributes.normal = [];
  for (let mode = 0; mode < 4; mode++) {
    const heights: number[] = [], slopes: number[] = [];
    for (let i = 0; i < positions.length; i += 3) {
      const x = positions[i], z = positions[i + 2], step = .003;
      heights.push(0, waveHeight(x, z, mode), 0);
      slopes.push((waveHeight(x - step, z, mode) - waveHeight(x + step, z, mode)) / (2 * step), 0,
        (waveHeight(x, z - step, mode) - waveHeight(x, z + step, mode)) / (2 * step));
    }
    geometry.morphAttributes.position.push(new Float32BufferAttribute(heights, 3));
    geometry.morphAttributes.normal.push(new Float32BufferAttribute(slopes, 3));
  }
  return geometry;
}

export function setWavePhase(weights: number[], seconds: number) {
  weights[0] = Math.cos(8.4 * seconds);
  weights[1] = -Math.sin(8.4 * seconds);
  weights[2] = Math.cos(3.15 * seconds);
  weights[3] = -Math.sin(3.15 * seconds);
}

const dropsPerSpout = 34;
export const dropCount = dropsPerSpout * fountainSpouts.length;

// Moving glints ride the stream, separate drops rebound from its point of
// impact, and short-lived patches of bubbles drift out over the waves.
export function setDropPose(pose: Object3D, index: number, seconds: number) {
  const { path, impact, flight, bearing } = fountainSpouts[Math.floor(index / dropsPerSpout)];
  const i = index % dropsPerSpout;
  const phase = (index * .61803398875) % 1, angle = index * 2.399963;
  const dx = Math.cos(angle), dz = Math.sin(angle);
  pose.rotation.set(0, 0, 0);
  if (i < 12) {
    const u = (seconds / flight + phase) % 1;
    path.getPoint(u, pose.position);
    const radius = .022 + .053 * u * u;
    pose.position.x += dx * radius;
    pose.position.z += dz * radius;
    const size = (.010 + .007 * phase + .005 * u) * Math.min(1, 12 * u);
    const speedY = 2 * (path.v1.y - path.v0.y) / flight - 9.81 * flight * u;
    const speedXZ = Math.hypot(impact.x - path.v0.x, impact.z - path.v0.z) / flight;
    pose.rotation.order = 'YXZ';
    pose.rotation.y = Math.PI / 2 - bearing;
    pose.rotation.x = Math.atan2(speedXZ, speedY);
    pose.scale.set(size, size * (1.65 + 1.3 * u), size);
  } else if (i < 26) {
    const duration = .21 + .24 * phase, age = (seconds + phase) % duration;
    const travel = (.26 + .51 * phase) * age;
    pose.position.set(impact.x + dx * travel, waterline + .009 + 4.905 * age * (duration - age), impact.z + dz * travel);
    const size = (.011 + .009 * phase) * Math.min(1, 22 * age, 22 * (duration - age));
    pose.scale.set(size, size * 1.25, size);
  } else {
    const age = (seconds * (.85 + phase * .4) + phase) % 1;
    const r = .026 + age * (.16 + .13 * phase);
    pose.position.set(impact.x + dx * r, waterline + .013 + .005 * Math.sin(tau * age + angle), impact.z + dz * r);
    const size = (.037 + .023 * phase) * Math.sin(Math.PI * age);
    pose.scale.set(size * 1.3, size * .34, size);
  }
  pose.updateMatrix();
}
