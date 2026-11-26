import {RoomShader} from '../daylightMaterials';
import {useEffect,useMemo} from 'react';
import {BackSide,DoubleSide,type MeshStandardMaterial} from 'three';
import {Batch} from '../SceneryBatch';
import {noPick} from '../sceneryPaint';
import {useBakedSurface} from '../useBakedSurface';
import {makeSonghouse} from './songhouseGeometry';
import silkUrl from './songhouse-silk.webp';
import closeUrl from './songhouse-close.webp';
import quartersUrl from './quarters-silk.webp';
import folioUrl from './chamber-paintings.webp';
import {DressingAlbum} from './DressingAlbum';

const tileCourses:MeshStandardMaterial['onBeforeCompile']=shader=>{
  shader.vertexShader='varying vec2 tileUv;\n'+shader.vertexShader.replace('#include <uv_vertex>','#include <uv_vertex>\n tileUv=uv;');
  shader.fragmentShader='varying vec2 tileUv;\n'+shader.fragmentShader.replace('#include <color_fragment>',`#include <color_fragment>
    float rib=cos(tileUv.x*38.5);float course=fract(tileUv.y*4.7+0.055*rib);
    diffuseColor.rgb*=.92+.15*rib+smoothstep(.81,.98,rib)*.12-.17*smoothstep(.84,1.,course);`);
};
// Joinery grain follows the longest axis of each instance. Stone paving uses
// the same material and a different mineral wash. No texture state per plank.
const joinery:MeshStandardMaterial['onBeforeCompile']=shader=>{
  shader.vertexShader='varying vec2 engraving;varying vec3 qWorld;\n'+shader.vertexShader.replace('#include <project_vertex>',`#include <project_vertex>
    qWorld=(modelMatrix*instanceMatrix*vec4(position,1.)).xyz;
    vec3 sz=vec3(length(instanceMatrix[0].xyz),length(instanceMatrix[1].xyz),length(instanceMatrix[2].xyz));vec3 v=position*sz;
    engraving=sz.x>sz.y&&sz.x>sz.z?vec2(v.x,v.y+v.z):sz.y>sz.z?vec2(v.y,v.z+v.x):vec2(v.z,v.x+v.y);`);
  shader.fragmentShader='varying vec2 engraving;varying vec3 qWorld;\n'+shader.fragmentShader.replace('#include <color_fragment>',`#include <color_fragment>
    float x=engraving.x,z=engraving.y;float n=sin(x*1.45+qWorld.x*.42)+.3*sin(x*3.3+z*.8);
    float grain=sin(36.*z+2.3*n)+.38*sin(78.*z+4.1*n);float timber=smoothstep(1.32,1.9,diffuseColor.r/max(.001,diffuseColor.b));
    float striation=.024*sin(x*5.+z*13.)+.020*sin(x*15.+2.*sin(z*14.));diffuseColor.rgb*=1.+mix(striation,.052*grain+.026*n,timber);
    vec2 t=vec2(abs(qWorld.x)-3.56,min(abs(qWorld.z+.15),abs(qWorld.z-2.3)));vec2 s=vec2(abs(t.x)-.55,min(abs(qWorld.z-.67),abs(qWorld.z-3.12)));
    float contact=exp(-dot(t*t,vec2(1.9,4.6)))+.40*exp(-dot(s*s,vec2(14.,16.)));diffuseColor.rgb*=1.-.28*min(1.,contact)*(1.-smoothstep(0.,.58,qWorld.y));
    vec2 l=vec2(abs(qWorld.x)-3.44,qWorld.z-4.65);diffuseColor.rgb+=vec3(.041,.014,.003)*exp(-dot(l,l)*.49)*(1.-smoothstep(0.,2.0,qWorld.y));`);
};
export function RiverSky(){return <mesh name="qinhuai:evening-sky" renderOrder={-100} frustumCulled={false} raycast={noPick}>
  <sphereGeometry args={[1,36,20]}/><RoomShader effect="riverSky" side={BackSide} depthWrite={false} depthTest={false}
    vertexShader={`varying vec3 skyDir;void main(){skyDir=position;vec4 p=projectionMatrix*vec4(mat3(viewMatrix)*position,1.);gl_Position=vec4(p.xy,0.,p.w);}`}
    fragmentShader={`varying vec3 skyDir;void main(){vec3 d=normalize(skyDir);float h=max(0.,d.y);vec3 c=mix(vec3(.62,.465,.37),vec3(.13,.19,.278),smoothstep(0.,.85,sqrt(h)));
    float bank=.012+.022*sin(d.x*9.+d.z*7.)+.009*sin(d.x*31.-d.z*17.);c=mix(vec3(.27,.29,.31),c,smoothstep(bank-.005,bank+.004,d.y));
    float cloud=sin(d.y*58.+d.x*3.+d.z*4.)+.38*sin(d.y*103.-7.*d.x);c=mix(c,vec3(.67,.53,.45),smoothstep(.64,1.37,cloud)*.24*smoothstep(.02,.13,h));
    float moon=length(d-normalize(vec3(-.22,.32,.94)));c+=vec3(.18,.143,.10)*exp(-moon*6.)+vec3(.65,.56,.39)*(1.-smoothstep(.027,.030,moon));
    gl_FragColor=vec4(c,1.);
    #include <colorspace_fragment>
    }`}/></mesh>;}
