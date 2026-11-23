import {expect,it} from 'vitest';
import {REFERENCE_TISSUE} from '../../bodyState/data';
import {organMeshes,stride} from './model';
import {createWallStudy,wallStride} from './uterineWall';

it('draws the reference mucosa on both cut faces without moving the outer wall, cervix or rest mesh',()=>{
  const mesh=organMeshes()[3],wall=createWallStudy();
  const surface=wall.forDate(mesh,REFERENCE_TISSUE);
  for(const [cut,src] of [mesh.a,mesh.b].entries()){
    let architecture=0,still=0;
    for(let j=0,k=0;j<src.length;j+=stride,k+=wallStride){
      if(src[j+2]<.3||src[j+10]===0&&src[j+11]===0){
        for(let n=0;n<wallStride;n++)still+=Math.abs(surface[cut][k+n]);
      }else if(surface[cut][k+2]>.02)architecture++;
    }
    expect(still).toBe(0);expect(architecture).toBeGreaterThan(20);
  }
  expect(wall.forDate(mesh,REFERENCE_TISSUE)).toBe(surface);wall.clear();
});
