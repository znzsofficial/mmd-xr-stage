import { expect,it,vi } from 'vitest';
import { Mesh, MeshBasicMaterial, Group, PlaneGeometry, Texture, Scene, PerspectiveCamera, type WebGLRenderer } from 'three';
import { createPlacementWork } from '../../diagnostics/placementWork';
import { prepareModelGpu } from './prepareModelGpu';

it('attributes one upload for two meshes sharing a material and measures elapsed yields apart from driver calls',async()=>{
  const map=new Texture({width:8,height:8} as HTMLImageElement), mat=new MeshBasicMaterial({map}), geo=new PlaneGeometry(),root=new Group();
  root.add(new Mesh(geo,mat),new Mesh(geo,mat)); const work=createPlacementWork();let now=0;
  vi.useFakeTimers();const clock=vi.spyOn(performance,'now').mockImplementation(()=>now);
  const gl={initTexture:vi.fn(()=>{now+=4;}),extensions:{has:()=>true},xr:{isPresenting:false},compileAsync:vi.fn(async()=>{now+=9;})};
  try {const job=prepareModelGpu(gl as unknown as WebGLRenderer,new Scene(),new PerspectiveCamera(),root,()=>false,work);now+=17;await vi.runAllTimersAsync();await job;
    expect(work).toMatchObject({textureCount:1,initTextureCpuMs:4,maxInitTextureCpuMs:4,yieldWallMs:17,compileAsyncWallMs:9});
    expect(gl.initTexture).toHaveBeenCalledOnce();
  }finally{clock.mockRestore();vi.useRealTimers();mat.dispose();geo.dispose();map.dispose();}
});
