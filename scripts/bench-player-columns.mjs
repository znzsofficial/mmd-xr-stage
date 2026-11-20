// Compare the current normal-walk queries with a git revision using identical
// room geometry. Run from the repository root: node scripts/bench-player-columns.mjs
import {execFileSync} from 'node:child_process';
import {readFileSync} from 'node:fs';
import assert from 'node:assert/strict';
import {createServer} from 'vite';
import {stripTypeScriptTypes} from 'node:module';
import {BoxGeometry,Group,InstancedMesh,Mesh,MeshStandardMaterial,Object3D} from 'three';

const rev=process.argv[2]??'34beed9', modulePath='src/mmdVrShowcase/movement/solidColumns.ts';
async function variant(source){
  // Both implementations share the same Three build. No app-facing A/B flag.
  const js=stripTypeScriptTypes(source).replace(/from (['"])three\1/g,`from ${JSON.stringify(import.meta.resolve('three'))}`);
  return (await import('data:text/javascript;base64,'+Buffer.from(js).toString('base64'))).createSolidColumns;
}
const before=await variant(execFileSync('git',['show',`${rev}:${modulePath}`],{encoding:'utf8'}));
const after=await variant(readFileSync(modulePath,'utf8'));
const server=await createServer({server:{middlewareMode:true,watch:null},appType:'custom',logLevel:'error'});
const q=(samples,n)=>samples.toSorted((a,b)=>a-b)[Math.floor((samples.length-1)*n)];
const jobs=[];
try{
  const material=new MeshStandardMaterial();
  for(const [name,build,path] of [['suite','buildSuite','suite'],['spa','buildSpa','spa']]){
    const mod=await server.ssrLoadModule(`/src/mmdVrShowcase/scenery/retreat/${path}.ts`),root=new Group();
    for(const p of mod[build]())if(!['glow','stream','city','garden'].includes(p.finish))root.add(new Mesh(p.geometry,material));
    jobs.push({name,root,points:name==='suite'?[[-.85,2.92],[-.6,.95],[2.19,.95],[3.27,-1.23],[1.15,-1.23],[-2.8,-2.21],[-3.85,.54]]:[[1.58,3],[1.73,.95],[1.72,-5.96],[.65,-6.12],[-1.72,-5.64],[-3.22,2.46]]});
  }
  const layout=await server.ssrLoadModule('/src/mmdVrShowcase/scenery/ClassroomLayout.ts'),geo=await server.ssrLoadModule('/src/mmdVrShowcase/scenery/ClassroomGeometry.ts');
  const desks=new Group(),pose=new Object3D();
  for(const [type,g] of [['desk',geo.deskFrame()],['chair',geo.chairFrame()]]){
    const mesh=new InstancedMesh(g,material,layout.STUDENTS.length);
    layout.STUDENTS.forEach((s,i)=>{const loc=s[type];pose.position.set(loc.x,0,loc.z);pose.rotation.y=loc.yaw??0;pose.updateMatrix();mesh.setMatrixAt(i,pose.matrix)});desks.add(mesh);
  }
  const prop=new Mesh(new BoxGeometry(1,.42,.55),material);prop.position.set(1,.22,-2.9);prop.scale.set(1.12,.97,.86);prop.rotation.y=.36;desks.add(prop);
  jobs.push({name:'classroom frames + transformed box',root:desks,points:[[0,3.95],[.08,-3],[2.8,-3.12],[2.5,2.5],[-3.07,2.64],[-3.18,-3.07]]});
  for(const {name,root,points} of jobs){
    const roots=[root],route=[];
    for(let n=0;n<points.length;n++){
      const [x,z]=points[n],[tx,tz]=points[(n+1)%points.length],count=Math.ceil(Math.hypot(tx-x,tz-z)/.045);
      for(let j=0;j<count;j++)route.push([x+(tx-x)*j/count,z+(tz-z)*j/count,(j%29)*.025]);
    }
    const pair=[before(),after()],out={floor:0,ceiling:Infinity,blocked:false};
    const run=(obj,verify)=>{const hits=[];for(const [x,z,y] of route){out.floor=0;out.ceiling=Infinity;out.blocked=false;obj.sample(roots,x,z,y,out);if(verify)hits.push(out.floor,out.ceiling,out.blocked)}return hits};
    try{
      assert.deepEqual(run(pair[0],true),run(pair[1],true));
      const times=[[],[]];let wins=0;
      for(let i=-5;i<20;i++){
        for(const k of i%2?[1,0]:[0,1]){const t=performance.now();for(let n=0;n<3;n++)run(pair[k],false);if(i>=0)times[k].push((performance.now()-t)/3)}
        if(i>=0&&times[1][i]<times[0][i])wins++;
      }
      console.log(JSON.stringify({name,queriesPerLap:route.length,exactComparison:true,fasterPairs:wins,of:20,msPerLap:times.map(t=>({median:+q(t,.5).toFixed(2),p95:+q(t,.95).toFixed(2)}))}));
    }finally{pair.forEach(obj=>obj.invalidate());root.traverse(o=>o.geometry?.dispose());}
  }
  material.dispose();
}finally{await server.close()}
