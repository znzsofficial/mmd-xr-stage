import { expect,it } from 'vitest';
import { Bone, BufferAttribute, Float32BufferAttribute, Group, Matrix4, Mesh, MeshStandardMaterial, PlaneGeometry, Raycaster, Skeleton, SkinnedMesh, Texture, Uint16BufferAttribute, Vector3 } from 'three';
import { createPortDrawing } from './drawing';
import { createPelvicSolver, pelvicRailMatrix, type PelvicFrame } from './geometry';
import { rod, rodRadii } from './path';
import { formColors, rimSamples, vulvaHalves } from './vulvaForm';

it('forms distinct paired crests and returns the actual mesh buffers to their resting folds after a crossing',()=>{
  const f:PelvicFrame={world:new Matrix4(),inverse:new Matrix4(),radiusM:.024,lengthM:.092,scale:1};
  const host=new Group(),port=createPortDrawing(host,'adult'),shell=port.group.getObjectByName('pelvic:seal') as Mesh;
  const solver=createPelvicSolver(),step=(d:number,dx=.002)=>{
    const m=pelvicRailMatrix(f,d);m.elements[12]+=dx;const contact=solver.step(f,m,{dt:1/72});
    port.draw(f,true,false,contact);return contact;
  };
  const g=shell.geometry,pos=g.getAttribute('position') as BufferAttribute,norm=g.getAttribute('normal') as BufferAttribute;
  const point=(h:number,r:number,k:number)=>new Vector3().fromBufferAttribute(pos,(h*vulvaHalves[0].rows.length+r)*formColors.length+k);
  try{
    step(-.008);const rest=pos.array.slice(),normal=norm.array.slice();
    for(const [h,{rows,side}] of vulvaHalves.entries()){
      const m=rows.findIndex(r=>Math.abs(r.sites[0].y)<1e-8),section=rows[m].sites.map((_,i)=>point(h,m,i));
      const crests=section.filter((p,i)=>i>0&&i+1<section.length&&p.z>section[i-1].z&&p.z>section[i+1].z);
      expect(crests).toHaveLength(2);
      const [minor,major]=crests;expect(major.x*side-minor.x*side).toBeGreaterThan(.7*f.radiusM);
      const valley=Math.min(...section.filter(p=>(p.x-minor.x)*side>0&&(major.x-p.x)*side>0).map(p=>p.z));
      expect(Math.min(minor.z,major.z)-valley).toBeGreaterThan(.28*f.radiusM);
      // The seam rises into the anterior hood and the shallower posterior bridge.
      const peaks=[1,-1].map(dir=>Math.max(...rows.map((r,i)=>r.sites[0].y*dir>.7?point(h,i,0).z:0)));
      expect(peaks[0]).toBeGreaterThan(1.3*peaks[1]);expect(peaks[1]).toBeGreaterThan(.10*f.radiusM);
    }
    // Check a shallow crown and a fuller shaft. Coordinates come from the
    // manufactured segment crossing the calibrated plane, not an openness.
    for(const d of [.001,.012,.036]){
      const contact=step(d),s=contact.shaftLocal,j=s.findIndex(v=>v.z<=0);expect(contact.inside).toBe(true);
      const a=s[j-1],b=s[j],u=a.z/(a.z-b.z),center=a.clone().lerp(b,u),dir=b.clone().sub(a),r=(rodRadii[j-1]+u*(rodRadii[j]-rodRadii[j-1]))*dir.length()/rod[j].distanceTo(rod[j-1]);
      dir.normalize();let n=0;
      for(const [h,half] of vulvaHalves.entries())half.rows.forEach((row,k)=>{
        if(row.sites[0].weight!==1)return;
        const p=point(h,k,0);expect(p.z).toBe(0);expect(p.sub(center).cross(dir).length()).toBeCloseTo(r,6);n++;
      });expect(n).toBe(rimSamples+2);
    }
    const held=pos.version,normalVersion=norm.version;for(let i=0;i<6;i++)step(.036);
    expect(pos.version).toBe(held);expect(norm.version).toBe(normalVersion);
    step(.036,.006);expect(pos.version).toBeGreaterThan(held); // same radius, changed centre
    solver.reset();step(.036);expect(pos.array).toEqual(rest);expect(norm.array).toEqual(normal);
    const reset=pos.version;step(-.010);expect(pos.version).toBe(reset);
    expect(g.getAttribute('position')).toBe(pos);expect(g.getAttribute('normal')).toBe(norm);
  }finally{port.dispose();}
});

it('beds the soft margin into a fitted skin plane and exposes that same uncut PMX surface through the admitted opening',()=>{
  const f:PelvicFrame={world:new Matrix4(),inverse:new Matrix4(),radiusM:.024,lengthM:.092,scale:1};
  const host=new Group(),map=new Texture(),mat=new MeshStandardMaterial({color:'#ad8f89',roughness:.81,roughnessMap:map});
  const skin=new SkinnedMesh(new PlaneGeometry(.25,.25),mat),bone=new Bone();
  const quad=skin.geometry.getAttribute('position') as BufferAttribute,weights=new Float32BufferAttribute(quad.count*4,4);
  for(let i=0;i<quad.count;i++)weights.setX(i,1);
  skin.geometry.setAttribute('skinIndex',new Uint16BufferAttribute(quad.count*4,4));skin.geometry.setAttribute('skinWeight',weights);
  skin.add(bone);skin.bind(new Skeleton([bone]));skin.position.z=-.002;host.add(skin);host.updateMatrixWorld(true);
  const port=createPortDrawing(host,'fitted'),shell=port.group.getObjectByName('pelvic:seal') as Mesh;
  const finish=(shell.material as MeshStandardMaterial).roughnessMap!,version=finish.version;
  let skinDisposals=0,ownedDisposals=0;map.addEventListener('dispose',()=>skinDisposals++);finish.addEventListener('dispose',()=>ownedDisposals++);
  const ray=new Raycaster(new Vector3(.002,0,.1),new Vector3(0,0,-1)),solver=createPelvicSolver();
  const view=(d:number)=>{port.draw(f,true,false,solver.step(f,pelvicRailMatrix(f,d),{dt:.015}));return ray.intersectObjects([shell,skin],false)[0]?.object;};
  try{
    expect(view(-.01)).toBe(shell);expect(view(.014)).toBe(skin);expect(view(-.009)).toBe(shell);
    const pos=shell.geometry.getAttribute('position'),n=formColors.length;
    for(let i=n-1;i<pos.count;i+=n)expect(pos.getZ(i)).toBeLessThan(skin.position.z);
    expect(quad.version).toBe(0);expect(weights.version).toBe(0);expect(skin.material).toBe(mat);
    expect(mat.color.getHexString()).toBe('ad8f89');expect(mat.roughness).toBe(.81);expect(mat.roughnessMap).toBe(map);
    expect(map.version).toBe(0);expect(finish).not.toBe(map);expect(finish.version).toBe(version);
  }finally{port.dispose();skin.skeleton.dispose();skin.geometry.dispose();skin.material.dispose();}
  expect(ownedDisposals).toBe(1);expect(skinDisposals).toBe(0);map.dispose();
});
