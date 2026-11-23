import {useLayoutEffect,useMemo,useRef} from 'react';
import {useFrame} from '@react-three/fiber';
import {Color,Group,InstancedMesh,Object3D,Vector3} from 'three';
import {ball,box,rod,turn} from '../../play/modelParts';
import {stations,crustRadius} from './opalTerrain';
import {PLANET_RADIUS as R} from './planetLayout';
import {courseUp} from './opalCourse';
import {sampleInk} from './opalSurvey';
import {InstrumentParts,instrumentFinish} from './instrumentFinish';

const cream='#ffe8b4',brass='#cf874d',enamel='#156269',glass='#9fe4cf',seal='#28374c';
// Same pose as the runtime collider. All detail stays on one column, wholly
// outside the clear walk between the pair of entrance pylons.
export function buildStation(s:typeof stations[number]){
  const g=new InstrumentParts(s.style==='geode'),{r,height:h}=s,collar=(y:number,rr:number,hw:number,c:string)=>g.add(turn([[rr,y-hw],[rr,y+hw]],20),c);
  if(s.style==='geode'){
    const colors=s.name==='coral-quartz'?['#dd765d','#f8b07b','#ad5f85']:['#319e9c','#9be7bf','#62bdb1'];
    g.add(turn([[0,-.3],[r*.9,-.16],[r,.07],[r*.80,.23],[r*.38,.32],[0,.32]],9),'#5a6685');
    for(let i=0;i<7;i++){const a=i*2.41,side=i===0?0:r*.52,L=h*(i===0?1:.37+.32*(.5+.5*Math.cos(i*1.7))),w=r*(i===0?.28:.17);
      const b=Math.sin(a)*side,z=Math.cos(a)*side;
      g.add(turn([[w*.76,.08],[w,L*.24],[w*.66,L*.77],[0,L]],5).rotateZ(i===0?.10:Math.sin(a)*-.27).rotateX(i===0?.04:Math.cos(a)*.27).translate(b,0,z),colors[i%3]);}
    return g.finish();
  }
  // The shoe and enamel casting share their joint ring. Overlapping two
  // tapered solids with different facet counts left a sawtooth at the seam.
  g.add(turn([[0,-.30],[r*.89,-.30],[r,.04],[r,.13],[r*.88,.17],[r*.86,.18]],s.style==='dome'?16:10),brass);
  if(s.style==='dome'){
    g.add(turn([[r*.86,.18],[r*.85,.31],[r*.78,.38],[r*.78,.97],[r*.88,1.02],[r*.88,1.12]],16),enamel);
    // Fit the window castings to the housing's actual flat faces. The glass
    // sits between four raised rebates; the brow overhangs only the frame.
    const sill=r*.78*Math.cos(Math.PI/16),w=r*.204,H=.28;
    for(let i=0;i<16;i++){const a=(i+.5)*Math.PI/8;
      g.add(box(0,.665,sill+.012,w,H,.020).rotateY(a),i%4?'#2a4f62':'#ffd489');
      for(const side of [-1,1])g.add(box(side*(w/2+.011),.665,sill+.021,.023,H+.045,.046).rotateY(a),'#b28b63');
      g.add(box(0,.665-H/2-.011,sill+.022,w,.023,.05).rotateY(a),'#b28b63');
      g.add(box(0,.665+H/2+.018,sill+.033,w+.055,.034,.076).rotateY(a),'#edcc96');
      if(i%4===0)g.add(box(0,.65,sill+.026,w,.012,.012).rotateY(a),enamel);
    }
    g.add(turn([[r*.88,1.12],[r*.902,1.14],[r*.902,1.21],[r*.89,1.23]],16),brass);
    g.add(turn([[r*.89,1.23],[r*.84,1.36],[r*.67,1.56],[r*.34,h-.16],[.09,h-.10],[0,h-.10]],16),cream);
    for(let i=0;i<8;i++){const a=i*Math.PI/4;
      const ribs=[[r*.90,1.19],[r*.854,1.36],[r*.685,1.56],[r*.35,h-.16],[.09,h-.098]];
      for(let j=1;j<ribs.length;j++){const [lo,ly]=ribs[j-1],[hi,hy]=ribs[j];g.add(rod([lo*Math.sin(a),ly,lo*Math.cos(a)],[hi*Math.sin(a),hy,hi*Math.cos(a)],.020,.018,7),i%2?brass:enamel);}}
    g.add(ball(0,h-.09,0,.075,.09,.075,10),glass);g.add(turn([[r*.808,.354],[r*.824,.358],[r*.810,.369],[r*.796,.373]],16),cream);
  }else{
    g.add(turn([[r*.86,.18],[r*.73,.28],[r*.58,.39],[r*.52,h*.49],[r*.63,h*.52],[r*.63,h*.56],[r*.41,h*.58],[0,h*.58]],10),s.style==='beacon'?'#bc604c':enamel);
    collar(h*.37,r*.57,.035,cream);
    if(s.style==='fork'){
      for(const side of [-1,1]){g.add(rod([side*r*.42,h*.53,0],[side*r*.74,h*.91,0],.097,.065,7),brass);g.add(ball(side*r*.74,h*.91,0,.071,.104,.071,8),cream);}
    }else{
      g.add(turn([[0,h*.52],[r*.53,h*.59],[r*.41,h*.78],[.06,h*.86],[0,h*.87]],8),glass);
      g.add(turn([[0,h*.84],[r*.62,h*.80],[r*.54,h*.85],[.08,h*.92],[0,h]],10),cream);
      for(let i=0;i<6;i++){const a=i*Math.PI/3;g.add(rod([r*.52*Math.sin(a),h*.56,r*.52*Math.cos(a)],[r*.44*Math.sin(a),h*.82,r*.44*Math.cos(a)],.026,.019,6),seal);}
    }
  }
  // A cast maker's boss on the plinth, below the painted enclosure.
  g.add(ball(0,.088,r*.999,.074,.032,.018,12),cream);
  return g.finish();
}
function Station({s,lamps}:{s:typeof stations[number];lamps:number}){
  const geo=useMemo(()=>buildStation(s),[s]),a=useRef<Group>(null);
  const west=s.name==='west-prism',lit=Boolean(lamps&(west?1:2)),colour=west?sampleInk.aqua:sampleInk.coral;
  useLayoutEffect(()=>()=>geo.dispose(),[geo]);
  useFrame((_,dt)=>{if(a.current)a.current.rotation.y+=Math.min(.1,dt)*.46;});
  return <group name={'planet:'+s.name} position={s.base} quaternion={s.rotation}>
    <mesh geometry={geo}><meshStandardMaterial vertexColors onBeforeCompile={instrumentFinish}/></mesh>
    {s.style==='fork'&&<group name={'survey:lamp-'+(west?'aqua':'coral')} userData={{lit}}>
      <mesh position-y={s.height*.75} scale={[s.r*.44,s.height*.20,s.r*.44]}><octahedronGeometry args={[1]}/><meshStandardMaterial color={lit?colour:'#677e7f'} emissive={lit?colour:'#000000'} emissiveIntensity={.85} roughness={.34}/></mesh>
      <mesh position-y={s.height*.54}><cylinderGeometry args={[s.r*.64,s.r*.64,.065,10]}/><meshBasicMaterial color={lit?colour:'#637071'} toneMapped={false}/></mesh>
    </group>}
    {s.style==='beacon'&&<group ref={a} position-y={s.height*.68} rotation-z={.22}>
      <mesh rotation-x={Math.PI/2}><torusGeometry args={[s.r*.78,.023,8,48]}/><meshBasicMaterial color="#92fce3"/></mesh>
      <mesh position-x={s.r*.77}><octahedronGeometry args={[.065]}/><meshBasicMaterial color="#ffe69b"/></mesh></group>}
  </group>;
}
export function MeridianStations({lamps}:{lamps:number}){return <>{stations.map(s=><Station key={s.name} s={s} lamps={lamps}/>)}</>;}

