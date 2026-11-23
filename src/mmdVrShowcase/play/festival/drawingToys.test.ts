import { describe, expect, it } from 'vitest';
import { type BufferGeometry, InstancedMesh, Matrix4, Mesh, type MeshBasicMaterial, Vector3 } from 'three';
import type { GripFrame } from '../propView';
import { createConstellationInk } from './Constellation';
import { createRibbonInk } from './RibbonPen';
import { constellationGrip, constellationOutlet, makeSilkSpool, makeStarProjector, ribbonPenGrip, ribbonPenOutlet } from './drawingToyModels';

const frame=():GripFrame=>({at:new Vector3(.12,1.15,-.36),dir:new Vector3(0,0,-1),action:'start',usable:true,dt:1/60});
function pin(mesh:InstancedMesh,i:number){const m=new Matrix4();mesh.getMatrixAt(i,m);return new Vector3().setFromMatrixPosition(m);}

describe('three-pin astrolabe',()=>{
  it('copies actual distinct aim points, closing only its own triangle on the third press',()=>{
    const ink=createConstellationInk(),f=frame(),points:Vector3[]=[];
    const stars=ink.group.getObjectByName('constellation:stars:0') as InstancedMesh<BufferGeometry,MeshBasicMaterial>;
    const links=ink.group.getObjectByName('constellation:links:0') as InstancedMesh;
    for(let i=0;i<3;i++) {
      f.at.x+=i*.07;f.dir.set(i*.24,.1*(1-i*i),-1).normalize();
      points.push(f.at.clone().addScaledVector(f.dir,.68));f.action='start';ink.step(f);
      f.action='held';for(let j=0;j<30;j++)ink.step(f);
      expect(stars.count).toBe(i+1);expect(links.count).toBe([0,1,3][i]);
    }
    for(let i=0;i<3;i++) {
      expect(pin(stars,i).distanceTo(points[i])).toBeLessThan(1e-6);
      const m=new Matrix4();links.getMatrixAt(i,m);
      expect(new Vector3(0,-.5,0).applyMatrix4(m).distanceTo(points[i])).toBeLessThan(1e-6);
      expect(new Vector3(0,.5,0).applyMatrix4(m).distanceTo(points[(i+1)%3])).toBeLessThan(1e-6);
    }
    f.action='start';f.usable=false;ink.step(f);
    const second=ink.group.getObjectByName('constellation:stars:1') as InstancedMesh;expect(second.count).toBe(0);
    f.usable=true;ink.step(f);expect(second.count).toBe(1);
    f.action='off';f.dt=6;ink.step(f);expect(stars.visible).toBe(true);expect(stars.material.opacity).toBeLessThan(.98);
    f.dt=2;ink.step(f);expect(stars.count).toBe(0);expect(links.visible).toBe(false);expect(second.count).toBe(1);
    ink.dispose();
  });

  it('indexes a non-collinear map on an unmoving wrist, including vertical aim, while keeping storage bounded',()=>{
    const ink=createConstellationInk(),f=frame();f.dir.set(0,-1,0);
    for(let i=0;i<36;i++){f.action='start';ink.step(f);f.action='off';ink.step(f);}
    const stars=ink.group.getObjectByName('constellation:stars:0') as InstancedMesh;
    const a=pin(stars,0),b=pin(stars,1),c=pin(stars,2);
    expect(b.sub(a).cross(c.sub(a)).length()).toBeGreaterThan(.03);
    expect(ink.group.children).toHaveLength(8);expect(ink.group.children.every(o=>(o as InstancedMesh).count===3)).toBe(true);
    ink.dispose();
  });
});

// Read the displayed centre between the outer hem vertices of a live row.
function stripPoints(mesh:Mesh) {
  const g=mesh.geometry,pos=g.getAttribute('position'),r=g.drawRange;
  if(!r.count)return [];
  return Array.from({length:r.count/12+1},(_,i)=>{
    const k=4*(r.start/12+i);return new Vector3().fromBufferAttribute(pos,k).lerp(new Vector3().fromBufferAttribute(pos,k+3),.5);
  });
}

