import {describe,expect,it} from 'vitest';
import {BoxGeometry,CylinderGeometry,Group,IcosahedronGeometry,InstancedMesh,Mesh,MeshBasicMaterial,Object3D,Raycaster,Vector3} from 'three';
import {createGroundMotor,groundedBody,type ReadColumn} from '../../movement/groundMotor';
import {roomGround} from '../../movement/roomGround';
import {createSolidColumns} from '../../movement/solidColumns';
import {resolvePlacementHeight,roomPickDecks,visiblePick} from '../placementAreas';
import {parkArchitecture} from './parkArchitecture';
import {inlandEmbankment,parkPavement,parkPlanting,parkStreetFurniture} from './parkGroundArt';
import {fountainCourt,parkBeds,parkDeck,parkLights,parkSeats,parkShops,parkShots,parkTrees,windowDisplays} from './parkLayout';
import {SHORE_SUN} from './shoreLayout';
import {stationParts} from './stationParts';
import {waitingBayGeometry} from './waitingBayGeometry';
import {fountainMetal,fountainStone} from './park/fountainGeometry';
import {growTree} from './park/treeHabit';
import {barkGeometry} from './park/treeSurfaces';

const room='seasideTerminus';
describe('continuous station park',()=>{
  it('gives the greenhouse curb, corner plinth and paving crossings a single front surface',()=>{
    const {solid,prints}=parkArchitecture(),paving=parkPavement(),material=new MeshBasicMaterial();
    const buildings=new Mesh(solid,material),ground=new Mesh(paving,material);
    const street=new Vector3(16.66948,1.57,32.62539),square=new Vector3(-.87378,1.6,16.98165);
    try {
      // World points back-projected from the original stereo depth conflicts.
      for(const [eye,point] of [[street,new Vector3(13.6692,5.35,37.1736)],
        [street,new Vector3(2.4,.3971,37.4701)],[square,new Vector3(11.2178,5.4213,37.28)]]){
        const hits=new Raycaster(eye,point.sub(eye).normalize()).intersectObject(buildings);
        expect(hits.length).toBeGreaterThan(1);
        expect(hits[1].distance-hits[0].distance).toBeGreaterThan(.001);
      }
      for(const [x,z] of [[19.759,34.519],[19.949,34.679]]){
        const hits=new Raycaster(new Vector3(x,1.6,z),new Vector3(0,-1,0)).intersectObject(ground);
        expect(hits).toHaveLength(1);expect(hits[0].point.y).toBeCloseTo(0);
      }
    }finally{solid.dispose();prints.dispose();paving.dispose();material.dispose();}
  });

  it('keeps the shared platform lip and the street walk valid for actors, avoiding the pool, borders and furniture',()=>{
    expect(roomPickDecks(room)).toContain(parkDeck);
    for(const [x,z] of [[-1,7.99],[-1,8],[-1,8.01],[0,22],[5,32],[16.65,32.6],[21.4,23.5],[21.4,37],[21.4,40.85]]){
      expect(roomGround(room,x,z)).toBe(0);
      expect(resolvePlacementHeight(room,x,z,0)).toBe(0);
      expect(roomPickDecks(room).some(d=>Math.abs(d.x-x)<=d.w/2&&Math.abs(d.z-z)<=d.d/2)).toBe(true);
    }
    expect(roomGround(room,fountainCourt.x,fountainCourt.z)).toBe(-Infinity);
    for(const p of [...parkSeats,...parkTrees,...parkBeds,...parkLights,fountainCourt,{x:7,z:7.98},{x:27,z:24}])expect(resolvePlacementHeight(room,p.x,p.z)).toBeNull();
    for(const s of parkShops){
      const {offset,out}=windowDisplays[s.kind],c=Math.cos(s.yaw),sn=Math.sin(s.yaw);
      expect(resolvePlacementHeight(room,s.x+c*offset+sn*out,s.z-sn*offset+c*out)).toBeNull();
    }
    for(const shot of parkShots)expect(roomGround(room,shot.eye[0],shot.eye[2])).toBe(0);
    expect(visiblePick(room,{x:-1,y:1.55,z:6},-1,0,12)).toBe(true);
    expect(visiblePick(room,{x:-1,y:1.55,z:12},-1,0,6)).toBe(true);
    expect(visiblePick(room,{x:6,y:1.45,z:32},8.8,0,32)).toBe(true);
    expect(visiblePick(room,{x:4,y:1.4,z:17},4,0,27)).toBe(false);
    expect(visiblePick(room,{x:8,y:1.4,z:28.6},10.8,0,28.6)).toBe(false);
    expect(visiblePick(room,{x:13,y:1.4,z:19.5},13,0,25)).toBe(false);
    expect(visiblePick(room,{x:7,y:1.5,z:10},7,0,-11)).toBe(false);
    expect(visiblePick(room,{x:21.4,y:1.5,z:34.5},21.4,0,40.8)).toBe(true);
    expect(roomGround(room,21.4,42.8)).toBe(0); // far side is now an actual city crossing
  });

  it('walks the normal motor past the actual station shelter, around the fountain and home through the same opening',()=>{
    const root=new Group(),material=new MeshBasicMaterial(),geometries=[];
    const station=stationParts(),pose=new Object3D();
    for(const [name,parts] of Object.entries(station)){
      const geometry=name==='land'||name==='pines'?new IcosahedronGeometry(.5,1):name==='tubes'?new CylinderGeometry(.5,.5,1,16):new BoxGeometry();
      const mesh=new InstancedMesh(geometry,material,parts.length);
      parts.forEach(({p,s,rx=0,ry=0,rz=0},i)=>{
        pose.position.set(...p);pose.scale.set(...s);pose.rotation.set(rx,ry,rz);pose.updateMatrix();mesh.setMatrixAt(i,pose.matrix);
      });root.add(mesh);geometries.push(geometry);
    }
    const {oak,hardware}=parkStreetFurniture(),{solid,prints}=parkArchitecture(),{beds,leaves,turf}=parkPlanting();
    for(const geometry of [oak,hardware,solid,beds,waitingBayGeometry(),inlandEmbankment()]){root.add(new Mesh(geometry,material));geometries.push(geometry);}
    for(const geometry of [fountainStone(),fountainMetal()]){const mesh=new Mesh(geometry,material);mesh.position.set(fountainCourt.x,0,fountainCourt.z);root.add(mesh);geometries.push(geometry);}
    for(const t of parkTrees){
      const geometry=barkGeometry(growTree(t.variant,SHORE_SUN)),mesh=new Mesh(geometry,material);
      mesh.position.set(t.x,0,t.z);mesh.scale.setScalar(t.scale);root.add(mesh);geometries.push(geometry);
    }
    const motor=createGroundMotor(),columns=createSolidColumns(),roots=[root],body=groundedBody(0,0,0);
    const sample:ReadColumn=(x,z,foot,out)=>{
      out.floor=roomGround(room,x,z);out.blocked=false;out.ceiling=Infinity;
      if(Number.isFinite(out.floor))columns.sample(roots,x,z,foot,out);
    };
    const route=[[0,0],[-1,5],[-1,12],[1,16],[0,22],[0,28],[5,32],[16.65,32.6],[21.4,35.8],[21.4,41.5]];
    for(const [x,z] of [...route,...[...route].reverse()]){
      const dx=x-body.x,dz=z-body.z,steps=Math.max(1,Math.ceil(Math.hypot(dx,dz)/.08));
      for(let i=0;i<steps;i++)motor.advance(body,sample,dx/steps,dz/steps,1/30,1.76,false);
      expect(new Vector3(body.x,0,body.z).distanceTo(new Vector3(x,0,z))).toBeLessThan(.005);
      expect(body.grounded).toBe(true);expect(Math.abs(body.y)).toBeLessThan(.025);
    }
    // The root includes real slats and real lamps; walking the route must not
    // owe its success to the room lacking solid geometry everywhere.
    const seat=parkSeats[0];expect(motor.fits(sample,seat.x,seat.z,0,1.76)).toBe(false);
    // Across the two former water gaps, an eye-level ray now meets the next
    // built street. The low quay and water from the bench stay unobstructed.
    const elevations=new Mesh(solid,material);
    const downStreet=(x:number,z:number,tx:number,tz:number)=>new Raycaster(new Vector3(x,1.52,z),new Vector3(tx-x,0,tz-z).normalize()).intersectObject(elevations)[0]?.point;
    const depot=downStreet(-.15,18.25,21.1,37.1),cutting=downStreet(16.65,32.6,-4.2,36.65);
    expect(depot?.z).toBeGreaterThan(40);expect(depot?.z).toBeLessThan(51);
    expect(cutting?.x).toBeLessThan(-10);expect(cutting?.x).toBeGreaterThan(-20);
    expect(downStreet(9.9,28.6,15.9,-11.78)).toBeUndefined();
    columns.invalidate();for(const g of [...geometries,prints,leaves,turf])g.dispose();material.dispose();
  });
});
