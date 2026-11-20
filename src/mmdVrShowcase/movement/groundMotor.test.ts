import {BoxGeometry,BufferGeometry,Float32BufferAttribute,Group,InstancedMesh,Matrix4,Mesh,MeshBasicMaterial} from 'three';
import {expect,it} from 'vitest';
import {createGroundMotor,groundedBody,type ReadColumn} from './groundMotor';
import {createSolidColumns} from './solidColumns';
import {roomGround,roomEntry} from './roomGround';
import {sceneryIds} from '../scenery/catalog';
import {WALK_SPEED} from '../mmdVrQuality';
import {normalizeMmdVrPrefs} from '../settings/preferences';
import {actorBodies,sampleBodies} from './actorBodies';
import {eyeLift,headMargin} from './eyeHeight';

function world(root:Group):ReadColumn{const cols=createSolidColumns();return(x,z,y,c)=>{c.floor=0;c.ceiling=Infinity;c.blocked=false;cols.sample([root],x,z,y,c);};}
function box(group:Group,x:number,y:number,z:number,w:number,h:number,d:number){const m=new Mesh(new BoxGeometry(w,h,d));m.position.set(x,y,z);group.add(m);return m;}

it('sprints into an instanced thin wall without tunnelling and slides along it',()=>{
  const root=new Group(),wall=new InstancedMesh(new BoxGeometry(.025,3,4),new MeshBasicMaterial(),1);
  wall.setMatrixAt(0,new Matrix4().makeTranslation(.85,1.5,0));root.add(wall);
  const read=world(root),b=groundedBody(0,0,0),motor=createGroundMotor();
  for(let i=0;i<4;i++)motor.advance(b,read,.8,.12,.1,1.7,false);
  expect(b.x).toBeGreaterThan(.55);expect(b.x).toBeLessThan(.69);expect(b.z).toBeCloseTo(.48);
  expect(motor.track(b,read,1.6,.48,1.7)).toBe(false); // even if the far endpoint itself is clear
});

it('clips a jump at a low ceiling, rejects a midair jump and lands on the floor',()=>{
  const root=new Group();box(root,0,1.97,0,3,.1,3);const read=world(root),m=createGroundMotor(),b=groundedBody(0,0,0);
  let peak=0;for(let i=0;i<100;i++){m.advance(b,read,0,0,1/90,1.70,i===0||i===14);peak=Math.max(peak,b.y);}
  expect(peak).toBeCloseTo(.22,2);expect(b).toMatchObject({y:0,vy:0,grounded:true});
});

it('uses the raised eye for a low doorway and a jump; calibration cannot lift through a ceiling or lower below the floor',()=>{
  const root=new Group();box(root,0,2.05,0,1,.1,3);const read=world(root),m=createGroundMotor(),b=groundedBody(-1,0,0);
  const tracked=1.65,raised=tracked+eyeLift(.3,tracked)+headMargin;
  for(let i=0;i<60;i++)m.advance(b,read,.025,0,1/90,raised,false);
  expect(b.x).toBeLessThan(-.65);
  const lowered=tracked+eyeLift(-.1,tracked)+headMargin;
  for(let i=0;i<22;i++)m.advance(b,read,.025,0,1/90,lowered,false);
  expect(b.x).toBeGreaterThan(-.2);let peak=0;
  for(let i=0;i<120;i++){m.advance(b,read,0,0,1/90,lowered,i===0);peak=Math.max(peak,b.y);}
  expect(peak+lowered).toBeCloseTo(2,3);expect(b.y).toBe(0);
  expect(tracked+eyeLift(.8,tracked,2)+headMargin).toBeCloseTo(2);
  expect(.30+eyeLift(-.8,.30)).toBeCloseTo(headMargin);
});

it('can jump onto a low prop and fall from its edge instead of snapping to ground',()=>{
  const root=new Group();box(root,1,.24,0,1,.48,2);const read=world(root),m=createGroundMotor(),b=groundedBody(0,0,0);
  for(let i=0;i<90;i++)m.advance(b,read,i>14&&i<45?.035:0,0,1/90,1.65,i===0);
  expect(b.x).toBeGreaterThan(.85);expect(b.y).toBeCloseTo(.48);expect(b.grounded).toBe(true);
  m.advance(b,read,.8,0,.1,1.65,false);expect(b.y).toBeGreaterThan(0);expect(b.grounded).toBe(false);
  for(let i=0;i<45;i++)m.advance(b,read,0,0,1/90,1.65,false);expect(b.y).toBe(0);
});

it('has room INSIDE a single imported mesh, including under an overhead triangle',()=>{
  const root=new Group(),g=new BufferGeometry();root.userData.stagePropSolid=true;
  g.setAttribute('position',new Float32BufferAttribute([-1,0,-1,-1,2,0,-1,0,2, 1,0,-1,1,2,0,1,0,2, -1,2,-1,0,2,2,1,2,-1],3));
  root.add(new Mesh(g,new MeshBasicMaterial({depthWrite:false})));const read=world(root),b=groundedBody(0,0,0),m=createGroundMotor();expect(m.fits(read,0,0,0,1.65)).toBe(true);
  m.advance(b,read,0,0,.1,1.65,true);m.advance(b,read,0,0,.1,1.65,false);expect(b.y).toBeLessThanOrEqual(.35+.001);
  expect(m.fits(read,.96,0,0,1.65)).toBe(false);
});

it('keeps all ten entries supported and the normal/free preference independent of speed and old eye offsets',()=>{
  for(const room of sceneryIds){const p=roomEntry(room);expect(roomGround(room,p.x,p.z),room).toBe(0);}
  expect(roomGround('classroom',-4.03,5.94)).toBe(0);
  expect(normalizeMmdVrPrefs(JSON.parse('{"heightOffset":24,"walkSpeedPref":"fast"}'))).toMatchObject({movementMode:'normal',walkSpeedPref:'fast'});
  expect(normalizeMmdVrPrefs({movementMode:'free',walkSpeedPref:'sprint'})).toMatchObject({movementMode:'free',walkSpeedPref:'sprint'});
  expect(WALK_SPEED.sprint).toBe(8);
});

it('drops cached geometry when a solid is added, removed, or a placed prop moves',()=>{
  const root=new Group(),cols=createSolidColumns(),read:ReadColumn=(x,z,y,c)=>{Object.assign(c,{floor:0,ceiling:Infinity,blocked:false});cols.sample([root],x,z,y,c);};
  const motor=createGroundMotor(),pass=()=>motor.fits(read,0,0,0,1.65);
  expect(pass()).toBe(true);const m=box(root,0,1,0,.04,2,3);expect(pass()).toBe(false);
  root.remove(m);expect(pass()).toBe(true);root.add(m);expect(pass()).toBe(false);
  m.position.x=3;cols.invalidate();expect(pass()).toBe(true);cols.invalidate();
});

it('keeps a character’s rest-body proxy separate from clothing, hidden actors and GLB solids',()=>{
  const bounds:import('../backpack').BackpackLive={runtimeId:'actor',position:[0,0,0],visible:true,bounds:{center:[0,.85,0],size:[3.5,1.7,1]}};
  const entries=[{id:'a',kind:'model' as const,file:new File([],'a.pmx'),path:'a.pmx'}];
  const bodies=actorBodies(entries,{a:bounds}),c={floor:0,ceiling:Infinity,blocked:false};
  sampleBodies(bodies,.7,0,0,c);expect(c.blocked).toBe(false);sampleBodies(bodies,0,0,0,c);expect(c.blocked).toBe(true);
  expect(actorBodies(entries,{a:{...bounds,visible:false}})).toHaveLength(0);
});
