import {describe,expect,it} from 'vitest';
import {DoubleSide,Group,Mesh,MeshBasicMaterial,Raycaster,Vector3} from 'three';
import {createSolidColumns} from '../../movement/solidColumns';
import {createGroundMotor,groundedBody,type ReadColumn} from '../../movement/groundMotor';
import {BENCH,BOARD,CELL,DAIS,DESK,HALL,PORTAL,PRESS,WHEEL,chamberEntry,chamberGround,chamberPlace,chamberSight,chamberView} from './chamberLayout';
import {Masonry} from './masonry';
import {chamberShell} from './chamberShell';
import {dressChamber} from './recordRoom';
import {CABINET,cabinetPoint} from './cabinetShape';
import {galleryModels} from './galleryModels';

describe('record room and hearing vault',()=>{
  it('has one exposed wheel surface on either side of the copper band, and one portal reveal',()=>{
    const m=new Masonry();chamberShell(m);galleryModels(m);const parts=m.build(),mat=new MeshBasicMaterial({side:DoubleSide});
    const room=new Group();for(const p of parts)room.add(new Mesh(p.geometry,mat));room.updateMatrixWorld(true);
    const hit=(origin:number[],dir:number[])=>new Raycaster(new Vector3(...origin),new Vector3(...dir)).intersectObject(room);
    try{
      const paths=[...[-1,1].map(s=>hit([WHEEL.x+s*.67,1.14+.647*Math.cos(.34),WHEEL.z+.647*Math.sin(.34)],[-s,0,0])),
        hit([PORTAL.x,1.341,PORTAL.z+.054],[-1,0,0])];
      for(const [first,second] of paths){expect(first).toBeDefined();expect(second.distance-first.distance).toBeGreaterThan(.008);}
    }finally{parts.forEach(p=>p.geometry.dispose());mat.dispose();}
  });
  it('keeps the level portrait floor and both cameras reachable, and reserves the furniture, cell and door jambs',()=>{
    for(const [x,z] of [[0,0],[DAIS.x-.55,DAIS.z],[DAIS.x+.55,DAIS.z],[2.72,-7.16],[2.51,-4.84],[PORTAL.x,PORTAL.z],...chamberView.shots.map(s=>[s.eye[0],s.eye[2]])]){
      expect(chamberPlace(x,z)).toBe(true);expect(chamberGround(x,z)).toBe(0);
    }
    for(const [x,z] of [[DESK.x,DESK.z],[BENCH.x,BENCH.z],[WHEEL.x,WHEEL.z],[BOARD.x,BOARD.z],[PRESS.x,PRESS.z],[CABINET.x,CABINET.z],[PORTAL.x+PORTAL.r,PORTAL.z],[CELL.x+.4,CELL.z],[0,HALL.front+1],[NaN,0]]){
      expect(chamberPlace(x,z)).toBe(false);expect(chamberGround(x,z)).toBe(-Infinity);
    }
  });

  it('walks both routes with the actual arch and furniture triangles and a standing column',()=>{
    const m=new Masonry();chamberShell(m);dressChamber(m);const parts=m.build(),room=new Group(),mat=new MeshBasicMaterial({side:DoubleSide});
    for(const p of parts){const mesh=new Mesh(p.geometry,mat);mesh.userData.playerCollision=p.finish!=='dusk';room.add(mesh);}room.updateMatrixWorld(true);
    const columns=createSolidColumns(),motor=createGroundMotor(),body=groundedBody(chamberEntry.x,0,chamberEntry.z);
    const sample:ReadColumn=(x,z,y,c)=>{c.floor=chamberGround(x,z);c.ceiling=Infinity;c.blocked=false;if(Number.isFinite(c.floor))columns.sample([room],x,z,y,c);};
    const route=[[body.x,body.z],[.63,.05],[PORTAL.x,PORTAL.z],[.61,-3.12],[DAIS.x,DAIS.z],[2.12,CELL.z],[2.51,-4.84],[1.83,-5.79],[1.90,-7.13],[2.72,-7.16]];
    try{
      for(const [x,z] of [...route,...route.slice().reverse()]){
        motor.advance(body,sample,x-body.x,z-body.z,1/60,1.80,false);expect(Math.hypot(body.x-x,body.z-z),`waypoint ${x}, ${z}`).toBeLessThan(.01);expect(body.y).toBeCloseTo(0);
      }
      // The arch clears a standing person; a tall ray aimed at the dais must still meet its masonry.
      const cases:[number[],number[],boolean][]=[[[.64,1.40,.85],[.64,.015,-4.4],true],[[-1.82,1.40,-.58],[-1.82,.015,-4.72],false],
        [[1.57,3.60,-1.43],[1.57,.015,-5.31],false],[[-1.77,1.32,2.04],[-1.77,.015,-.86],false],[[.63,1.38,-3.10],[DAIS.x,.015,DAIS.z],true],
        [[2.51,1.32,-4.84],[2.72,.015,-7.16],false],[[2.03,1.32,-7.10],[2.72,.015,-7.16],true],
         // The cornice projects beyond the blue wall; the hipped roof recedes above it.
         [cabinetPoint(.40,1.69,.60),cabinetPoint(.40,1.65,-.60),false],[cabinetPoint(.34,2.01,.60),cabinetPoint(.34,1.97,-.60),true]];
      for(const [from,to,visible] of cases){
        const p=new Vector3(...from),end=new Vector3(...to),ray=new Raycaster(p,end.clone().sub(p).normalize(),0,end.distanceTo(p));
        expect(ray.intersectObject(room).length===0).toBe(visible);expect(chamberSight(p,end.x,end.y,end.z)).toBe(visible);
      }
      for(const [from,to] of [[[.64,-1.29],[-.55,-2.04]],[[2.51,-5.01],[CABINET.x,CABINET.z]],[[2.72,-7.16],[CABINET.x,CABINET.z]],[[.91,3.68],[.91,4.64]]]){
        const foot=groundedBody(from[0],0,from[1]);expect(motor.track(foot,sample,to[0],to[1],1.80)).toBe(false);
        motor.advance(foot,sample,to[0]-foot.x,to[1]-foot.z,.1,1.80,false);
        expect(Math.hypot(foot.x-to[0],foot.z-to[1])).toBeGreaterThan(.14);expect(chamberGround(foot.x,foot.z)).toBe(0);
      }
      // No foot accepted by the layout should climb the low bevel when the
      // motor samples the corners of its square column on either diagonal.
      for(let x=2;x<3.20;x+=.04)for(let z=-7.18;z<-5.8;z+=.04){
        if(chamberGround(x,z)!==0)continue;
        const c={floor:0,ceiling:Infinity,blocked:false};columns.sample([room],x,z,0,c);expect(c.floor).toBeCloseTo(0,4);
      }
      const eye=new Vector3(...chamberView.shots[1].eye),panel=new Vector3(...cabinetPoint(.08,1.32,.382*.76));
      const firstHit=new Raycaster(eye,panel.clone().sub(eye).normalize()).intersectObject(room)[0];
      expect(firstHit.point.distanceTo(panel)).toBeLessThan(.002);
    }finally{columns.invalidate();parts.forEach(p=>p.geometry.dispose());mat.dispose();}
  });
});
