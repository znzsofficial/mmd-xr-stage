import {useEffect,useLayoutEffect,useMemo,useRef,useState} from 'react';
import {useFrame} from '@react-three/fiber';
import {DoubleSide,InstancedMesh,Object3D,Quaternion,Vector3,type MeshBasicMaterial,type Texture} from 'three';
import {ball,box,PaintedParts,ring,rod,turn} from '../../play/modelParts';
import {useBakedSurface} from '../useBakedSurface';
import {noPick,paintedSurface} from '../sceneryPaint';
import {lanes,moons,sunDirection,windPoint,type Moon,type WindLane,type WindPort} from './windAtlas';
import {moonShell} from './moonSurface';
import ember from './ember-basins.webp';
import frost from './frost-rifts.webp';
import salt from './salt-hoppers.webp';
import glaze from './glaze-fractures.webp';
import {instrumentFragment,instrumentVertex,mineralFragment,mineralVertex} from './twinMinerals';
import {twinStation} from './twinStations';
import {windRibbons} from './windRibbons';
import {Reedwater,reedGaugeModel} from './Reedwater';
import {surfaceGrain} from './surfaceGrain';
import {createWindFocus,windPlateSight} from './windFocus';
import {useSceneAction} from '../input/useSceneAction';
import {useLanguageStore} from '../../../languageStore';
import {SteppingMoons} from './SteppingMoons';

const prints={basins:ember,rifts:frost,salt,glaze};
const halite={HALITE:1};
function Satellite({moon,grain}:{moon:Exclude<Moon,{relief:'wetland'}>;grain:Texture|null}){
  const twin=moon.relief==='salt'||moon.relief==='glaze';
  const g=useMemo(()=>moonShell(moon),[moon]),map=useBakedSurface(prints[moon.relief],twin?'mask':'print');
  const u=useMemo(()=>({albedo:{value:map},printMap:{value:map},mapped:{value:map?1:0},grainMap:{value:grain},grainReady:{value:grain?1:0},core:{value:moon.centre},sun:{value:sunDirection},ice:{value:moon.relief==='rifts'?1:0},probe:{value:moon.station.base},probeUp:{value:moon.station.up}}),[map,moon,grain]);
  useEffect(()=>()=>g.dispose(),[g]);
  return <mesh name={'planet:moon-'+moon.id} geometry={g} position={moon.centre} userData={{playerCollision:false}} raycast={noPick}>
    {twin?<shaderMaterial uniforms={u} defines={moon.relief==='salt'?halite:undefined} vertexShader={mineralVertex} fragmentShader={mineralFragment}/>:map?<shaderMaterial uniforms={u} vertexShader={`varying vec2 st;varying vec3 n,v,world;
      void main(){st=uv;n=mat3(modelMatrix)*normal;vec4 p=modelMatrix*vec4(position,1.);world=p.xyz;v=cameraPosition-p.xyz;gl_Position=projectionMatrix*viewMatrix*p;}`}
      fragmentShader={`${surfaceGrain}\nuniform sampler2D albedo;uniform vec3 sun,probe,probeUp,core;uniform float ice;varying vec2 st;varying vec3 n,v,world;
        float shade(vec3 center,float rad){vec3 diff=center-world;float t=dot(diff,sun);return smoothstep(.015,.15,t)*(1.-smoothstep(rad*.75,rad+.03,length(diff-t*sun)));}
        void main(){vec3 N=normalize(n),V=normalize(v);float day=dot(N,sun),facing=max(0.,dot(N,V));
          vec3 base=texture2D(albedo,st).rgb;
          vec3 grain=grainAt(world-core,N,mix(1.65,1.1,ice),length(v));
          base*=max(.35,1.+grain.r*mix(1.25,.53,ice)+grain.g*.49-grain.b*mix(.21,.72,ice));
          vec3 facet=vec3(grain.g,grain.r,-grain.b);N=normalize(N+.18*(facet-dot(N,facet)*N));day=dot(N,sun);
          float diffuse=max(0.,day);float regolith=diffuse/(.45+diffuse+.35*facing);
          float shadow=1.-.86*max(shade(probe+.52*probeUp,.26),shade(probe+1.08*probeUp,mix(.11,.37,ice)));
          vec3 c=base*(vec3(.034,.053,.082)+shadow*vec3(1.18,1.11,1.02)*mix(regolith,diffuse,ice*.55));
          c+=ice*(vec3(.21,.48,.58)*pow(1.-facing,3.6)*smoothstep(-.12,.6,day)+vec3(.32,.32,.27)*pow(max(dot(reflect(-sun,N),V),0.),24.)*diffuse);
          gl_FragColor=vec4(c,1.);
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
        }`}/>:<meshStandardMaterial color={moon.color} fog={false}/>}
  </mesh>;
}

