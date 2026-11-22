import {expect,it} from 'vitest';
import {DEFAULT_BODY_PROFILE,sampleBody} from '../../bodyState/data';
import {organMeshes,stride} from './model';
import {createWallStudy,wallStride} from './uterineWall';

it('changes the mucosa on both cut faces with the cycle while leaving the outer wall, cervix and rest mesh alone',()=>{
  const mesh=organMeshes()[3],wall=createWallStudy();
  const get=(day:number)=>wall.forDate(mesh,sampleBody({...DEFAULT_BODY_PROFILE,day,liningOverride:.55}).tissue);
  const early=get(8).map(c=>c.slice()),late=get(23);
  for(const [cut,src] of [mesh.a,mesh.b].entries()){
    let architecture=0,still=0;
    for(let j=0,k=0;j<src.length;j+=stride,k+=wallStride){
      if(src[j+2]<.3||src[j+10]===0&&src[j+11]===0){
        for(let n=0;n<wallStride;n++)still+=Math.abs(late[cut][k+n]);
      }else if(Math.abs(late[cut][k+2]-early[cut][k+2])>.02)architecture++;
    }
    expect(still).toBe(0);expect(architecture).toBeGreaterThan(20);
  }
  // Cancel/revisit an illustrated day: no time integrator or stale engraving.
  const restored=get(8);expect(restored[0]).toEqual(early[0]);expect(restored[1]).toEqual(early[1]);wall.clear();
});
