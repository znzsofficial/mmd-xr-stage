import { expect, it } from 'vitest';
import { EXHIBITS, FIXTURES, TRAY_TOP, type ClinicRect } from './clinicLayout';
import { instrumentGeometry, teachingModelGeometry } from './teachingSolids';

it('keeps every cast specimen in its blocked counter volume and every instrument above the tray',()=>{
  const models=teachingModelGeometry(),tools=instrumentGeometry();
  const fits=(x:number,z:number,r:ClinicRect)=>Math.abs(x-r.x)<=r.w/2&&Math.abs(z-r.z)<=r.d/2;
  try{
    const p=models.getAttribute('position'),counts=EXHIBITS.map(()=>0);
    for(let i=0;i<p.count;i++){
      const j=EXHIBITS.findIndex(r=>fits(p.getX(i),p.getZ(i),r)&&p.getY(i)>=.9&&p.getY(i)<=r.top);
      if(j===-1)throw Error(`Specimen outside placement blocker at ${p.getX(i)}, ${p.getY(i)}, ${p.getZ(i)}`);
      counts[j]++;
    }
    expect(counts.every(n=>n>0)).toBe(true);
    tools.computeBoundingBox();const {min,max}=tools.boundingBox!;
    expect(min.y).toBeGreaterThanOrEqual(.85);expect(max.y).toBeLessThanOrEqual(TRAY_TOP);
    expect(fits(min.x,min.z,FIXTURES.steelCart)&&fits(max.x,max.z,FIXTURES.steelCart)).toBe(true);
  }finally{models.dispose();tools.dispose();}
});