const axis=new Vector3(0,1,0);
const daylight={sun:{value:sunDirection}};
function SurveyProbe({moon}:{moon:Moon}){
  const s=moon.station;
  const g=useMemo(()=>{
    if(moon.instrument==='gauge')return reedGaugeModel();
    if(moon.instrument==='prism'||moon.instrument==='kiln')return twinStation(moon.instrument);
    const p=new PaintedParts();
    for(let i=0;i<3;i++){
      const a=i*2*Math.PI/3,x=.40*Math.cos(a),z=.40*Math.sin(a);
      p.add(rod([x,-.09,z],[x*.39,.54,z*.39],.034,.026,8),'#aab2ab');p.add(ball(x,-.015,z,.096,.039,.080,8),'#696a66');
    }
    if(moon.instrument==='seismometer'){
      p.add(turn([[0,.31],[.27,.38],[.32,.43],[.32,.66],[.23,.72],[0,.72]],8),'#c69653');
      for(let j=0;j<8;j++){const a=j*Math.PI/4;
        p.add(box(0,.54,.296,.201,.144,.018).rotateY(a),j%2?'#596472':'#caa064');
        for(let k=0;k<3;k++)p.add(box(0,.49+k*.043,.308,.16,.009,.008).rotateY(a),j%2?'#a5a9a2':'#846444');}
      p.add(rod([0,.62,0],[0,1.30,0],.035,.021),'#d6d9cf');
      for(let i=0;i<4;i++)p.add(ring(.07+i*.026,.012,24).rotateX(Math.PI/2).translate(0,1.03+i*.08,0),'#bfc9bd');
    }else{
      p.add(box(0,.49,0,.55,.24,.31),'#466779');p.add(rod([0,.60,0],[0,1.03,0],.064,.042),'#ccb186');
      p.add(turn([[0,0],[.16,.028],[.31,.103],[.43,.19],[.43,.206],[.28,.123],[.11,.063],[0,.044]],30).rotateX(.48).translate(0,1.02,0),'#c8dbd6');
      for(let i=0;i<8;i++){
        const a=i*Math.PI/4;p.add(rod([.12*Math.cos(a),.035,.12*Math.sin(a)],[.425*Math.cos(a),.191,.425*Math.sin(a)],.012,.009,6).rotateX(.48).translate(0,1.02,0),'#71888a');}
      for(let i=0;i<3;i++){const a=i*2*Math.PI/3;p.add(rod([.33*Math.sin(a),.12,.33*Math.cos(a)],[0,.35,0],.012,.009,6).rotateX(.48).translate(0,1.02,0),'#9da898');}
      p.add(ball(0,1.32,.16,.054,.047,.048,10),'#b49671');
    }return p.finish();},[moon]);
  const q=useMemo(()=>new Quaternion().setFromUnitVectors(axis,s.up),[s]);useEffect(()=>()=>g.dispose(),[g]);
  return <mesh name={'planet:survey-'+moon.id} geometry={g} position={s.base} quaternion={q} raycast={noPick}>
    {moon.instrument==='prism'||moon.instrument==='kiln'?<shaderMaterial vertexColors uniforms={daylight} vertexShader={instrumentVertex} fragmentShader={instrumentFragment}/>:<meshStandardMaterial vertexColors metalness={.22} roughness={.58} fog={false}/>}
  </mesh>;
}
function portHardware(){
  const parts=new PaintedParts();
  // Low annular wind nozzles. Keep the centre open and taper the collars into
  // the curved ground; no vertical posts in the player's actual flight path.
  for(const [r,tube,y,paint] of [[.68,.075,.0,'#364955'],[.71,.023,.054,'#b3ab97'],[.48,.028,.024,'#99a6a0']] as const)
    parts.add(ring(r,tube,56).rotateX(Math.PI/2).translate(0,y,0),paint);
  for(let i=0;i<18;i++){
    const a=i*Math.PI/9;parts.add(box(0,.034,.565,.074,.085,.19).rotateY(a+.17),i%3?'#697b83':'#a4aea9');
  }
  return parts.finish();
}
function Terminal({hardware,port,lane,back,active,pick}:{hardware:ReturnType<typeof portHardware>;port:WindPort;lane:WindLane;back:boolean;active:boolean;pick:(lane:WindLane)=>void}){
  const zh=useLanguageStore(s=>s.language==='zh');
  const q=useMemo(()=>new Quaternion().setFromUnitVectors(axis,port.up),[port]);
  const {hovered,bindings}=useSceneAction('glassPlanet',(from,to)=>windPlateSight(lane,back,from,to),()=>pick(lane));
  const code=lane.moon.sign.split(' · ')[0];
  const sign=useMemo(()=>paintedSurface(512,384,c=>{
    c.fillStyle='#26353b';c.fillRect(0,0,512,384);c.fillStyle=lane.moon.color;c.fillRect(12,12,5,168);c.textAlign='center';
    c.fillStyle='#fbf1d7';c.font='bold 59px system-ui,sans-serif';c.fillText(back?(zh?'返航 · 琉璃星':'Opal · Return'):(zh?lane.moon.sign:lane.moon.caption.split('   /')[0]),259,80,455);
      c.font='600 24px system-ui,sans-serif';c.fillText(back?'RETURN TO MERIDIAN':lane.moon.caption,256,124,460);
      c.fillStyle=lane.moon.color;c.font='bold 25px system-ui,sans-serif';c.fillText(zh?'G   /   左 X':'G   /   LEFT X',256,168);
    c.translate(0,192);c.fillRect(12,12,5,168);c.font='600 100px system-ui,sans-serif';c.fillStyle='#f0e6cb';c.fillText(code,206,132);c.strokeStyle=lane.moon.color;c.lineWidth=7;c.beginPath();c.moveTo(325,118);c.lineTo(363,77);c.lineTo(363,103);c.moveTo(363,77);c.lineTo(336,77);c.stroke();
  }),[back,lane,zh,code]);useEffect(()=>()=>sign.dispose(),[sign]);
  useLayoutEffect(()=>{sign.repeat.y=.5;sign.offset.y=active ? .5 : 0;},[sign,active]);
  return <group name={'wind:'+lane.moon.id+(back?':return':':launch')} position={port.foot} quaternion={q}>
    <mesh geometry={hardware} raycast={noPick}><meshStandardMaterial vertexColors roughness={.62} fog={false}/></mesh>
    {active&&<mesh position-y={.078} rotation-x={-Math.PI/2} raycast={noPick}><ringGeometry args={[.68,.725,56]}/><meshBasicMaterial color={lane.moon.color} toneMapped={false}/></mesh>}
    <mesh name={'wind:map:'+lane.moon.id+(back?':away':':home')} position={[0,active ? .22 : .12,-.70]} rotation-x={active ? -.46 : -.73} scale={active ? 1 : .70} {...bindings}><planeGeometry args={[.82,.31]}/><meshBasicMaterial map={sign} color={hovered?'#ffffff':'#eee8dc'} side={DoubleSide} fog={false}/></mesh>
  </group>;
}
const fadeAtEye:MeshBasicMaterial['onBeforeCompile']=shader=>{
  shader.vertexShader='varying float eyeRange;\n'+shader.vertexShader.replace('#include <project_vertex>','#include <project_vertex>\neyeRange=length(mvPosition.xyz);');
  shader.fragmentShader='varying float eyeRange;\n'+shader.fragmentShader.replace('#include <color_fragment>','#include <color_fragment>\ndiffuseColor.a*=smoothstep(.75,2.7,eyeRange);');
};
// At most one departure ribbon and one small instanced tracer draw. A quiet
// landing has no animated wind draw calls and runs no particle loop.
function Slipstream({lane}:{lane:WindLane}){
  const field=useMemo(()=>windRibbons(lane),[lane]);useEffect(()=>()=>field.dispose(),[field]);
  const mesh=useRef<InstancedMesh>(null),s=useMemo(()=>({time:0,a:new Vector3(),b:new Vector3(),right:new Vector3(),normal:new Vector3(),obj:new Object3D()}),[]);
  useFrame((_,dt)=>{const m=mesh.current;if(!m)return;s.time=(s.time+Math.min(.05,dt))%300;
    for(let i=0;i<m.count;i++){
      const l=lane,t=(i*.618034+s.time/12)%1,theta=i*2.399+t*8;
      windPoint(l,t,s.a);windPoint(l,t+.001,s.b).sub(s.a).normalize();
      s.right.set(0,0,1).cross(s.b).normalize();s.normal.crossVectors(s.b,s.right);
      const width=.39+.22*Math.sin(Math.PI*t);
      s.obj.position.copy(s.a).addScaledVector(s.right,Math.cos(theta)*width).addScaledVector(s.normal,Math.sin(theta)*width);
      s.obj.quaternion.setFromUnitVectors(axis,s.b);s.obj.scale.set(.024,.18,.024).multiplyScalar(Math.min(1,t*20,(1-t)*20));s.obj.updateMatrix();m.setMatrixAt(i,s.obj.matrix);
    }m.instanceMatrix.needsUpdate=true;
  });
  return <><mesh name="wind:streamlines" geometry={field} raycast={noPick}><meshBasicMaterial vertexColors transparent opacity={.36} depthWrite={false} side={DoubleSide} forceSinglePass fog={false} onBeforeCompile={fadeAtEye}/></mesh>
    <instancedMesh ref={mesh} name="wind:particles" args={[undefined,undefined,26]} frustumCulled={false} raycast={noPick}><octahedronGeometry args={[1]}/><meshBasicMaterial color={lane.moon.color} transparent opacity={.64} depthWrite={false} fog={false} onBeforeCompile={fadeAtEye}/></instancedMesh></>;
}
export function WindSystem({grain}:{grain:Texture|null}){
  const hardware=useMemo(portHardware,[]);useEffect(()=>()=>hardware.dispose(),[hardware]);
  const [focus]=useState(createWindFocus),eye=useMemo(()=>new Vector3(),[]),[active,setActive]=useState<WindLane|null>(null),last=useRef<WindLane|null>(null);
  useFrame(({camera,gl})=>{(gl.xr.isPresenting?gl.xr.getCamera():camera).getWorldPosition(eye);const next=focus.read(eye);
    if(next!==last.current){last.current=next;setActive(next);}});
  return <group name="planet:wind-system" pointerEvents="none">
  {lanes.map(l=><group key={l.moon.id}>{l.moon.relief==='wetland'?<Reedwater moon={l.moon} grain={grain}/>:<Satellite moon={l.moon} grain={grain}/>}<Terminal hardware={hardware} lane={l} port={l.home} back={false} active={l===active} pick={focus.select}/><Terminal hardware={hardware} lane={l} port={l.away} back active={l===active} pick={focus.select}/></group>)}
  {moons.map(moon=><SurveyProbe key={moon.id} moon={moon}/>)}
  <SteppingMoons grain={grain}/>
  {active&&<group name={'wind:charted:'+active.moon.id}><Slipstream lane={active}/></group>}
</group>;}
