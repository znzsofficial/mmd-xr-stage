import {useEffect,useMemo,useRef,type Ref} from 'react';
import {useFrame} from '@react-three/fiber';
import {BufferGeometry,Color,DoubleSide,Float32BufferAttribute,Quaternion,Vector3,type Mesh,type MeshBasicMaterial} from 'three';
import {useLanguageStore} from '../../../languageStore';
import {noPick,paintedSurface} from '../sceneryPaint';
import {moonRadius} from './moonSurface';
import {leapNames,leapRoutes,type LeapRoute} from './leapAtlas';

const north=new Vector3(0,1,0);

/** Thin enamel inlays, following the actual ground between the collar and
 * the opposing gravity well. No railings or posts to catch a landing. */
function routePrint({pad,target}:LeapRoute){
  const moon=pad.moon;
  const p:number[]=[],colors:number[]=[],c=new Color(),point=new Vector3(),side=new Vector3().crossVectors(north,pad.up).normalize();
  const route=(angle:number,lateral:number)=>{
    point.copy(north).multiplyScalar(Math.cos(angle)).addScaledVector(pad.up,Math.sin(angle)).addScaledVector(side,lateral/moon.radius).normalize();
    return point.multiplyScalar(moonRadius(moon,point.x,point.y,point.z)+.021).toArray();
  };
  const quad=(a:number[],b:number[],d:number[],e:number[],ink:string)=>{c.set(ink);for(const pt of [a,b,d,d,e,a]){p.push(...pt);colors.push(c.r,c.g,c.b);}};
  const tint=moon.id==='salt'?'#63357d':moon.id==='sulfur'?'#475461':target.moon.color;
  const end=Math.PI/2,length=end*moon.radius,first=('port' in moon)? .96 : .42,count=Math.max(2,Math.floor((length-first-.88)/.45));
  for(let i=0;i<count;i++){
    const a=(first+(length-.99-first)*i/count)/moon.radius;
    for(const k of [-1,1])quad(route(a,k*.18),route(a+.08/moon.radius,k*.18),route(a+.19/moon.radius,k*.018),route(a+.10/moon.radius,k*.018),i%3?tint:'#7dcacf');
  }
  // Mica has neither a wind collar nor a station. Join its two independent
  // trails at one small brass survey washer; leave their arrow tails clear.
  if(moon.id==='mica'&&target.id==='sulfur'){
    const disk=(a:number,r:number)=>route(Math.cos(a)*r/moon.radius,Math.sin(a)*r);
    for(let i=0;i<32;i++){const a=i*Math.PI/16,b=(i+1)*Math.PI/16;
      quad(disk(a,.27),disk(b,.27),disk(b,.19),disk(a,.19),'#d9ba82');}
  }
  // A broken sextant limb and a pair of heel marks at the actual A trigger.
  for(let i=0;i<60;i++){
    if(i%15<2)continue;
    const arc=(t:number,r:number)=>route(end+Math.cos(t)*r/moon.radius,Math.sin(t)*r);
    const a=i*Math.PI/30,b=(i+1)*Math.PI/30;
    quad(arc(a,.72),arc(b,.72),arc(b,.65),arc(a,.65),tint);
  }
  for(const k of [-1,1])quad(route(end-.18/moon.radius,k*.11),route(end-.18/moon.radius,k*.19),route(end+.14/moon.radius,k*.19),route(end+.16/moon.radius,k*.11),tint);
  const g=new BufferGeometry();g.setAttribute('position',new Float32BufferAttribute(p,3));g.setAttribute('color',new Float32BufferAttribute(colors,3));return g;
}