describe('continuous ribbon loom',()=>{
  it('weaves a two-colour folded sheet in 1.2 seconds at rest, and follows an actual detour of the wrist',()=>{
    const draw=(moving:boolean)=>{
      const ink=createRibbonInk(),f=frame(),origin=f.at.clone();ink.step(f);f.action='held';
      for(let i=1;i<=72;i++){if(moving)f.at.x=origin.x+.48*Math.sin(Math.PI*i/72);ink.step(f);}
      const mesh=ink.group.getObjectByName('ribbonPen:strip:0') as Mesh;
      const g=mesh.geometry,rows=stripPoints(mesh),mid=Math.floor(rows.length/2),pos=g.getAttribute('position'),colors=g.getAttribute('color');
      expect(mesh.visible).toBe(true);expect(rows.length).toBeGreaterThan(38);expect(rows[0].distanceTo(origin)).toBeLessThan(1e-6);
      const at=(j:number)=>new Vector3().fromBufferAttribute(pos,mid*4+j);
      expect(at(0).distanceTo(at(3))).toBeGreaterThan(.034);expect(at(1).distanceTo(at(2))).toBe(0);
      expect(at(1).distanceTo(rows[mid])).toBeGreaterThan(.003);expect(colors.getX(mid*4+1)).toBeGreaterThan(colors.getX(mid*4+2));
      f.action='off';ink.step(f);f.at.set(9,9,9);f.dt=3;ink.step(f);expect(stripPoints(mesh)).toEqual(rows);
      ink.dispose();return rows;
    };
    const still=draw(false),moving=draw(true);
    for(const axis of ['x','y','z'] as const){const coordinates=still.map(v=>v[axis]);expect(Math.max(...coordinates)-Math.min(...coordinates)).toBeGreaterThan(.115);}
    expect(Math.max(...moving.map((v,i)=>v.x-still[i].x))).toBeGreaterThan(.38);
  });

  it('keeps a long stroke sampled in order across buffer wrap; interruption seals it and aging retires it',()=>{
    const ink=createRibbonInk(),f=frame(),mesh=ink.group.getObjectByName('ribbonPen:strip:0') as Mesh<BufferGeometry,MeshBasicMaterial>;
    f.action='held';ink.step(f);expect(mesh.visible).toBe(false);
    f.action='start';ink.step(f);f.action='held';
    for(let i=0;i<670;i++){f.at.x+=.017;ink.step(f);}
    const rows=stripPoints(mesh);expect(rows).toHaveLength(144);expect(rows[0].x).toBeGreaterThan(6);
    for(let i=1;i<rows.length;i++){expect(rows[i].x).toBeGreaterThan(rows[i-1].x);expect(rows[i].distanceTo(rows[i-1])).toBeLessThan(.04);}
    f.usable=false;ink.step(f);f.usable=true;f.at.set(5,5,5);f.dt=4;ink.step(f);
    expect(stripPoints(mesh)).toEqual(rows);expect(ink.group.children.filter(o=>o.visible)).toHaveLength(1);
    f.dt=1.4;ink.step(f);expect(mesh.material.opacity).toBeGreaterThan(0);expect(mesh.material.opacity).toBeLessThan(.6);
    f.dt=1;ink.step(f);expect(mesh.visible).toBe(false);expect(mesh.geometry.drawRange.count).toBe(0);
    ink.dispose();
  });
});

it('places each actual exit at the front of one merged, vertex-painted hand piece',()=>{
  for(const [make,grip,outlet] of [[makeStarProjector,constellationGrip,constellationOutlet],[makeSilkSpool,ribbonPenGrip,ribbonPenOutlet]] as const){
    const g=make(),v=g.getAttribute('position');g.computeBoundingBox();
    expect(g.groups).toHaveLength(0);expect(g.getAttribute('color').count).toBe(v.count);
    expect(g.boundingBox!.min.z).toBeCloseTo(outlet.position[2],5);
    expect(g.boundingBox!.containsPoint(new Vector3(...grip.point))).toBe(true);
    let aperture=false,handle=false;
    for(let i=0;i<v.count;i++){
      const x=v.getX(i),y=v.getY(i),z=v.getZ(i);
      if(Math.abs(z-outlet.position[2])<.0001&&Math.hypot(x,y-outlet.position[1])<.020) aperture=true;
      if(Math.abs(y-grip.point[1])<.024&&Math.hypot(x,z-grip.point[2])<.020) handle=true;
    }
    expect(aperture&&handle).toBe(true);g.dispose();
  }
});
