import {Float32BufferAttribute,Uint16BufferAttribute,Vector3} from 'three';
import {expect,it} from 'vitest';
import {makeOutletFixture} from './outletFixture.test-support';
import {createMilkOutlets} from './outlets';

// PMX face order is chosen by the author, not a spatial index. Millions of
// vertices aren't necessary to reproduce the real false negative: enough
// interleaved faces on opposite sides give every index-order leaf a wide box.
it('rejects distant garment panels before the face budget while still finding a moving cover among them',()=>{
  const {model,cloth,bones}=makeOutletFixture(),g=model.mesh.geometry;
  for(const name of ['position','normal','skinIndex','skinWeight']){
    const attr=g.getAttribute(name),values=Array.from(attr.array);
    for(const x of [-1,1])for(const [dx,dy] of [[0,0],[.01,0],[0,.02]]){
      values.push(...(name==='position'?[x+dx,1.35+dy,.13]:name==='normal'?[0,0,1]:name==='skinIndex'?[2,0,0,0]:[1,0,0,0]));
    }
    g.setAttribute(name,name==='skinIndex'?new Uint16BufferAttribute(values,4):new Float32BufferAttribute(values,attr.itemSize));
  }
  const offsets=g.morphAttributes.position![0];g.morphAttributes.position![0]=new Float32BufferAttribute([...offsets.array,...Array(18).fill(0)],3);
  const indices=Array.from(g.index!.array),cover=indices.splice(-3),first=g.attributes.position.count-6;
  for(let i=0;i<25_000;i++){
    const a=first+(i%2)*3;indices.push(a,a+1,a+2);
  }
  indices.push(...cover);g.setIndex(indices);g.groups[1].count=indices.length-g.groups[1].start;
  // Start with the small moving cover between the two outlets instead of
  // over the left one. Only it will move into the left ray on the next pose.
  cloth.visible=true;bones[2].position.x=-.1;model.root.updateMatrixWorld(true);
  const sample=createMilkOutlets(model),p=new Vector3(),n=new Vector3();
  expect(sample('left',p,n)).toBe(true);expect(sample('right',p,n)).toBe(true);
  bones[2].position.x=0;model.root.updateMatrixWorld(true);
  expect(sample('left',p,n)).toBe(false);expect(sample('right',p,n)).toBe(true);
});
