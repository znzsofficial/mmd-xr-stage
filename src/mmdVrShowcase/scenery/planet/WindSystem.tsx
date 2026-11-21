import {useEffect,useMemo,useRef} from 'react';
import {useFrame} from '@react-three/fiber';
import {Color,DoubleSide,InstancedMesh,Object3D,Quaternion,SphereGeometry,Vector3,type MeshBasicMaterial} from 'three';
import {ball,box,PaintedParts,ring,rod,turn} from '../../play/modelParts';
import {useBakedSurface} from '../useBakedSurface';
import {noPick,paintedSurface} from '../sceneryPaint';
import {lanes,moonRadius,moonStations,sunDirection,windPoint,type Moon,type WindLane,type WindPort} from './windAtlas';
import ember from './ember-basins.webp';
import frost from './frost-rifts.webp';
import {windRibbons} from './windRibbons';

export function moonShell(m:Moon){
  const g=new SphereGeometry(1,112,72),p=g.attributes.position;
  for(let i=0;i<p.count;i++){
    const x=p.getX(i),y=p.getY(i),z=p.getZ(i),r=moonRadius(m,x,y,z);
    p.setXYZ(i,x*r,y*r,z*r);
  }
  g.computeVertexNormals();g.computeBoundingSphere();return g;
}
function Satellite({moon}:{moon:Moon}){
  const g=useMemo(()=>moonShell(moon),[moon]),map=useBakedSurface(moon.id==='ember'?ember:frost);
  const u=useMemo(()=>{const s=moonStations[moon.id==='ember'?0:1];return {albedo:{value:map},sun:{value:sunDirection},ice:{value:moon.id==='frost'?1:0},probe:{value:s.base},probeUp:{value:s.up}};},[map,moon]);
  useEffect(()=>()=>g.dispose(),[g]);
  return <mesh name={'planet:moon-'+moon.id} geometry={g} position={moon.centre} userData={{playerCollision:false}} raycast={noPick}>
    {map?<shaderMaterial uniforms={u} vertexShader={`varying vec2 st;varying vec3 n,v,world;
      void main(){st=uv;n=mat3(modelMatrix)*normal;vec4 p=modelMatrix*vec4(position,1.);world=p.xyz;v=cameraPosition-p.xyz;gl_Position=projectionMatrix*viewMatrix*p;}`}
      fragmentShader={`uniform sampler2D albedo;uniform vec3 sun,probe,probeUp;uniform float ice;varying vec2 st;varying vec3 n,v,world;
        float shade(vec3 center,float rad){vec3 diff=center-world;float t=dot(diff,sun);return smoothstep(.015,.15,t)*(1.-smoothstep(rad*.75,rad+.03,length(diff-t*sun)));}
        void main(){vec3 N=normalize(n),V=normalize(v);float day=dot(N,sun),facing=max(0.,dot(N,V));
          vec3 base=texture2D(albedo,st).rgb;
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
function SurveyProbe({station:s}:{station:typeof moonStations[number]}){
  const g=useMemo(()=>{const p=new PaintedParts();
    for(let i=0;i<3;i++){
      const a=i*2*Math.PI/3,x=.40*Math.cos(a),z=.40*Math.sin(a);
      p.add(rod([x,-.09,z],[x*.39,.54,z*.39],.034,.026,8),'#aab2ab');p.add(ball(x,-.015,z,.096,.039,.080,8),'#696a66');
    }
    if(s.moon.id==='ember'){
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
    }return p.finish();},[s]);
  const q=useMemo(()=>new Quaternion().setFromUnitVectors(axis,s.up),[s]);useEffect(()=>()=>g.dispose(),[g]);
  return <mesh name={'planet:survey-'+s.moon.id} geometry={g} position={s.base} quaternion={q} raycast={noPick}><meshStandardMaterial vertexColors metalness={.22} roughness={.58} fog={false}/></mesh>;
}
function portHardware(color:string){
  const parts=new PaintedParts();
  // Low annular wind nozzles. Keep the centre open and taper the collars into
  // the curved ground; no vertical posts in the player's actual flight path.
  for(const [r,tube,y,paint] of [[.68,.075,.0,'#364955'],[.71,.023,.054,color],[.48,.028,.024,'#99a6a0']] as const)
    parts.add(ring(r,tube,56).rotateX(Math.PI/2).translate(0,y,0),paint);
  for(let i=0;i<18;i++){
    const a=i*Math.PI/9;parts.add(box(0,.034,.565,.074,.085,.19).rotateY(a+.17),i%3?'#697b83':color);
  }
  return parts.finish();
}
function Terminal({port,lane,back}:{port:WindPort;lane:WindLane;back:boolean}){
  const g=useMemo(()=>portHardware(lane.moon.color),[lane]);
  const q=useMemo(()=>new Quaternion().setFromUnitVectors(axis,port.up),[port]);
  const sign=useMemo(()=>paintedSurface(512,192,c=>{
    c.fillStyle='#192d3c';c.fillRect(0,0,512,192);c.fillStyle=lane.moon.color;c.fillRect(0,0,11,192);c.fillRect(22,137,467,3);
    c.textAlign='center';c.fillStyle='#fbf1d7';c.font='bold 59px system-ui,sans-serif';c.fillText(back?'返航 · 琉璃星':lane.moon.id==='ember'?'01 · 赭砾星':'02 · 霜岬星',265,84);
    c.font='600 23px system-ui,sans-serif';c.fillText(back?'RETURN TO MERIDIAN':lane.moon.id==='ember'?'EMBER   /   IMPACT BASINS':'FROST   /   ICE RIFTS',262,124);
    c.font='bold 25px system-ui,sans-serif';c.fillText('↑    G   /   LEFT  X',260,173);
  }),[back,lane]);useEffect(()=>()=>{g.dispose();sign.dispose();},[g,sign]);
  return <group name={'wind:'+lane.moon.id+(back?':return':':launch')} position={port.foot} quaternion={q}>
    <mesh geometry={g} raycast={noPick}><meshStandardMaterial vertexColors roughness={.62} fog={false}/></mesh>
    <mesh position={[0,.22,-.70]} rotation-x={-.46} raycast={noPick}><planeGeometry args={[.82,.31]}/><meshBasicMaterial map={sign} side={DoubleSide} fog={false}/></mesh>
  </group>;
}
const fadeAtEye:MeshBasicMaterial['onBeforeCompile']=shader=>{
  shader.vertexShader='varying float eyeRange;\n'+shader.vertexShader.replace('#include <project_vertex>','#include <project_vertex>\neyeRange=length(mvPosition.xyz);');
  shader.fragmentShader='varying float eyeRange;\n'+shader.fragmentShader.replace('#include <color_fragment>','#include <color_fragment>\ndiffuseColor.a*=smoothstep(.75,2.7,eyeRange);');
};
// One instanced draw for both streams. Short drifting streaks trace the arc,
// with ample clear space through the middle and no full-screen effects.
function Slipstreams(){
  const field=useMemo(windRibbons,[]);useEffect(()=>()=>field.dispose(),[field]);
  const mesh=useRef<InstancedMesh>(null),s=useMemo(()=>({time:0,a:new Vector3(),b:new Vector3(),right:new Vector3(),normal:new Vector3(),obj:new Object3D()}),[]);
  useEffect(()=>{const m=mesh.current;if(!m)return;for(let i=0;i<72;i++)m.setColorAt(i,new Color(lanes[i%2].moon.color));m.instanceColor!.needsUpdate=true;},[]);
  useFrame((_,dt)=>{const m=mesh.current;if(!m)return;s.time=(s.time+Math.min(.05,dt))%300;
    for(let i=0;i<72;i++){
      const l=lanes[i%2],t=(i*.618034+s.time/12)%1,theta=i*2.399+t*8;
      windPoint(l,t,s.a);windPoint(l,t+.001,s.b).sub(s.a).normalize();
      s.right.set(0,0,1).cross(s.b).normalize();s.normal.crossVectors(s.b,s.right);
      const width=.39+.22*Math.sin(Math.PI*t);
      s.obj.position.copy(s.a).addScaledVector(s.right,Math.cos(theta)*width).addScaledVector(s.normal,Math.sin(theta)*width);
      s.obj.quaternion.setFromUnitVectors(axis,s.b);s.obj.scale.set(.024,.18,.024).multiplyScalar(Math.min(1,t*20,(1-t)*20));s.obj.updateMatrix();m.setMatrixAt(i,s.obj.matrix);
    }m.instanceMatrix.needsUpdate=true;
  });
  return <><mesh name="wind:streamlines" geometry={field} raycast={noPick}><meshBasicMaterial vertexColors transparent opacity={.36} depthWrite={false} side={DoubleSide} forceSinglePass fog={false} onBeforeCompile={fadeAtEye}/></mesh>
    <instancedMesh ref={mesh} name="wind:particles" args={[undefined,undefined,72]} frustumCulled={false} raycast={noPick}><octahedronGeometry args={[1]}/><meshBasicMaterial transparent opacity={.70} depthWrite={false} fog={false} onBeforeCompile={fadeAtEye}/></instancedMesh></>;
}
export function WindSystem(){return <group name="planet:wind-system" pointerEvents="none">
  {lanes.map(l=><group key={l.moon.id}><Satellite moon={l.moon}/><Terminal lane={l} port={l.home} back={false}/><Terminal lane={l} port={l.away} back/></group>)}
  {moonStations.map(s=><SurveyProbe key={s.moon.id} station={s}/>)}
  <Slipstreams/>
</group>;}
