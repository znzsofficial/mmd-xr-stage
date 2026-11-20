import { BufferGeometry, Color, ExtrudeGeometry, Float32BufferAttribute, IcosahedronGeometry, Path, QuadraticBezierCurve3, Shape, Vector3 } from 'three';
import { ROOM, WINDOWS } from './ClassroomLayout';

type V = [number, number, number];
function mesh(pos: number[], idx: number[], rgb?: number[]) {
  const geo = new BufferGeometry(); geo.setAttribute('position', new Float32BufferAttribute(pos, 3)); geo.setIndex(idx);
  if (rgb) geo.setAttribute('color', new Float32BufferAttribute(rgb, 3));
  geo.computeVertexNormals(); return geo;
}

// Cross sections only where the tube bends: straight furniture legs take
// two rings, while the return under a seat gets a real rounded outside edge.
function tubeFrame(paths: V[][], radius: number) {
  const pos: number[] = [], idx: number[] = [], rgb: number[] = [], sides = 7;
  for (const path of paths) {
    const pts = path.map(v => new Vector3(...v)), nodes = [pts[0]];
    for (let i = 1; i < pts.length - 1; i++) {
      const p = pts[i], d0 = pts[i - 1].clone().sub(p), d1 = pts[i + 1].clone().sub(p);
      const r = Math.min(.055, d0.length() * .4, d1.length() * .4);
      const a = p.clone().add(d0.setLength(r)), b = p.clone().add(d1.setLength(r));
      nodes.push(...new QuadraticBezierCurve3(a, p, b).getPoints(3));
    }
    nodes.push(pts[pts.length - 1]);
    // Ferrules and dark vinyl glides are rings of the existing tube, not 128
    // separately drawn caps. The contact stamp is centred on the same foot.
    for (const end of [0,1]) {
      const n=end ? nodes.length-1 : 0, foot=nodes[n];
      if(foot.y!==.012) continue;
      const next=nodes[end?n-1:1], dir=next.clone().sub(foot);
      const rings=[.0015,.031,.033].map(y=>foot.clone().addScaledVector(dir,(y-foot.y)/dir.y));
      nodes.splice(n,1,...(end?rings.reverse():rings));
    }
    const offset = pos.length / 3;
    let transverse = new Vector3(1, 0, 0);
    nodes.forEach((p, i) => {
      const axis = nodes[Math.min(i + 1, nodes.length - 1)].clone().sub(nodes[Math.max(0, i - 1)]).normalize();
      if (Math.abs(axis.dot(transverse)) > .99) transverse = new Vector3(0, 0, 1);
      const b = axis.clone().cross(transverse).normalize(); transverse = b.clone().cross(axis).normalize();
      for (let k = 0; k < sides; k++) {
        const a = k * 2 * Math.PI / sides;
        const boot=p.y<.0325, r=radius*(boot?1.20:1);
        pos.push(...p.clone().addScaledVector(transverse,r*Math.cos(a)).addScaledVector(b,r*Math.sin(a)).toArray());
        rgb.push(...(boot?[.19,.20,.205]:[1,1,1]));
        if (!i) continue;
        const v = offset + i * sides + k, u = offset + i * sides + (k + 1) % sides;
        idx.push(v - sides, u - sides, v, v, u - sides, u);
      }
    });
  }
  return mesh(pos, idx,rgb);
}
export function deskFrame() {
  const paths: V[][] = [];
  for (const s of [-1, 1]) paths.push([[s * .366, .012, -.224], [s * .342, .696, -.20],
    [s * .342, .696, .19], [s * .367, .012, .219]]);
  for (const z of [-.18, .17]) paths.push([[-.34, .678, z], [.34, .678, z]]);
  paths.push([[-.348, .32, -.207], [.348, .32, -.207]]);
  return tubeFrame(paths, .015);
}
export function chairFrame() {
  const paths: V[][] = [];
  for (const s of [-1, 1]) {
    paths.push([[s * .20, .012, -.207], [s * .173, .408, -.156], [s * .176, .408, .129], [s * .175, .730, .213]]);
    paths.push([[s * .21, .012, .224], [s * .175, .405, .127]]);
  }
  paths.push([[-.178, .390, -.13], [.178, .390, -.13]], [[-.176, .393, .129], [.176, .393, .129]]);
  return tubeFrame(paths, .013);
}
function rounded(path: Shape | Path, l: number, b: number, r: number, t: number, k: number) {
  path.moveTo(l + k, b); path.lineTo(r - k, b); path.quadraticCurveTo(r, b, r, b + k);
  path.lineTo(r, t - k); path.quadraticCurveTo(r, t, r - k, t); path.lineTo(l + k, t);
  path.quadraticCurveTo(l, t, l, t - k); path.lineTo(l, b + k); path.quadraticCurveTo(l, b, l + k, b);
}
// Unit tabletop prototype, including a thin bullnose around the edge. This
// can be scaled to a chair seat without needing a second furniture material.
export function woodSlab() {
  const shape = new Shape(); rounded(shape, -.493, -.492, .493, .492, .071);
  const geo = new ExtrudeGeometry(shape, {depth: .015, curveSegments: 2, bevelEnabled: true, bevelThickness: .004, bevelSize: .007, bevelSegments: 1});
  const uv=geo.attributes.uv,pos=geo.attributes.position,n=geo.attributes.normal,cut=[];
  for(let i=0;i<pos.count;i++) {
    uv.setXY(i,pos.getX(i)+.5,pos.getY(i)+.5);
    // Classify before scaling the prototype to stock thickness. Only the flat
    // cap carries the face veneer; the roundover belongs to the edge tape.
    cut.push(Math.abs(n.getZ(i))>.995?0:Math.abs(n.getX(i))>Math.abs(n.getY(i))?2:1);
  }
  geo.setAttribute('classCut',new Float32BufferAttribute(cut,1));
  geo.translate(0, 0, -.0075); geo.scale(1, 1, 1 / .023); return geo.rotateX(-Math.PI / 2);
}
export function chairBack() {
  const panel = new Shape(); rounded(panel, -.22, -.096, .22, .096, .034);
  const grip = new Path(); rounded(grip, -.071, .031, .071, .064, .015); panel.holes.push(grip);
  const geo = new ExtrudeGeometry(panel, { depth: .012, curveSegments: 3, bevelEnabled: true, bevelSize: .0025, bevelThickness: .003, bevelSegments: 1 });
  const pos = geo.attributes.position, normals=geo.attributes.normal, uv=geo.attributes.uv, cut=[], normal=new Vector3();
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), y = pos.getY(i);
    normal.fromBufferAttribute(normals,i);
    cut.push(Math.abs(normal.z)>.995?0:1);uv.setXY(i,x/.44+.5,y/.192+.5);
    normal.set(normal.x+1.10*x*normal.z,normal.y-.17*normal.z,normal.z).normalize();
    normals.setXYZ(i,normal.x,normal.y,normal.z);
    pos.setXYZ(i, x, y + .72, .191 + pos.getZ(i) + y * .17 - x * x * .55);
  }
  geo.setAttribute('classCut',new Float32BufferAttribute(cut,1));return geo;
}

