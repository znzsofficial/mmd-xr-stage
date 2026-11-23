import {DoubleSide,Mesh,MeshBasicMaterial,PlaneGeometry,Raycaster,Vector3,type BufferGeometry} from 'three';
import {expect,it} from 'vitest';
import {buildStation} from './MeridianStations';
import {surveySight,surveySites} from './opalSurvey';
import {makeCrust,stations} from './opalTerrain';
import {PAD_RADIUS,PLANET_RADIUS} from './planetLayout';
import {armBoxes,chipSeat,dockFoot,headPoint,readerFace} from './surveyHardware';
import {readerCasting,readerHardware,surveyChip} from './surveyReaderModel';

const material=new MeshBasicMaterial({side:DoubleSide}),xAxis=new Vector3(1,0,0);
function surface(g:BufferGeometry,position:Vector3,rotation?:Mesh['quaternion']){
  const m=new Mesh(g,material);m.position.copy(position);if(rotation)m.quaternion.copy(rotation);m.updateMatrixWorld();return m;
}
const distance=(from:Vector3,to:Vector3,meshes:Mesh[])=>{
  const d=to.clone().sub(from),ray=new Raycaster(from,d.clone().normalize(),0,d.length()+.00001);
  return ray.intersectObjects(meshes,false)[0]?.distance??Infinity;
};
it('keeps the action and chip socket on the first visible facet, from the path and both oblique sides',()=>{
  const crust=surface(makeCrust(false),new Vector3(0,-PLANET_RADIUS,0));
  const stone=stations.map(st=>surface(buildStation(st),st.base,st.rotation));
  const readers=Object.values(surveySites).map(s=>surface(readerHardware(s),s.base,s.q));
  try{for(const s of Object.values(surveySites)){
    const world=(v:Vector3)=>v.applyQuaternion(s.q).add(s.base);
    const face=surface(new PlaneGeometry(readerFace.width,readerFace.height),s.lens,s.q);face.rotateX(s.tilt);face.updateMatrixWorld();
    const chip=surface(surveyChip('#262a2a','#ffd49a'),world(headPoint(s,chipSeat.x,chipSeat.y,0)),face.quaternion);
    try{for(const side of [-1,0,1]){
      const eye=s.eye.clone().addScaledVector(xAxis.clone().applyQuaternion(s.q),side*.90);
      for(const x of [-.55,-.13,.06,.34,.55])for(const y of [-.24,-.10,.02,.16,.24]){
        const hit=world(headPoint(s,x,y,0));
        expect(surveySight(eye,hit)).toBe(true);
        expect(distance(eye,hit,[face])).toBeCloseTo(eye.distanceTo(hit),4);
        expect(distance(eye,hit,[...readers,...stone,crust,chip])).toBe(Infinity);
      }
      const centre=world(headPoint(s,chipSeat.x,chipSeat.y,0)),d=distance(eye,centre,[chip]);
      expect(d).toBeLessThan(eye.distanceTo(centre));
      expect(surveySight(eye,centre.clone().sub(eye).setLength(d).add(eye))).toBe(true);
      expect(distance(eye,centre,readers)).toBe(Infinity);
      expect(surveySight(eye,centre)).toBe(true);
    }}finally{chip.geometry.dispose();face.geometry.dispose();}
  }}finally{for(const m of [...readers,...stone,crust])m.geometry.dispose();}
});

it('seats the two arms in the rendered footing and the back casting, clear of the front and the landing',()=>{
  for(const [id,s] of Object.entries(surveySites)){
    const world=(v:Vector3)=>v.applyQuaternion(s.q).add(s.base);
    const st=stations.find(t=>t.name===id+'-quartz'),owner=st?surface(buildStation(st),st.base,st.rotation):null;
    const head=readerCasting(s),pos=head.getAttribute('position');
    try{
      if(id==='dial')for(let i=0;i<pos.count;i++){
        const p=world(new Vector3().fromBufferAttribute(pos,i));expect(p.y).toBeGreaterThan(.53);expect(Math.hypot(p.x,p.z)).toBeGreaterThan(PAD_RADIUS);
      }
      if(owner){
        const n=new Vector3(0,0,1).applyAxisAngle(xAxis,s.tilt).applyQuaternion(s.q),v=owner.geometry.getAttribute('position');
        let gap=Infinity;for(let i=0;i<v.count;i++)gap=Math.min(gap,new Vector3().fromBufferAttribute(v,i).applyMatrix4(owner.matrixWorld).sub(s.lens).dot(n)*-1);
        expect(gap).toBeGreaterThan(.17); // all foot AND crystal triangles behind the 82 mm casting
      }
      for(const b of armBoxes(s)){
        const heel=new Vector3(0,-b.half.y,0).applyQuaternion(b.rotation).add(b.center);
        const v=new Vector3(0,1,0).applyQuaternion(b.rotation);
        if(owner){const bury=.3-distance(world(heel.clone().addScaledVector(v,.3)),world(heel.clone()),[owner]);
          expect(bury).toBeGreaterThan(.03);expect(bury).toBeLessThan(.09);}
        else{expect(dockFoot.top-heel.y).toBeGreaterThan(.035);expect(Math.hypot(heel.x,heel.z)).toBeLessThan(dockFoot.radius*.75);}
        for(const x of [-1,1])for(const z of [-1,1]){
          const cap=new Vector3(x*b.half.x,b.half.y,z*b.half.z).applyQuaternion(b.rotation).add(b.center)
            .sub(new Vector3(0,s.height,s.r)).applyAxisAngle(xAxis,-s.tilt);
          expect(cap.z).toBeLessThan(-.018);expect(Math.abs(cap.x)).toBeLessThan(readerFace.width/2);expect(Math.abs(cap.y)).toBeLessThan(readerFace.height/2);
        }
        const top=b.center.clone().addScaledVector(v,b.half.y).sub(new Vector3(0,s.height,s.r)).applyAxisAngle(xAxis,-s.tilt);
        expect(top.z).toBeGreaterThan(-readerFace.depth); // positive bearing, not a balanced point contact
      }
    }finally{owner?.geometry.dispose();head.dispose();}
  }
});
