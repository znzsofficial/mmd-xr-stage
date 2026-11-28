import {DaySurface,RoomShader} from '../daylightMaterials';
import { useEffect, useMemo } from 'react';
import { DoubleSide, SphereGeometry } from 'three';
import { Batch } from '../SceneryBatch';
import { useBakedSurface } from '../useBakedSurface';
import { WARD, FIXTURES } from './clinicLayout';
import { bowlGeometry, ClinicParts, curtainGeometry, padGeometry } from './clinicParts';
import { clinicShell } from './clinicShell';
import { examRoom, operatingRoom, washroom, MIRROR_Y } from './clinicEquipment';
import atlasUrl from './clinic-plates.webp';
import floorUrl from './clinic-floor.webp';
import educationUrl from './clinic-education.webp';
import teachingUrl from './clinic-teaching.webp';
import { instrumentGeometry, teachingModelGeometry } from './teachingSolids';
import {GardenEntrance} from './GardenEntrance';
import {SupplyCasework} from './SupplyCasework';
import {ClinicNurse} from './ClinicNurse';
import {wardBounce as bounce} from './wardDaylight';

const noPick=()=>null;

// Brushed steel mirrors show a deliberately diffuse architectural reflection.
// Re-project the opposite wall, partition and light in the eye's reflected
// direction; no render target or extra pass over the room/actor per XR eye.
const mirrorV=`varying vec3 worldP;void main(){vec4 p=modelMatrix*vec4(position,1.);worldP=p.xyz;gl_Position=projectionMatrix*viewMatrix*p;}`;
const mirrorF=`varying vec3 worldP;
void main(){
  if(abs(worldP.x-(${FIXTURES.sinks.x.toFixed(2)}))<.132)discard;
  vec3 ray=reflect(normalize(worldP-cameraPosition),vec3(0.,0.,1.));
  float back=(-3.33-worldP.z)/max(.0001,ray.z);
  vec3 pos=worldP+back*ray;
  vec3 c=mix(vec3(.42,.50,.46),vec3(.62,.64,.56),smoothstep(.87,1.01,pos.y));
  c=mix(c,vec3(.38,.47,.44),.5*(1.-smoothstep(.018,.056,abs(pos.y-.95))));
  c=mix(c,vec3(.41,.45,.42),1.-smoothstep(-.04,.10,pos.y));
  c=mix(c,vec3(.63,.66,.61),smoothstep(3.04,3.16,pos.y));
  float tx=(-6.40-worldP.x)/min(-.001,ray.x);vec3 stall=worldP+ray*tx;
  float cover=step(tx,back)*step(ray.x,-.001)*smoothstep(.14,.25,stall.y)*(1.-smoothstep(2.01,2.10,stall.y));
  cover*=smoothstep(-8.8,-8.74,stall.z)*(1.-smoothstep(-4.43,-4.38,stall.z));
  cover*=smoothstep(.44,.54,abs(stall.z+7.69));
  c=mix(c,vec3(.32,.44,.40),cover*.88);
  float t=(3.12-worldP.y)/max(.0001,ray.y);vec3 lit=worldP+ray*t;
  c+=vec3(.34,.32,.25)*step(.001,ray.y)*step(t,back)*(1.-smoothstep(.34,.65,abs(lit.x+5.4)))*(1.-smoothstep(.13,.36,abs(lit.z+5.47)));
  gl_FragColor=vec4(c*.83+vec3(.06,.084,.088),1.);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;

export function ClinicWard({ shadows }: {shadows:boolean}) {
  const p=useMemo(()=>{const p=new ClinicParts();clinicShell(p);examRoom(p);operatingRoom(p);washroom(p);return p;},[]);
  const geo=useMemo(()=>({pad:padGeometry(),bowl:bowlGeometry(),egg:new SphereGeometry(.5,12,8),plates:p.platesGeometry(),education:p.platesGeometry('education'),teaching:p.platesGeometry('teaching'),models:teachingModelGeometry(),instruments:instrumentGeometry(),cloth:curtainGeometry(FIXTURES.curtain.x,FIXTURES.curtain.z)}),[p]);
  const atlas=useBakedSurface(atlasUrl),floor=useBakedSurface(floorUrl),education=useBakedSurface(educationUrl);
  const teaching=useBakedSurface(teachingUrl);
  useEffect(()=>()=>{for(const g of Object.values(geo))g.dispose();},[geo]);
  return <group name="scenery:clinic">
    <ClinicNurse shadows={shadows}/>
    <GardenEntrance city shadows={shadows}/>
    <SupplyCasework shadows={shadows}/>
    <mesh name="clinic:terrazzo-and-furniture-contact" position={[0,0,(WARD.south+WARD.north)/2]} rotation-x={-Math.PI/2} receiveShadow={shadows} raycast={noPick}>
      <planeGeometry args={[WARD.east-WARD.west,WARD.south-WARD.north]}/><DaySurface key={floor?'floor':'plain'} map={floor} color={floor?'white':'#c7cfbf'} roughness={.61} onBeforeCompile={bounce}/>
    </mesh>
    <Batch name="clinic:architecture-and-casework" parts={p.blocks} shade={bounce}/>
    <Batch name="clinic:upholstery-and-bevels" parts={p.soft} geometry={geo.pad} roughness={.56} shade={bounce} casts={shadows}/>
    <Batch name="clinic:frames-and-lamp-arms" parts={p.poles} round roughness={.36} shade={bounce}/>
    <Batch name="clinic:glazed-sanitaryware" parts={p.bowls} geometry={geo.bowl} roughness={.24} shade={bounce}/>
    <Batch name="clinic:formed-fittings" parts={p.ovals} geometry={geo.egg} shade={bounce}/>
    <Batch name="clinic:recessed-panels" parts={p.glow} lit/>
    <Batch name="clinic:theatre-led-optics" parts={p.bulbs} round lit/>
    <mesh name="clinic:gathered-privacy-linen" raycast={noPick} receiveShadow={shadows}>
      <primitive object={geo.cloth} attach="geometry"/><DaySurface vertexColors side={DoubleSide} roughness={.98} onBeforeCompile={bounce}/>
    </mesh>
    <mesh name="clinic:bilingual-signs-prints-and-displays" raycast={noPick}>
      <primitive object={geo.plates} attach="geometry"/><meshBasicMaterial key={atlas?'atlas':'underprint'} map={atlas} color={atlas?'white':'#c5d4c6'}/>
    </mesh>
    <mesh name="clinic:six-authored-obstetric-education-plates" raycast={noPick}>
      <primitive object={geo.education} attach="geometry"/><DaySurface map={education} color={education?'white':'#e9e5ce'} roughness={.9} onBeforeCompile={bounce}/>
    </mesh>
    <mesh name="clinic:anatomical-castings" raycast={noPick}>
      <primitive object={geo.models} attach="geometry"/><DaySurface vertexColors roughness={.60} onBeforeCompile={bounce}/>
    </mesh>
    <mesh name="clinic:stainless-instrument-set" raycast={noPick}>
      <primitive object={geo.instruments} attach="geometry"/><DaySurface vertexColors metalness={.22} roughness={.38} side={DoubleSide} onBeforeCompile={bounce}/>
    </mesh>
    <mesh name="clinic:teaching-and-supply-prints" raycast={noPick}>
      <primitive object={geo.teaching} attach="geometry"/><meshBasicMaterial key={teaching?'teaching':'paper'} map={teaching} color={teaching?'white':'#efe8d8'}/>
    </mesh>
    <mesh name="clinic:twin-vanity-mirrors" position={[FIXTURES.sinks.x,MIRROR_Y,-8.853]} raycast={noPick}>
      <planeGeometry args={[2.394,.77]}/><RoomShader effect="mirror" vertexShader={mirrorV} fragmentShader={mirrorF}/>
    </mesh>
  </group>;
}