/** A few slowly drifting phosphor grains around the two mineral springs.
 * One draw, no extra lights, textures or collision bodies. */
export function SpringLights(){
  const ref=useRef<InstancedMesh>(null),scratch=useMemo(()=>({o:new Object3D(),v:new Vector3(),t:0}),[]);
  const springs=useMemo(()=>stations.filter(s=>s.style==='geode'),[]);
  useFrame((_,dt)=>{const m=ref.current;if(!m)return;const s=scratch;s.t+=Math.min(.1,dt);
    for(let i=0;i<40;i++){const p=springs[i%springs.length],k=(i*.618+s.t*(.12+.018*(i%3)))%1,a=i*2.4+k*.8;
      s.v.set(Math.sin(a)*(.36+k*.39),p.height*.72+k*.94,Math.cos(a)*(.36+k*.39)).applyQuaternion(p.rotation).add(p.base);
      s.o.position.copy(s.v);s.o.scale.setScalar(.016*Math.sin(k*Math.PI));s.o.updateMatrix();m.setMatrixAt(i,s.o.matrix);
    }m.instanceMatrix.needsUpdate=true;});
  return <instancedMesh name="planet:phosphor" ref={ref} args={[undefined,undefined,40]} frustumCulled={false} raycast={()=>null}><octahedronGeometry args={[1]}/><meshBasicMaterial color="#d7ffbd" toneMapped={false}/></instancedMesh>;
}

export function MeridianMarks(){
  const inst=useRef<InstancedMesh>(null);
  useLayoutEffect(()=>{const m=inst.current!,o=new Object3D(),c=new Color();
    for(let i=0;i<110;i++){const a=(i+5)*2*Math.PI/120,v=courseUp(a);o.position.copy(v).multiplyScalar(crustRadius(v.x,v.y,v.z)+.019);o.position.y-=R;
      const next=courseUp(a+.001),tangent=next.addScaledVector(v,-next.dot(v)).normalize();o.up.copy(v);o.lookAt(tangent.add(o.position));
      o.scale.set(i%5===0?.15:.073,.022,i%5===0?.058:.045);o.updateMatrix();m.setMatrixAt(i,o.matrix);m.setColorAt(i,c.set(i%5===0?'#a5724b':'#8b6850'));}
    m.instanceMatrix.needsUpdate=true;m.computeBoundingSphere();},[]);
  return <instancedMesh ref={inst} args={[undefined,undefined,110]}><octahedronGeometry args={[1]}/><meshStandardMaterial roughness={.55}/></instancedMesh>;
}
