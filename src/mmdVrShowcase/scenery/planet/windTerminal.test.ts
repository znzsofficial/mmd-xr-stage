import {BufferGeometry,CylinderGeometry,DoubleSide,Mesh,MeshBasicMaterial,PlaneGeometry,Quaternion,Raycaster,TorusGeometry,Vector3} from 'three';
import {expect,it} from 'vitest';
import {buildStation} from './MeridianStations';
import {windProbeModel} from './WindSystem';
import {makeCrust,stations} from './opalTerrain';
import {surveySites} from './opalSurvey';
import {readerHardware} from './surveyReaderModel';
import {northBezel} from './departureDial';
import {windFace,windTerminalBlocks,windTerminalOccludes,windTerminals,type WindTerminalWorld} from './windTerminalLayout';
import {windTerminalModel} from './windTerminalModel';
import {windPlateSight} from './windFocus';
import {windPoint} from './windAtlas';
import {moonShell} from './moonSurface';
import {PLANET_RADIUS} from './planetLayout';
import {lanternBotany} from './lanternBotany';
import {clearingDeck,clearingRadius} from './lanternClearing';
import {tideCaveRock,tideForeshore,tideTerrain} from './tideStone';
import {tideDatum} from './tideLayout';
import {windRibbons} from './windRibbons';

const up=new Vector3(0,1,0);

// Fresh Meshes intentionally use Three's triangle raycast: scenery marked
// noPick in R3F is still opaque! Keep casts short but include the complete
// world, especially neighbouring castings and the observatory/crystal bases.
function fixture(){
  const opaque=new MeshBasicMaterial({side:DoubleSide}),front=new MeshBasicMaterial(),worlds=new Map<WindTerminalWorld,Mesh[]>();
  function place(world:WindTerminalWorld,name:string,g:BufferGeometry,at:Vector3,q?:Quaternion,read=false){
    const m=new Mesh(g,read?front:opaque);m.name=name;m.position.copy(at);if(q)m.quaternion.copy(q);m.updateMatrixWorld();
    if(!worlds.has(world))worlds.set(world,[]);worlds.get(world)!.push(m);return m;
  }
  place('home','opal crust',makeCrust(false),new Vector3(0,-PLANET_RADIUS,0));
  place('home','north deck',northBezel(),new Vector3());
  for(const s of stations)place('home',s.name,buildStation(s),s.base,s.rotation);
  for(const s of Object.values(surveySites))place('home','survey reader',readerHardware(s),s.base,s.q);
  for(const site of windTerminals){
    const {lane:{moon:m},back,world,port}=site,model=windTerminalModel(site);
    place(world,`casting:${m.id}`,model.body,port.foot,site.rotation);
    place(world,`indicator:${m.id}`,model.indicator,port.foot,site.rotation);
    place(world,`read:${m.id}`,new PlaneGeometry(windFace.width,windFace.height),site.face,site.faceRotation,true);
    if(!back)continue;
    if(m.id==='tide'){
      const offset=new Vector3(m.centre.x,tideDatum,m.centre.z),{shore,globe}=tideTerrain();
      for(const g of [shore,globe,tideCaveRock(),tideForeshore()])place(world,'tidal shell and cave',g,offset);
    }else{
      place(world,'lunar shell',moonShell(m),m.centre);
      if(m.id==='lantern'){
        const {matter,light,veil}=lanternBotany();
        for(const g of [matter.geometry,light.geometry,veil])place(world,'nursery',g,m.centre);
        place(world,'clearing',new CylinderGeometry(clearingRadius,clearingRadius-.065,.15,64),new Vector3(clearingDeck.x,clearingDeck.y-.076,clearingDeck.z));
      }else place(world,'survey station',windProbeModel(m),m.station.base,new Quaternion().setFromUnitVectors(up,m.station.up));
    }
  }
  return {worlds,dispose(){for(const group of worlds.values())for(const m of group)m.geometry.dispose();opaque.dispose();front.dispose();}};
}

// Keep the actual rendered triangle vertices around the port, discard the
// far side of the globe before thousands of narrow test rays (no BVH/cache
// of the answers). The full meshes remain in the independent read-face test.
function nearby(ground:Mesh[],at:Vector3){
  return ground.map(m=>{
    const centre=m.worldToLocal(at.clone()),v=new Vector3(),g=m.geometry,pos=g.attributes.position,ix=g.index!,ids:number[]=[];
    const close=Array.from({length:pos.count},(_,i)=>v.fromBufferAttribute(pos,i).distanceToSquared(centre)<2.5**2);
    for(let i=0;i<ix.count;i+=3){const a=ix.getX(i),b=ix.getX(i+1),c=ix.getX(i+2);if(close[a]||close[b]||close[c])ids.push(a,b,c);}
    const cut=new BufferGeometry();cut.setAttribute('position',pos);cut.setIndex(ids);
    const mesh=new Mesh(cut,m.material);mesh.matrixWorld.copy(m.matrixWorld);return mesh;
  });
}

