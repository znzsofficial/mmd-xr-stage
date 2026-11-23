import {expect,it} from 'vitest';
import {Color,Group,Matrix4,Mesh,NoColorSpace,type BufferAttribute,type DataTexture,type MeshStandardMaterial} from 'three';
import {createPortDrawing} from './drawing';
import {createPelvicSolver,pelvicRailMatrix} from './geometry';
import {observedCut} from './atlas/exteriorStudy';
import {setAtlasView,useAtlasSettings} from './atlas/view';
import {createSealShell} from './vulvaMesh';
import {foldStyles,formColors,vulvaHalves} from './vulvaForm';

it('places two tapered wet arcs, a shaded root and matte pads on the drawn attachment, not in a lit colour overlay',()=>{
  const port=createPortDrawing(new Group(),'finish'),part=port.group.getObjectByName('pelvic:seal') as Mesh;
  const mat=part.material as MeshStandardMaterial,rough=mat.roughnessMap as DataTexture,uv=part.geometry.getAttribute('uv'),color=part.geometry.getAttribute('color');
  const {data,width:w,height:h}=rough.image;
  function site(side:number,y:number,k:number){const half=vulvaHalves[side<0?0:1],rows=half.rows;
    const j=rows.reduce((best,r,i)=>Math.abs(r.sites[0].station-y)<Math.abs(rows[best].sites[0].station-y)?i:best,0);
    return ((side<0?0:rows.length)+j)*formColors.length+k;}
  function sample(i:number){return data![4*(Math.floor(uv.getY(i)*h)*w+Math.floor(uv.getX(i)*w))+1]/255;}
  try{
    expect(mat.isMeshStandardMaterial&&mat.vertexColors).toBe(true);expect(mat.metalness).toBe(0);expect(mat.roughness).toBe(1);expect(mat.emissive.getHex()).toBe(0);
    expect(rough.colorSpace).toBe(NoColorSpace);expect(rough.generateMipmaps).toBe(true);
    const left=sample(site(-1,.38,6)),right=sample(site(1,-.56,6));
    expect(left).toBeLessThan(.32);expect(right).toBeLessThan(.60);
    expect(sample(site(1,.38,6))).toBeGreaterThan(left+.18);expect(sample(site(-1,-.56,6))).toBeGreaterThan(right+.11);
    for(const y of [-1,-.55,.38,.9])for(const side of [-1,1]){
      expect(sample(site(side,y,14))).toBeGreaterThan(.83);expect(sample(site(side,y,10))).toBeGreaterThan(.73);
    }
    const ink=(i:number)=>new Color().fromBufferAttribute(color as BufferAttribute,i).convertLinearToSRGB().multiplyScalar(255);
    // Independent mid-sheet swatches in display RGB: keep the plum root and
    // warm variation; neither a flat old palette nor a baked white stripe.
    const root=ink(site(-1,.38,9)),crest=ink(site(-1,.38,6)),pad=ink(site(-1,.38,14));
    expect(root.r).toBeLessThan(188);expect(root.g).toBeLessThan(119);expect(crest.g).toBeGreaterThan(root.g+37);
    expect(crest.g).toBeLessThan(187);expect(pad.g).toBeGreaterThan(198);
  }finally{port.dispose();}
});

it('matches the observed affine cut at every vertex, retaining UV, pigment and roughness across cuts and stationary draws',()=>{
  const id='finish',port=createPortDrawing(new Group(),id),mesh=port.group.getObjectByName('pelvic:seal') as Mesh,
    atlas=createSealShell(),g=mesh.geometry,at=(name:string)=>g.getAttribute(name) as BufferAttribute,
    tex=(mesh.material as MeshStandardMaterial).roughnessMap as DataTexture,bytes=tex.image.data!.slice();
  const frame={world:new Matrix4(),inverse:new Matrix4(),radiusM:.024,lengthM:.092,scale:1},solver=createPelvicSolver();
  const uvVersion=at('uv').version,roughVersion=tex.version;
  try{
    for(const style of foldStyles){setAtlasView(id,{foldStyle:style});solver.reset();
      for(const rim of ['elastic','right','off'] as const){
        let lastColor=-1;
        for(const mm of [-13,2,26,2,-13]){
          const rail=pelvicRailMatrix(frame,mm/1000);rail.elements[12]-=.004;const c=solver.step(frame,rail,{dt:1/72});
          port.draw(frame,true,false,c,rim);expect(mesh.visible&&port.group.visible).toBe(true);
          const sample={tip:c.outletLocal.toArray(),tail:c.shaftLocal[0].toArray(),shaft:c.shaftLocal.map(v=>v.toArray()),outletInside:c.outletInside,
            atCervix:c.atCervix,aligned:true,angleDeg:0,depth:c.depthM,radiusM:frame.radiusM,lengthM:frame.lengthM};
          atlas.fitCut(observedCut(sample),1,style,rim);
          const stagePos=at('position'),atlasPos=atlas.geom.getAttribute('position');let diff=0;
          for(let i=0;i<stagePos.array.length;i++)diff=Math.max(diff,Math.abs(stagePos.array[i]-atlasPos.array[i]*frame.radiusM));
          expect(diff).toBeLessThan(1e-8);expect(Buffer.from(at('color').array.buffer).equals(Buffer.from(atlas.geom.getAttribute('color').array.buffer))).toBe(true);
          if(lastColor!==-1)expect(at('color').version).toBe(lastColor);lastColor=at('color').version;
          const pv=stagePos.version,nv=at('normal').version;for(let n=0;n<3;n++)port.draw(frame,true,false,c,rim);
          expect(stagePos.version).toBe(pv);expect(at('normal').version).toBe(nv);expect(at('color').version).toBe(lastColor);
        }
      }
    }
    expect(Array.from(g.index!.array)).toEqual(Array.from(atlas.geom.index!.array));
    expect(at('uv').version).toBe(uvVersion);expect((mesh.material as MeshStandardMaterial).roughnessMap).toBe(tex);expect(tex.version).toBe(roughVersion);
    expect(Buffer.from(tex.image.data!.buffer).equals(Buffer.from(bytes.buffer))).toBe(true);
  }finally{port.dispose();atlas.geom.dispose();useAtlasSettings.setState({actors:{}});}
});