export function classroomCurtains() {
  const pos: number[] = [], idx: number[] = [], rgb: number[] = [], tint = new Color();
  WINDOWS.forEach(({z, width}, i) => {
    // One pulled panel per bay. Gather high enough to see the courtyard from
    // a seated position, open out again below the tie and scallop at the hem.
    const N = 24, M = 16, offset = pos.length / 3;
    for (let j = 0; j <= M; j++) {
      const v = j / M, gather = Math.exp(-(((v - .60) / .15) ** 2));
      const breadth = .63 - .32 * gather + .09 * Math.sin(i * 2);
      for (let k = 0; k <= N; k++) {
        const u = k / N, fold = u * Math.PI * 9 + .48 * Math.sin(v * 4.1 + u * 1.9 + i), wave = Math.cos(fold);
        const x = -ROOM.w / 2 + .18 + (.047 + .022 * v) * wave + .042 * v;
        const y = 3.20 - 2.26 * v + .045 * v ** 3 * Math.sin(fold + i);
        pos.push(x, y, z - width / 2 + .095 + u * breadth - .03 * gather);
        tint.set(v > .551 && v < .643 ? '#b79c68' : '#f4e8cf').multiplyScalar(.79 + .19 * wave + .07 * v);
        rgb.push(tint.r, tint.g, tint.b);
        if (j && k) { const b = offset + j * (N + 1) + k; idx.push(b - N - 2, b - N - 1, b, b - N - 2, b, b - 1); }
      }
    }
  });
  return mesh(pos, idx, rgb);
}

export function canopyCluster() {
  const geo = new IcosahedronGeometry(.5, 1), pos = geo.attributes.position, rgb = [];
  // Sky-facing flecks and cool undersides break up the large crown masses.
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
    const grain = .06 * Math.sin(x*22+y*19) * Math.cos(z*21);
    const value = .77 + .37*y + grain;
    rgb.push(value + .035*y, value, value + .10*(.3-y));
    pos.setXYZ(i,x*(1+grain),y*(1+grain*1.5),z*(1-grain));
  }
  geo.setAttribute('color',new Float32BufferAttribute(rgb,3)); return geo;
}
