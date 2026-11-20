import {describe,expect,it} from 'vitest';
import {DoubleSide,Group,Mesh,MeshBasicMaterial,Raycaster,Vector3} from 'three';
import {createSolidColumns} from '../../movement/solidColumns';
import {createGroundMotor,groundedBody,type ReadColumn} from '../../movement/groundMotor';
import {BENCH,CELL,DAIS,DESK,HALL,PORTAL,PRESS,chamberEntry,chamberGround,chamberPlace,chamberSight,chamberView} from './chamberLayout';
import {Masonry} from './masonry';
import {chamberShell} from './chamberShell';
import {dressChamber} from './recordRoom';
import {EFFIGY,effigyPoint} from './effigyShape';

describe('record room and hearing vault',()=>{
  it('keeps the level portrait floor and both cameras reachable, and reserves the furniture, cell and door jambs',()=>{
    for(const [x,z] of [[0,0],[DAIS.x-.55,DAIS.z],[DAIS.x+.55,DAIS.z],[2.72,-7.16],[2.51,-4.84],[PORTAL.x,PORTAL.z],...chamberView.shots.map(s=>[s.eye[0],s.eye[2]])]){
      expect(chamberPlace(x,z)).toBe(true);expect(chamberGround(x,z)).toBe(0);
    }
    for(const [x,z] of [[DESK.x,DESK.z],[BENCH.x,BENCH.z],[PRESS.x,PRESS.z],[EFFIGY.x,EFFIGY.z],[PORTAL.x+PORTAL.r,PORTAL.z],[CELL.x+.4,CELL.z],[0,HALL.front+1],[NaN,0]]){
      expect(chamberPlace(x,z)).toBe(false);expect(chamberGround(x,z)).toBe(-Infinity);
    }
  });

  it('walks both routes with the actual arch and furniture triangles and a standing column',()=>{
    const m=new Masonry();chamberShell(m);dressChamber(m);const parts=m.build(),room=new Group(),mat=new MeshBasicMaterial({side:DoubleSide});
    for(const p of parts)room.add(new Mesh(p.geometry,mat));room.updateMatrixWorld(true);
    const columns=createSolidColumns(),motor=createGroundMotor(),body=groundedBody(chamberEntry.x,0,chamberEntry.z);
    const sample:ReadColumn=(x,z,y,c)=>{c.floor=chamberGround(x,z);c.ceiling=Infinity;c.blocked=false;columns.sample([room],x,z,y,c);};
    const route=[[body.x,body.z],[.63,.05],[PORTAL.x,PORTAL.z],[.61,-3.12],[DAIS.x,DAIS.z],[2.12,CELL.z],[2.51,-4.84]];
    try{
      for(const [x,z] of [...route,...route.slice().reverse()]){
        motor.advance(body,sample,x-body.x,z-body.z,1/60,1.80,false);expect(Math.hypot(body.x-x,body.z-z)).toBeLessThan(.01);expect(body.y).toBeCloseTo(0);
      }
      // The arch clears a standing person; a tall ray aimed at the dais must still meet its masonry.
      const cases:[number[],number[],boolean][]=[[[.64,1.40,.85],[.64,.015,-4.4],true],[[-1.82,1.40,-.58],[-1.82,.015,-4.72],false],
        [[1.57,3.60,-1.43],[1.57,.015,-5.31],false],[[-1.77,1.32,2.04],[-1.77,.015,-.86],false],[[.63,1.38,-3.10],[DAIS.x,.015,DAIS.z],true],
        [[2.51,1.32,-4.84],[2.72,.015,-7.16],false],[[2.03,1.32,-7.10],[2.72,.015,-7.16],true],
        // At shoulder width the lower casting occludes, but a ray beside the narrower hood passes.
        [effigyPoint(.34,1.48,.62),effigyPoint(.34,1.43,-.62),false],[effigyPoint(.34,1.91,.62),effigyPoint(.34,1.87,-.62),true]];
      for(const [from,to,visible] of cases){
        const p=new Vector3(...from),end=new Vector3(...to),ray=new Raycaster(p,end.clone().sub(p).normalize(),0,end.distanceTo(p));
        expect(ray.intersectObject(room).length===0).toBe(visible);expect(chamberSight(p,end.x,end.y,end.z)).toBe(visible);
      }
      const eye=new Vector3(...chamberView.shots[1].eye),mask=new Vector3(...effigyPoint(.078,1.75,.200));
      const firstHit=new Raycaster(eye,mask.clone().sub(eye).normalize()).intersectObject(room)[0];
      expect(firstHit.point.distanceTo(mask)).toBeLessThan(.008); // Cheek is visible: no bars, piers or tapestry in the tour sightline.
    }finally{columns.invalidate();parts.forEach(p=>p.geometry.dispose());mat.dispose();}
  });
});
