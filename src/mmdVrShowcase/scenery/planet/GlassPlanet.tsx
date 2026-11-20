import {useLayoutEffect,useMemo,useRef} from 'react';
import {BackSide,Color,IcosahedronGeometry,Float32BufferAttribute,InstancedMesh,Object3D,RepeatWrapping,Vector3} from 'three';
import {PLANET_RADIUS as R,PAD_RADIUS} from './planetLayout';
import {useBakedSurface} from '../useBakedSurface';
import mineral from '../retreat/mineral.webp';

// A celestial sphere, not a terrestrial horizon. Remove camera translation
// for both eyes, so stars remain at infinity while walking the lower hemisphere.
export function PlanetSky(){return <mesh frustumCulled={false} renderOrder={-100} raycast={()=>null}><sphereGeometry args={[1,40,32]}/>
  <shaderMaterial side={BackSide} depthWrite={false} toneMapped={false}
    vertexShader={`varying vec3 skyDir; void main(){skyDir=position;vec4 p=projectionMatrix*vec4(mat3(viewMatrix)*position,1.);gl_Position=p.xyww;}`}
    fragmentShader={`varying vec3 skyDir;
      float hash(vec3 p){p=fract(p*.1031);p+=dot(p,p.yzx+33.33);return fract((p.x+p.y)*p.z);}
      void main(){vec3 n=normalize(skyDir);float lat=dot(n,normalize(vec3(.42,.88,.19)));
        float band=exp(-12.*abs(lat+.05*sin(7.*n.x+3.*n.z)));float dust=.6+.24*sin(16.*n.z+8.*n.x)+.12*sin(31.*n.x-19.*n.z);
        vec3 c=vec3(.006,.009,.029)+band*dust*mix(vec3(.055,.10,.19),vec3(.15,.064,.15),.5+.5*n.x);
        vec3 cell=n*63.;vec3 id=floor(cell);float seed=hash(id);vec3 spot=.22+.56*vec3(hash(id+2.),hash(id+8.),hash(id+19.));
        float d=length(fract(cell)-spot);float star=step(.70,seed)*(1.-smoothstep(.035,.16,d));
        c+=star*mix(vec3(.59,.72,.96),vec3(1.,.78,.57),hash(id+41.));gl_FragColor=vec4(c,1.);
        #include <colorspace_fragment>
      }`}/></mesh>}
// Opaline basalt and a brass meridian. All marks on the walk are flush inlays.
export function GlassPlanet(){
  const print=useBakedSurface(mineral);
  useLayoutEffect(()=>{if(print){print.wrapS=print.wrapT=RepeatWrapping;print.repeat.set(16,8);print.needsUpdate=true}},[print]);
  const stone=useMemo(()=>{const geo=new IcosahedronGeometry(R,15),p=geo.attributes.position,colors=[],c=new Color();
    for(let i=0;i<p.count;i++){const x=p.getX(i)/R,y=p.getY(i)/R,z=p.getZ(i)/R;
      const bands=Math.sin(9*x+4*y+3*Math.sin(4*z+2*y))+.46*Math.sin(17*y-5*z)+.16*Math.cos(39*z+14*x);
      const seam=Math.max(0,1-6*Math.abs(bands+.16));c.setHSL(.59+.075*Math.sin(2*x+3*z)+.035*bands,.24+.22*seam,.24+.085*bands+.23*seam);
      colors.push(c.r,c.g,c.b);}
    geo.setAttribute('color',new Float32BufferAttribute(colors,3));return geo;},[]);
  useLayoutEffect(()=>()=>stone.dispose(),[stone]);
  const markers=useRef<InstancedMesh>(null);
  useLayoutEffect(()=>{const o=new Object3D(),up=new Vector3(0,1,0),n=new Vector3();for(let i=0;i<96;i++){
    const a=(i+4)*Math.PI*2/104;n.set(0,Math.cos(a),-Math.sin(a));o.position.copy(n).multiplyScalar(R+.021);o.quaternion.setFromUnitVectors(up,n);o.scale.set(i%4===0?.25:.09,.022,i%4===0?.12:.08);o.updateMatrix();markers.current!.setMatrixAt(i,o.matrix);
  }markers.current!.instanceMatrix.needsUpdate=true;markers.current!.computeBoundingSphere()},[]);
  return <group name="planet:glass-meridian">
    <group position-y={-R}>
      <mesh geometry={stone}><meshStandardMaterial key={print?.uuid} vertexColors roughness={.68} metalness={.09} bumpMap={print} bumpScale={.024}/></mesh>
      <instancedMesh ref={markers} args={[undefined,undefined,96]}><octahedronGeometry args={[1,0]}/><meshStandardMaterial color="#ecbe76" emissive="#695333" roughness={.52}/></instancedMesh>
      <mesh rotation-y={Math.PI/2}><torusGeometry args={[R+.012,.017,5,144]}/><meshStandardMaterial color="#947247" roughness={.57}/></mesh>
      <mesh rotation-x={Math.PI/2}><torusGeometry args={[R+.012,.027,5,144]}/><meshStandardMaterial color="#c29863" roughness={.5}/></mesh>
    </group>
    <mesh position-y={-.17}><cylinderGeometry args={[PAD_RADIUS,PAD_RADIUS-.10,.34,72]}/><meshStandardMaterial color="#787780" roughness={.64}/></mesh>
    {[2.56,2.7].map(r=><mesh key={r} rotation-x={Math.PI/2}><torusGeometry args={[r,.011,6,80]}/><meshStandardMaterial color="#c69d65"/></mesh>)}
    <group position={[9.8,5.6,-17.8]} rotation={[.39,.42,-.20]}>
      <mesh><sphereGeometry args={[2.7,48,32]}/><meshStandardMaterial color="#c79ba0" roughness={.85}/></mesh>
      {[3.4,3.58,3.9,4.15].map((r,i)=><mesh key={r} rotation-x={Math.PI/2}><torusGeometry args={[r,[.065,.085,.16,.038][i],7,96]}/><meshStandardMaterial color={i%2?'#debbae':'#bf997d'}/></mesh>)}
    </group>
  </group>;
}