it('the glass wins the first triangle hit from both diagonals, the collar and the north deck; the reverse hits a closed casting',()=>{
  const scene=fixture(),ray=new Raycaster();
  try{for(const site of windTerminals){
    const {lane,back,face,faceRotation:q,port,world}=site,group=scene.worlds.get(world)!;
    const normal=new Vector3(0,0,1).applyQuaternion(q),right=new Vector3(1,0,0).applyQuaternion(q);
    const eyes=[0,-42,42].map(a=>{const rad=a*Math.PI/180;return face.clone().addScaledVector(normal,1.6*Math.cos(rad)).addScaledVector(right,1.6*Math.sin(rad));});
    eyes.push(port.foot.clone().addScaledVector(port.up,1.62));if(!back)eyes.push(new Vector3(0,1.62,0),new Vector3(0,1.62,1.9));
    // Route 06 was reported buried. Follow the *ground*, not the tilted sign's
    // plane, from the north landing and diagonally from the nursery side.
    if(lane.moon.id==='lantern'){
      const centre=back?lane.moon.centre:new Vector3(0,-PLANET_RADIUS,0);
      const rock=group.find(m=>m.name===(back?'lunar shell':'opal crust'))!;
      const start=back?port.foot.clone().addScaledVector(site.front,2.4).addScaledVector(right,-1.1):new Vector3(0,0,1.9);
      for(const t of [0,.40,.75,1]){
        const outward=start.clone().lerp(port.foot,t).sub(centre).normalize();
        ray.set(centre.clone().addScaledVector(outward,20),outward.clone().negate());ray.far=20;
        const foot=ray.intersectObject(rock)[0].point;
        if(!back&&Math.hypot(foot.x,foot.z)<2.8)foot.y=0;
        for(const height of [.83,1.63])eyes.push(foot.clone().addScaledVector(outward,height));
      }
    }
    const points=[[0,0],[-.98,-.98],[.98,-.98],[-.98,.98],[.98,.98]];
    for(const [j,eye] of eyes.entries())for(const [u,v] of points){
      const target=new Vector3(u*windFace.width/2,v*windFace.height/2,0).applyQuaternion(q).add(face);
      ray.set(eye,target.clone().sub(eye).normalize());ray.far=eye.distanceTo(target)+.015;
      const hit=ray.intersectObjects(group,false)[0],label=`${world}/${lane.moon.id} eye ${j} corner ${u},${v}`;
      expect(hit?.object.name,label).toBe(`read:${lane.moon.id}`);expect(windPlateSight(lane,back,eye,target),label).toBe(true);
    }
    const rear=face.clone().addScaledVector(normal,-.4);ray.set(rear,normal);ray.far=.401;
    expect(ray.intersectObjects(group,false)[0]?.object.name).toBe(`casting:${lane.moon.id}`);
    expect(windPlateSight(lane,back,rear,face)).toBe(false);
  }}finally{scene.dispose();}
});

