import { BoxGeometry, Mesh } from 'three';
import { expect, it } from 'vitest';
import { modelDrawRange } from './modelDrawRange';

it('reads each proxy independently of the shared split body, including an empty proxy',()=>{
  const geometry=new BoxGeometry(),body=new Mesh(geometry),outline=new Mesh(geometry),empty=new Mesh(geometry);
  body.userData.mmdMorphSplitBody={materialIndex:1};
  outline.userData.mmdOutlineProxy={sourceMaterialIndex:1,start:6,count:3};
  empty.userData.mmdMaterialRenderProxy={materialIndex:0,start:0,count:0};
  Object.freeze(geometry.drawRange);
  expect(modelDrawRange(outline)).toEqual({start:6,count:3});
  expect(modelDrawRange(empty)).toEqual({start:0,count:0});
  expect(modelDrawRange(body)).toEqual({start:0,count:Infinity});
});

it('uses the legacy geometry range when neither proxy carries a valid range',()=>{
  const mesh=new Mesh(new BoxGeometry());mesh.geometry.setDrawRange(12,6);
  mesh.userData.mmdOutlineProxy={sourceMaterialIndex:2};
  for(const value of [{materialIndex:2},{start:-1,count:3},{start:0,count:-3},{start:.5,count:3},{start:3,count:Infinity},{start:NaN,count:0}]){
    mesh.userData.mmdMaterialRenderProxy=value;
    expect(modelDrawRange(mesh)).toEqual({start:12,count:6});
  }
  mesh.userData.mmdOutlineProxy={start:3,count:6};
  expect(modelDrawRange(mesh)).toEqual({start:3,count:6});
});
