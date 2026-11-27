import { describe, expect, it } from 'vitest';
import { Mesh, MeshPhongMaterial, Object3D, Vector3 } from 'three';
import { fountainCourt } from '../parkLayout';
import { fountainMetal, fountainSpouts, fountainStone, fountainStreams, waterline } from './fountainGeometry';
import { dropCount, fountainSurface, setDropPose, setWavePhase } from './fountainWater';

describe('park fountain in metres, from the local ground', () => {
  it('keeps opaque geometry inside the park sightline tiers and the placement exclusion', () => {
    const stone = fountainStone(), bronze = fountainMetal();
    let maxRadius = 0, rimY = 0, topY = 0, spoutY = 0;
    for (const g of [stone, bronze]) {
      const p = g.getAttribute('position');
      for (let i = 0; i < p.count; i++) {
        const r = Math.hypot(p.getX(i), p.getZ(i)), y = p.getY(i);
        maxRadius = Math.max(maxRadius, r);
        if (r > 2.4) rimY = Math.max(rimY, y);
        if (g === stone && r < .5) topY = Math.max(topY, y);
        if (y > .601) { expect(r).toBeLessThan(.64); spoutY = Math.max(spoutY, y); }
      }
      g.dispose();
    }
    expect(maxRadius).toBeCloseTo(fountainCourt.radius, 5);
    expect(rimY).toBeCloseTo(.46, 5);
    expect(topY).toBeCloseTo(.60, 5);
    expect(spoutY).toBeGreaterThan(1.75);
    expect(spoutY).toBeLessThan(1.78);
  });

  it('carries three separate jets from their bronze lips to distinct points at the waterline', () => {
    const jets = fountainStreams(), p = jets.getAttribute('position');
    const section = p.count / fountainSpouts.length;
    const ringCenter = (offset: number) => {
      const sum = new Vector3(), v = new Vector3();
      for (let i = 0; i < 10; i++) sum.add(v.fromBufferAttribute(p, offset + i));
      return sum.multiplyScalar(.1);
    };
    for (const [i, { mouth, impact, path }] of fountainSpouts.entries()) {
      expect(ringCenter(i * section).distanceTo(mouth)).toBeLessThan(1e-5);
      expect(ringCenter((i+1) * section - 11).distanceTo(impact)).toBeLessThan(1e-5);
      expect(impact.y).toBe(waterline);
      expect(Math.max(...path.getPoints(40).map(p => p.y))).toBeGreaterThan(mouth.y + .20);
      expect(impact.distanceTo(fountainSpouts[(i+1)%3].impact)).toBeGreaterThan(2.4);
    }
    jets.dispose();
  });

  it('moves the actual water vertices and reflected normals, with the ripple crest following the impact outwards', () => {
    const geometry = fountainSurface(), mesh = new Mesh(geometry, new MeshPhongMaterial()), p = geometry.getAttribute('position');
    const {impact} = fountainSpouts[0];
    function closest(x: number, z: number) {
      let index = 0, distance = Infinity;
      for (let i = 0; i < p.count; i++) {
        const d = Math.hypot(p.getX(i)-x,p.getZ(i)-z);
        if (d < distance) { index = i; distance = d; }
      }
      return index;
    }
    const a = closest(impact.x+.12,impact.z), b = closest(impact.x+.34,impact.z);
    const heights: number[][] = [[], []];
    let firstNormal = new Vector3(), maxBend = 0;
    for (let frame = 0; frame < 150; frame++) {
      const weights = mesh.morphTargetInfluences!;
      setWavePhase(weights, frame/90);
      [a,b].forEach((index,i) => heights[i].push(mesh.getVertexPosition(index, new Vector3()).y));
      const n = new Vector3(0,1,0);
      geometry.morphAttributes.normal!.forEach((attr,k) => n.addScaledVector(new Vector3().fromBufferAttribute(attr,a), weights[k]));
      if (frame === 0) firstNormal = n.clone();
      maxBend = Math.max(maxBend, n.angleTo(firstNormal));
    }
    expect(Math.max(...heights[0]) - Math.min(...heights[0])).toBeGreaterThan(.018);
    expect(maxBend).toBeGreaterThan(.21);
    // The nearby crest moves at 8.4 / 15.8 m/s. Compare the same rising
    // zero crossing, rather than finding the brightest unrelated specular lobe.
    const rising = (samples: number[]) => samples.findIndex((v,i) => i>0 && samples[i-1]<waterline && v>=waterline);
    const near = rising(heights[0]);
    const far = rising(heights[1].slice(near + 1));
    expect(near).toBeGreaterThanOrEqual(0);
    expect(far).toBeGreaterThan(15);
    expect(far).toBeLessThan(58);
    geometry.dispose();
    mesh.material.dispose();
  });

  it('moves spray in stage time and returns each impact droplet to its own splash patch', () => {
    const pose = new Object3D();
    for (const i of [13,47,81]) {
      setDropPose(pose,i,.1);
      const before = pose.position.clone();
      setDropPose(pose,i,.18);
      expect(pose.position.distanceTo(before)).toBeGreaterThan(.02);
      for (let k = 0; k < 60; k++) {
        setDropPose(pose,i,k/60);
        const { impact } = fountainSpouts[Math.floor(i/(dropCount/3))];
        expect(pose.position.y).toBeGreaterThanOrEqual(waterline);
        expect(Math.hypot(pose.position.x-impact.x,pose.position.z-impact.z)).toBeLessThan(.36);
      }
      setDropPose(pose,i,.1);
      expect(pose.position.distanceTo(before)).toBe(0);
    }
  });
});