// Curved vitreous inset, beside rather than in the landing. A flat lectern
// here would float above the sharply receding limb of the 1.95 m moon.
function nameplate({pad}:LeapRoute){
  const {moon}=pad,p:number[]=[],uv:number[]=[],indices:number[]=[],w=16,h=6;
  const side=new Vector3().crossVectors(pad.up,north).normalize(),point=new Vector3();
  for(let j=0;j<=h;j++)for(let i=0;i<=w;i++){
    const u=i/w,v=j/h,a=(1.14+.84*(u-.5))/moon.radius;
    point.copy(pad.up).multiplyScalar(Math.cos(a)).addScaledVector(side,Math.sin(a)).addScaledVector(north,(.5-v)*.31/moon.radius).normalize();
    p.push(...point.multiplyScalar(moonRadius(moon,point.x,point.y,point.z)+.028).toArray());uv.push(u,v);
    if(i&&j){const n=p.length/3-1;indices.push(n-w-2,n-w-1,n,n,n-1,n-w-2);}
  }
  const g=new BufferGeometry();g.setAttribute('position',new Float32BufferAttribute(p,3));g.setAttribute('uv',new Float32BufferAttribute(uv,2));g.setIndex(indices);return g;
}

type Inset=Mesh<BufferGeometry,MeshBasicMaterial>;
function JumpMark({survey,label}:{survey:LeapRoute;label:Ref<Inset>}){
  const {pad,target}=survey,moon=pad.moon,zh=useLanguageStore(s=>s.language==='zh'),route=useMemo(()=>routePrint(survey),[survey]),plate=useMemo(()=>nameplate(survey),[survey]);
  const mark=useMemo(()=>paintedSurface(512,176,c=>{
    c.fillStyle='#152b37';c.fillRect(0,0,512,176);c.strokeStyle=target.moon.color;c.lineWidth=4;c.strokeRect(6,6,500,164);
    const next=leapRoutes.find(r=>r.pad.moon===moon&&r.target.id!==target.id);
    c.textAlign='center';c.fillStyle='#fff3d9';c.font='600 50px system-ui,sans-serif';
    c.fillText(zh?'跃向'+leapNames[target.id][0]:'Leap to '+leapNames[target.id][1],256,next?62:75,466);
    c.fillStyle=target.moon.color;c.font='600 33px system-ui,sans-serif';c.fillText(zh?'右 A   /   空格':'A   /   SPACE',256,next?109:132);
    if(next){c.fillStyle='#e0dfc9';c.font='600 27px system-ui,sans-serif';
      c.fillText(zh?'循刻痕向北 · 转往'+leapNames[next.target.id][0]:'Walk north for the '+leapNames[next.target.id][1]+' trail',256,151,464);}
  }),[moon,target,zh]);
  useEffect(()=>()=>{route.dispose();plate.dispose();},[route,plate]);useEffect(()=>()=>mark.dispose(),[mark]);
  return <><mesh position={moon.centre} geometry={route} raycast={noPick}><meshBasicMaterial vertexColors toneMapped={false} side={DoubleSide}/></mesh>
    <group name={'gravity:'+moon.id+':'+target.id+':pad'} position={pad.foot} quaternion={new Quaternion().setFromUnitVectors(north,pad.up)}/>
    <mesh ref={label} position={moon.centre} geometry={plate} raycast={noPick}><meshBasicMaterial map={mark} toneMapped={false} transparent depthWrite={false}/></mesh></>;
}
export function TwinWaymarks(){
  const labels=useRef<(Inset|null)[]>([]),eye=useMemo(()=>new Vector3(),[]);
  useFrame(({camera,gl})=>{(gl.xr.isPresenting?gl.xr.getCamera():camera).getWorldPosition(eye);
    // From across the gap the other ground faces us upside down. Leave the
    // landing arc in view; the enamel legend becomes legible on approach.
    leapRoutes.forEach(({pad},i)=>{const m=labels.current[i];if(!m)return;
      const alpha=Math.max(0,Math.min(1,(4.8-eye.distanceTo(pad.foot))/1.35));m.visible=alpha>0;m.material.opacity=alpha;});
  });
  return <group name="planet:twin-waymarks" pointerEvents="none" userData={{playerCollision:false}}>{leapRoutes.map((s,i)=><JumpMark key={s.pad.id+':'+s.target.id} survey={s} label={m=>{labels.current[i]=m;}}/>)}</group>;
}
