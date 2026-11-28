import { Bone, BufferGeometry, DataTexture, Float32BufferAttribute, MeshBasicMaterial, Skeleton, SkinnedMesh, Uint16BufferAttribute } from 'three';
import { expect, it, vi } from 'vitest';
import { stockingDraws } from './stockingDraws';
import { inspectStockingFit } from './stockingFit';
import { stockingSourceCandidates, stockingSources } from './stockingSources';
import { publishGarmentKeys } from './slots';

// Deliberately no vertices at the knee or any of the former coverage bands.
// Both end rings skin to different bones; all the middle is real triangle area.
function actor(sections = [[.18,1.9]], withFeet = false) {
  const position: number[] = [], joints: number[] = [], weights: number[] = [], indices: number[] = [];
  const bones: Bone[] = [];
  for (const [side,prefix] of ['左','右'].entries()) {
    const x = side === 0 ? .3 : -.3;
    for (const [i,name] of ['足','ひざ','足首'].entries()) {
      const b = new Bone(); b.name = prefix+name; b.position.set(x,2-i,0); b.updateMatrixWorld(); bones.push(b);
    }
    for (const ends of sections) {
      const start = position.length/3;
      for (const y of ends) for (let k = 0; k < 8; k++) {
        const theta = k*Math.PI/4;
        position.push(x+.12*Math.sin(theta),y,.12*Math.cos(theta));
        joints.push(side*3+Number(y<1),0,0,0); weights.push(1,0,0,0);
      }
      for (let k = 0; k < 8; k++) {
        const a = start+k, b = start+(k+1)%8;
        indices.push(a,b,b+8,a,b+8,a+8);
      }
    }
    if (withFeet) {
      // Same toe bone on each side, but only the left mesh continues from
      // the ankle. The right has a detached forefoot in exactly the right spot.
      let upper = side === 0 ? 0 : -1;
      for (const z of [.07,.19,.30]) {
        const start = position.length/3;
        for (let k = 0; k < 8; k++) {
          const theta = k*Math.PI/4;
          position.push(x+.10*Math.sin(theta),.04+.06*Math.cos(theta),z);
          joints.push(side*3+2,0,0,0); weights.push(1,0,0,0);
        }
        if (upper >= 0) for (let k = 0; k < 8; k++) {
          const next = (k+1)%8;
          indices.push(start+k,start+next,upper+next,start+k,upper+next,upper+k);
        }
        upper = start;
      }
    }
  }
  if (withFeet) for (const [side,prefix] of ['左','右'].entries()) {
    const toe = new Bone(); toe.name = prefix+'つま先'; toe.position.set(side===0?.3:-.3,0,.31);
    toe.updateMatrixWorld(); bones.push(toe);
  }
  const g = new BufferGeometry(); g.setAttribute('position',new Float32BufferAttribute(position,3));
  g.setAttribute('skinIndex',new Uint16BufferAttribute(joints,4)); g.setAttribute('skinWeight',new Float32BufferAttribute(weights,4));
  g.setIndex(indices);
  const mat = new MeshBasicMaterial(), mesh = new SkinnedMesh(g,mat); mat.name = 'Skin'; mesh.bind(new Skeleton(bones));
  const fit = () => inspectStockingFit(mesh,stockingDraws({mesh,root:mesh,renderOrderMeshes:[]}));
  return { fit, mat, mesh };
}

it('fits the original long sparse faces on both legs without a toe bone or manufactured foot', () => {
  const {fit,mesh} = actor([[0,.10],[.75,1.9]]), result = fit();
  expect(result.reason).toBeNull(); expect(result.patches).toHaveLength(2);
  if (!result.patches) throw Error('missing leg patches');
  expect(result.foot).toEqual({left:false,right:false});
  for (const patch of result.patches) {
    expect(patch.indices.length).toBeGreaterThan(0);
    for (const i of patch.vertices) expect(mesh.geometry.attributes.position.getY(i)).toBeGreaterThanOrEqual(.75);
    expect(patch.rim.every(r => r.fraction >= 0 && r.fraction <= 1)).toBe(true);
  }
});

it('extends onto an authored instep on its own side, never to an isolated toe beyond a gap', () => {
  const {fit} = actor([[.31,1.9]],true), result = fit();
  expect(result.reason).toBeNull();
  if (!result.patches) throw Error('missing leg patches');
  expect(result.foot).toEqual({left:true,right:false});
  const right = result.patches.find(p => p.side === 'right')!;
  expect(right.vertices.every(i => right.draw.position.getZ(i) < .13)).toBe(true);
});