it('seats every nozzle azimuth and its lit stripe on the actual triangulated ground, and starts each streamline above the metal',()=>{
  const scene=fixture(),ray=new Raycaster(),local=new Vector3(),rims=new TorusGeometry(.68,.075,6,56);
  rims.rotateX(Math.PI/2);const old=new Mesh(rims,new MeshBasicMaterial());
  const errors:string[]=[];let buried=0,floating=0,maxTrimError=0;
  let clippedPrints=0;
  try{for(const site of windTerminals){
    const {world,lane,back,rotation,port}=site,group=scene.worlds.get(world)!,ground=nearby(group.filter(m=>['opal crust','lunar shell','tidal shell and cave'].includes(m.name)),port.foot),
      body=group.find(m=>m.name===`casting:${lane.moon.id}`)!,indicator=group.find(m=>m.name===`indicator:${lane.moon.id}`)!;
    if(!back){old.position.copy(port.foot);old.quaternion.copy(rotation);old.updateMatrixWorld();
      const oldQ=new Quaternion().setFromUnitVectors(up,port.up),eye=port.foot.clone().addScaledVector(port.up,1.62);
      const obstacles=[old,...ground,...group.filter(m=>stations.some(s=>s.name===m.name))];
      for(const open of [false,true]){
        const scale=open?1:.70,tilt=open?-.46:-.73;
        for(const u of [-.98,0,.98])for(const v of [-.98,0,.98]){
          const target=new Vector3(u*.41*scale,v*.155*scale,0).applyAxisAngle(new Vector3(1,0,0),tilt)
            .add(new Vector3(0,open?.22:.12,-.70)).applyQuaternion(oldQ).add(port.foot);
          ray.set(eye,target.clone().sub(eye).normalize());ray.far=eye.distanceTo(target)-.001;
          if(ray.intersectObjects(obstacles)[0])clippedPrints++;
        }
      }
    }
    // The edge of the foot must straddle the local rock all around, not just
    // balance on its centre on the uphill side. The post and head are clear.
    for(let i=0;i<12;i++){
      const a=i*Math.PI/6;local.set(.16*Math.cos(a),.55,-.038+.119*Math.sin(a)).applyQuaternion(rotation).add(site.base);
      ray.set(local,port.up.clone().negate());ray.far=1.0;
      const floor=ray.intersectObjects(ground)[0],cast=ray.intersectObject(body),label=`${world}/${lane.moon.id} heel ${i}`;
      expect(cast[0].distance,label).toBeLessThan(floor.distance-.024);expect(cast.at(-1)!.distance,label).toBeGreaterThan(floor.distance+.009);
    }
    for(let i=0;i<56;i++){
      const a=(i+.375)*2*Math.PI/56;
      for(const [radius,mesh,low,high] of [[.680,body,.086,.102],[.710,body,.103,.113],[.480,body,.055,.099],[.666,indicator,.096,.104]] as const){
        local.set(radius*Math.cos(a),1,radius*Math.sin(a)).applyQuaternion(rotation).add(port.foot);
        ray.set(local,port.up.clone().negate());ray.far=2;
        const floor=ray.intersectObjects(ground)[0],top=ray.intersectObject(mesh)[0],h=floor?.distance-top?.distance;
        if(!(h>=low&&h<=high))errors.push(`${world}/${lane.moon.id}:${i} r${radius} top ${h}`);
        if(mesh===indicator){maxTrimError=Math.max(maxTrimError,Math.abs(h-.100));const casting=ray.intersectObject(body)[0];
          expect(casting.distance-top.distance).toBeGreaterThan(.001);}
        if(radius===.680&&!back){const oldTop=ray.intersectObject(old)[0];if(oldTop){const gap=floor.distance-oldTop.distance;if(gap<0)buried++;if(gap>.18)floating++;}}
      }
    }
    const ribbons=windRibbons(lane),vertices=ribbons.attributes.position,perLine=82;
    for(let j=0;j<3;j++)for(let i=0;i<3;i++){
      const p=new Vector3().fromBufferAttribute(vertices,((back?3:0)+j)*perLine+2*i);
      local.copy(p).addScaledVector(port.up,.5);ray.set(local,port.up.clone().negate());ray.far=2;
      const floor=ray.intersectObjects(ground)[0],metal=ray.intersectObject(body)[0];
      expect(floor.distance-.5).toBeGreaterThan(.115);if(metal)expect(metal.distance-.5).toBeGreaterThan(.010);
    }
    ribbons.dispose();for(const m of ground)m.geometry.dispose();
  }
  expect(errors.slice(0,15)).toEqual([]);expect(maxTrimError).toBeLessThan(.004);
  // The old flat nozzle genuinely vanishes under the rendered slopes. This
  // witness would still be red even if a shader rendered it through the rock.
  expect(buried).toBeGreaterThan(0);expect(floating).toBeGreaterThan(0);expect(clippedPrints).toBeGreaterThan(0);
  }finally{rims.dispose();old.material.dispose();scene.dispose();}
});

it('leaves each takeoff disc and arrival arc clear while the plinth and high cabinet are solid',()=>{
  const p=new Vector3(),side=new Vector3();
  for(const {lane,world,port,back,base,boxes,rotation} of windTerminals){
    expect(windTerminalBlocks(base,.18,1.65,world)).toBe(true);
    expect(windTerminalOccludes(boxes[2].center,port.foot,world)).toBe(true);
    for(let i=0;i<24;i++){
      const a=i*Math.PI/12;side.set(.90*Math.cos(a),0,.90*Math.sin(a)).applyQuaternion(rotation);
      for(let j=0;j<=12;j++){
        const t=j/200;windPoint(lane,back?1-t:t,p).add(side);
        expect(windTerminalBlocks(p,.20,1.80,world),`${world}/${lane.moon.id}: ${i}/${j}`).toBe(false);
      }
    }
  }
});