// Static ripple field in world metres. The broad wake and lantern tracks are
// intentionally painted reflections; no second camera, simulation or frame loop.
export function QinhuaiWater(){return <mesh name="qinhuai:water" position={[0,-.535,4]} rotation-x={-Math.PI/2} raycast={noPick}>
  <planeGeometry args={[140,85]}/><RoomShader effect="riverWater" vertexShader={`varying vec2 w;void main(){vec4 p=modelMatrix*vec4(position,1.);w=p.xz;gl_Position=projectionMatrix*viewMatrix*p;}`}
    fragmentShader={`varying vec2 w;
    float hash(vec2 p){return fract(sin(dot(p,vec2(31.7,127.1)))*43758.5453);}
    float noise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),mix(hash(i+vec2(0,1)),hash(i+1.),f.x),f.y);}
    void main(){float drift=noise(w*vec2(.40,.66)), chop=noise(w*vec2(2.,18.));float ripple=sin(w.y*32.+6.*drift+w.x*.6);
    vec3 col=mix(vec3(.063,.126,.141),vec3(.158,.199,.199),drift)+(.009*ripple+.034*chop);
    float strip=pow(.5+.5*cos((w.x+.74*drift)*1.41),9.);float lamp=strip*(.10+.90*smoothstep(.24,.94,chop+.21*ripple));
    col=mix(col,vec3(.68,.39,.17),lamp*.40);col+=.054*smoothstep(.85,.98,chop+.12*ripple);
    gl_FragColor=vec4(col,1.);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
    }`}/></mesh>;}
export function Songhouse({shadows}:{shadows:boolean}){
  const p=useMemo(makeSonghouse,[]),map=useBakedSurface(silkUrl),close=useBakedSurface(closeUrl),quarters=useBakedSurface(quartersUrl);
  const folioMap=useBakedSurface(folioUrl);
  useEffect(()=>()=>{for(const g of [p.roofs,p.fabric,p.prints,p.hulls,p.close,p.quarters,p.paintedLeaves])g.dispose();},[p]);
  return <><group name="qinhuai:songhouse" pointerEvents="none">
    <Batch name="qinhuai:joinery" parts={p.boxes} shade={joinery}/><Batch name="qinhuai:columns" parts={p.round} round casts={shadows}/>
    <mesh name="qinhuai:curtains" geometry={p.fabric} raycast={noPick}><meshStandardMaterial side={DoubleSide} vertexColors roughness={.89}/></mesh><Batch name="qinhuai:tea-and-finials" parts={p.facets} foliage/>
    <Batch name="qinhuai:lantern-paper" parts={p.glow} round lit/>
    <mesh name="qinhuai:tile-roofs" geometry={p.roofs} raycast={noPick}><meshStandardMaterial side={DoubleSide} vertexColors roughness={.84} onBeforeCompile={tileCourses}/></mesh>
    <mesh name="qinhuai:painted-boat" geometry={p.hulls} raycast={noPick}><meshStandardMaterial side={DoubleSide} vertexColors roughness={.79}/></mesh>
    {map&&<mesh name="qinhuai:folding-screen-and-signs" geometry={p.prints} raycast={noPick}><meshStandardMaterial key={map.uuid} map={map} roughness={.89}/></mesh>}
    <mesh name="qinhuai:lacquer-rope-and-stone" geometry={p.close} raycast={noPick}><meshStandardMaterial key={close?.uuid??'unpainted'} map={close} color={close?'#ffffff':'#927961'} side={DoubleSide} roughness={.73}/></mesh>
    <mesh name="qinhuai:quarters-silks" geometry={p.quarters} raycast={noPick}><meshStandardMaterial key={quarters?.uuid??'unpainted'} map={quarters} color={quarters?'#ffffff':'#ab907f'} side={DoubleSide} roughness={.88}/></mesh>
    {folioMap&&<mesh name="qinhuai:bedside-silk" geometry={p.paintedLeaves} raycast={noPick}><meshStandardMaterial map={folioMap} roughness={.92}/></mesh>}
    <QinhuaiWater/>
  </group>{folioMap&&<DressingAlbum map={folioMap}/>}</>;
}