it.each(['Stockings','裤子'])('fits only the supported leg when its partner is an authored %s draw', garment => {
  const {mesh,mat,fit} = actor(), g = mesh.geometry;
  const clothing = new MeshBasicMaterial(); clothing.name = garment;
  const grouped: SkinnedMesh = mesh; grouped.material = [mat,clothing];
  const sideCount = g.index!.count/2;
  for (const side of ['left','right'] as const) {
    g.clearGroups(); g.addGroup(0,sideCount,side === 'left' ? 0 : 1);
    g.addGroup(sideCount,sideCount,side === 'right' ? 0 : 1);
    const result = fit();
    expect(result.patches?.map(p => p.side)).toEqual([side]);
    expect(result.patches?.[0].draw.author).toBe(mat);
    expect(result.patches?.[0].indices.length).toBeGreaterThan(0);
  }
});

it('rejects short isolated rings or a rig with missing or coincident leg anchors', () => {
  expect(actor([[.3,.5],[.7,.92],[1.1,1.4],[1.5,1.7]]).fit().reason).toBe('leg-coverage');
  const partial = actor(); partial.mesh.skeleton.bones[5].name = 'helper';
  expect(partial.fit().reason).toBe('leg-rig');
  const {mesh,fit} = actor(); mesh.skeleton.boneInverses[4].copy(mesh.skeleton.boneInverses[1]);
  expect(fit().reason).toBe('leg-rig');
});

it('honors the authored garment name over a Body alias and only counts drawn, nontransparent skin', () => {
  const {mesh,mat,fit} = actor();
  for (const name of ['Skin boots','Body_Stock_001','腿环','皮革','Stockings','裤子']) {
    mat.name = 'Body'; mat.userData.mmdMaterial = {name,englishName:'Body'};
    expect(fit().reason).toBe('no-surface');
  }
  mat.userData.mmdMaterial = {name:'腿'}; expect(fit().reason).toBeNull();
  publishGarmentKeys(mesh,['Body']); expect(fit().reason).toBe('no-surface'); publishGarmentKeys(mesh,[]);
  mat.visible = false; expect(fit().reason).toBe('no-surface'); mat.visible = true;
  const count = mesh.geometry.attributes.position.count;
  mesh.geometry.setAttribute('uv',new Float32BufferAttribute(new Float32Array(count*2),2));
  const pixel = new Uint8Array([255,255,255,0]); mat.map = new DataTexture(pixel,1,1); mat.transparent = true;
  expect(fit().reason).toBe('leg-coverage'); pixel[3] = 255; expect(fit().reason).toBeNull();
});

it('can corroborate an independent whole-body slot sharing the clothing atlas, but never borrows the clothes’ weights', () => {
  const {mesh,mat,fit} = actor(), g = mesh.geometry, pants = new MeshBasicMaterial();
  mat.name = 'Body'; pants.name = 'Pants';
  mat.userData.mmdMaterial = pants.userData.mmdMaterial = {texturePath:'atlas.png'};
  const count = g.index!.count, last = g.attributes.position.count;
  for (const name of ['上半身','左親指１']) { const b = new Bone(); b.name=name; mesh.skeleton.bones.push(b); }
  const data = Array.from(g.attributes.position.array); data.push(0,3,0,1,3,0,0,3,1);
  const skinIndex = Array.from(g.attributes.skinIndex.array); skinIndex.push(6,0,0,0,7,0,0,0,6,0,0,0);
  const skinWeight = Array.from(g.attributes.skinWeight.array); skinWeight.push(1,0,0,0,1,0,0,0,1,0,0,0);
  g.setAttribute('position',new Float32BufferAttribute(data,3)); g.setAttribute('skinIndex',new Uint16BufferAttribute(skinIndex,4));
  g.setAttribute('skinWeight',new Float32BufferAttribute(skinWeight,4));
  g.setIndex([...Array.from(g.index!.array),last,last+1,last+2,last,last+1,last+2]);
  const grouped: SkinnedMesh = mesh; grouped.material = [mat,pants];
  g.addGroup(0,count,0); g.addGroup(count,6,1);
  expect(fit().reason).toBe('no-surface');
  g.clearGroups(); g.addGroup(0,count+3,0); g.addGroup(count+3,3,1);
  expect(fit().patches?.every(p => p.draw.author === mat)).toBe(true);
  const draws = stockingDraws({mesh,root:mesh,renderOrderMeshes:[]});
  const reads = vi.spyOn(g.attributes.skinWeight,'getComponent'), candidates = stockingSourceCandidates(mesh,draws);
  expect(reads).toHaveBeenCalled(); reads.mockClear();
  mat.visible = false; expect(stockingSources(mesh,draws)).toEqual([]);
  mat.visible = true; publishGarmentKeys(mesh,['Body']); expect(stockingSources(mesh,draws)).toEqual([]);
  publishGarmentKeys(mesh,[]); expect(stockingSources(mesh,draws)).toEqual(candidates);
  expect(stockingSourceCandidates(mesh,draws)).toBe(candidates); expect(reads).not.toHaveBeenCalled(); reads.mockRestore();
});
