import {useEffect,useMemo} from 'react';
import {CanvasTexture,DoubleSide,SRGBColorSpace} from 'three';
import {PaintedParts,ball,ring,rod,turn} from './modelParts';
import {TOYS} from './propCatalog';

// An embroidered round fan rather than a hinged folding fan. The thin silk
// is opaque, so the fan can hide a face without sorting against PMX hair.
function lotusSilk(){
  const canvas=document.createElement('canvas');canvas.width=canvas.height=512;
  const c=canvas.getContext('2d')!;
  c.fillStyle='#efdec2';c.fillRect(0,0,512,512);
  for(let i=0;i<512;i+=4){c.fillStyle='rgba(125,83,55,.06)';c.fillRect(i,0,1,512);c.fillStyle='rgba(255,255,229,.21)';c.fillRect(0,i,512,1);}
  c.strokeStyle='#8a7856';c.lineWidth=3;c.lineCap='round';
  c.beginPath();c.moveTo(239,462);c.bezierCurveTo(258,388,219,301,168,255);c.moveTo(242,434);c.bezierCurveTo(215,342,309,301,344,215);c.stroke();
  for(const [x,y,angle] of [[210,326,-.9],[272,343,1],[304,288,.7]]){
    c.save();c.translate(x,y);c.rotate(angle);c.fillStyle='#7d9078';c.beginPath();c.moveTo(0,0);c.bezierCurveTo(-29,-19,-19,-49,0,-63);c.bezierCurveTo(19,-38,17,-16,0,0);c.fill();c.restore();
  }
  for(const [x,y,s] of [[166,256,1],[345,217,.72]]){
    c.save();c.translate(x,y);c.scale(s,s);
    for(const [a,len,tint] of [[-.96,73,'#ba7274'],[.91,78,'#bf777b'],[-.45,79,'#d18d8d'],[.40,76,'#dc9e9a'],[0,88,'#e6b9ac']] as const){
      c.save();c.rotate(a);c.beginPath();c.moveTo(0,0);c.bezierCurveTo(-27,-24,-20,-53,0,-len);c.bezierCurveTo(14,-56,25,-24,0,0);c.fillStyle=tint;c.fill();c.lineWidth=1.8;c.strokeStyle='#985c66';c.stroke();c.restore();
    }c.restore();
  }
  c.beginPath();c.arc(256,256,239,0,Math.PI*2);c.strokeStyle='#ad8958';c.lineWidth=3;c.stroke();
  const map=new CanvasTexture(canvas);map.colorSpace=SRGBColorSpace;map.anisotropy=4;return map;
}

function makeFrame(){
  const parts=new PaintedParts();
  parts.add(turn([[0,-.066],[.006,-.065],[.008,-.059],[.0064,-.051],[.007,.026],[.009,.040],[.006,.055],[0,.056]],24),'#603334');
  parts.add(ring(.112,.0027,84).scale(.94,1,1).translate(0,.153,0),'#a16d3b');
  for(const y of [-.052,.028,.038])parts.add(ring(.0072,.0009,20).rotateX(Math.PI/2).translate(0,y,0),'#bd935d');
  parts.add(rod([0,-.064,0],[.006,-.083,0],.0015,.0013,7),'#843448');
  parts.add(ball(.006,-.084,0,.0037,.004,.0037,10),'#c8a06a');
  for(let i=0;i<12;i++){
    const a=i*Math.PI/6,x=Math.cos(a),z=Math.sin(a);
    parts.add(rod([.006+.0015*x,-.087,.0015*z],[.012+.0047*x,-.112+(i%3)*.0013,.0047*z],.0011,.0007,5),i%2?'#a04952':'#7d3649');
  }
  return parts.finish();
}

export function LotusFan(){
  const frame=useMemo(makeFrame,[]),map=useMemo(lotusSilk,[]),grip=TOYS.lotusFan.grip;
  useEffect(()=>()=>{frame.dispose();map.dispose();},[map,frame]);
  return <group name="play:piece:lotusFan" position={grip.point} rotation-x={-grip.pitch}>
    <mesh geometry={frame}><meshStandardMaterial vertexColors roughness={.43}/></mesh>
    <mesh position-y={.153} scale-x={.94}><circleGeometry args={[.112,84]}/><meshStandardMaterial map={map} side={DoubleSide} roughness={.83}/></mesh>
  </group>;
}
