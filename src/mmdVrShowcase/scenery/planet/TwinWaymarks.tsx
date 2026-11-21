import {useEffect,useMemo} from 'react';
import {BufferGeometry, Color, DoubleSide, Float32BufferAttribute, Matrix4, Quaternion, Vector3} from 'three';
import {useLanguageStore} from '../../../languageStore';
import {noPick,paintedSurface} from '../sceneryPaint';
import {moonRadius} from './moonSurface';
import {twinSurveys} from './twinSurvey';

type Survey=typeof twinSurveys[number];
const north=new Vector3(0,1,0);

/** Thin enamel inlays, following the actual ground between the collar and
 * the opposing gravity well. No railings or posts to catch a landing. */
function routePrint({moon,pad}:Survey){
  const p:number[]=[],colors:number[]=[],c=new Color(),point=new Vector3(),side=new Vector3().crossVectors(north,pad.up).normalize();
  const route=(angle:number,lateral:number)=>{
    point.copy(north).multiplyScalar(Math.cos(angle)).addScaledVector(pad.up,Math.sin(angle)).addScaledVector(side,lateral/moon.radius).normalize();
    return point.multiplyScalar(moonRadius(moon,point.x,point.y,point.z)+.021).toArray();
  };
  const quad=(a:number[],b:number[],d:number[],e:number[],ink:string)=>{c.set(ink);for(const pt of [a,b,d,d,e,a]){p.push(...pt);colors.push(c.r,c.g,c.b);}};
  const tint=moon.id==='salt'?'#63357d':'#ffc88a';
  for(let i=0;i<12;i++){
    const a=.21+i*.096;
    for(const k of [-1,1])quad(route(a,k*.18),route(a+.019,k*.18),route(a+.045,k*.018),route(a+.023,k*.018),i%3?tint:'#7dcacf');
  }
  // A broken sextant limb and a pair of heel marks at the actual A trigger.
  const end=Math.PI/2;
  for(let i=0;i<60;i++){
    if(i%15<2)continue;
    const arc=(t:number,r:number)=>route(end+Math.cos(t)*r/moon.radius,Math.sin(t)*r);
    const a=i*Math.PI/30,b=(i+1)*Math.PI/30;
    quad(arc(a,.72),arc(b,.72),arc(b,.65),arc(a,.65),tint);
  }
  for(const k of [-1,1])quad(route(end-.038,k*.11),route(end-.038,k*.19),route(end+.029,k*.19),route(end+.035,k*.11),tint);
  const g=new BufferGeometry();g.setAttribute('position',new Float32BufferAttribute(p,3));g.setAttribute('color',new Float32BufferAttribute(colors,3));return g;
}

function JumpMark({survey}:{survey:Survey}){
  const {moon,pad}=survey,zh=useLanguageStore(s=>s.language==='zh'),route=useMemo(()=>routePrint(survey),[survey]);
  const mark=useMemo(()=>paintedSurface(512,176,c=>{
    c.fillStyle='#152b37';c.fillRect(0,0,512,176);c.strokeStyle=moon.color;c.lineWidth=4;c.strokeRect(6,6,500,164);
    c.textAlign='center';c.fillStyle='#fff3d9';c.font='600 52px system-ui,sans-serif';const salt=moon.id==='salt';
    c.fillText(zh?(salt?'跃向玄釉星':'跃向棱盐星'):(salt?'Leap to Obsidian':'Leap to Halite'),256,73,466);
    c.fillStyle=moon.color;c.font='600 36px system-ui,sans-serif';c.fillText(zh?'右 A   /   空格':'A   /   SPACE',256,131);
  }),[moon,zh]);
  const pose=useMemo(()=>{
    // Facing arrivals from the north pole. Bank the plaque like a low lectern
    // beside the mark so the gap itself is always clear.
    const face=north.clone().multiplyScalar(.72).addScaledVector(pad.up,.69).normalize(),x=new Vector3().crossVectors(pad.up,face).normalize(),y=new Vector3().crossVectors(face,x);
    return {q:new Quaternion().setFromRotationMatrix(new Matrix4().makeBasis(x,y,face)),p:pad.foot.clone().addScaledVector(x,.89).addScaledVector(pad.up,.23)};
  },[pad]);
  useEffect(()=>()=>route.dispose(),[route]);useEffect(()=>()=>mark.dispose(),[mark]);
  return <><mesh position={moon.centre} geometry={route} raycast={noPick}><meshBasicMaterial vertexColors toneMapped={false} side={DoubleSide}/></mesh>
    <group name={'gravity:'+moon.id+':pad'} position={pad.foot} quaternion={new Quaternion().setFromUnitVectors(north,pad.up)}/>
    <mesh position={pose.p} quaternion={pose.q} raycast={noPick}><boxGeometry args={[.88,.30,.045]}/><meshBasicMaterial map={mark} toneMapped={false}/></mesh></>;
}
export function TwinWaymarks(){return <group name="planet:twin-waymarks" pointerEvents="none" userData={{playerCollision:false}}>{twinSurveys.map(s=><JumpMark key={s.moon.id} survey={s}/>)}</group>;}
