import {useEffect,useMemo} from 'react';
import {BufferGeometry,Float32BufferAttribute,RepeatWrapping} from 'three';
import {noPick,paintedSurface} from '../sceneryPaint';
import {canopyEaves,platform,quay,SHORE_SUN} from './shoreLayout';
import {stationClockPosition} from './waitingBayGeometry';

// A hand-lettered railway travel print, not an external photo or a UI panel.
function coastPrint(){return paintedSurface(420,600,c=>{
  c.fillStyle='#e6dfc4';c.fillRect(0,0,420,600);const sky=c.createLinearGradient(0,34,0,300);sky.addColorStop(0,'#689b9c');sky.addColorStop(1,'#e4d3a7');c.fillStyle=sky;c.fillRect(22,22,376,438);
  c.beginPath();c.arc(279,142,64,0,7);c.fillStyle='#efbf79';c.fill();
  const land=(points:number[][],color:string)=>{c.beginPath();for(const [i,[x,y]] of points.entries())if(i)c.lineTo(x,y);else c.moveTo(x,y);c.closePath();c.fillStyle=color;c.fill();};
  c.fillStyle='#739c93';c.fillRect(22,245,376,215);land([[22,216],[87,165],[144,187],[217,238],[262,245],[22,245]],'#829c8a');
  land([[398,257],[351,234],[329,239],[296,258],[252,264],[398,265]],'#9aab94');
  for(let i=0;i<73;i++){const x=32+(i*133%351),y=270+(i*37%177);c.fillStyle=i%4?'#94b0a1':'#d5cda4';c.fillRect(x,y,4+(i*13%29),1.4);}
  land([[22,356],[58,324],[85,312],[110,314],[142,347],[176,365],[159,375],[90,376],[78,391],[22,398]],'#526e66');
  land([[22,388],[78,381],[97,399],[163,412],[208,407],[247,433],[292,439],[311,460],[22,460]],'#345b55');
  c.fillStyle='#e0cfaa';c.fillRect(84,262,15,52);c.fillStyle='#ad6c4e';c.fillRect(84,275,15,13);c.fillRect(82,255,19,9);land([[79,255],[91,247],[104,255]],'#345b55');
  c.strokeStyle='#576d61';c.lineWidth=2.1;for(let i=0;i<4;i++){const x=150+i*31,y=128+Math.sin(i*2.5)*18;c.beginPath();c.moveTo(x-9,y-2);c.quadraticCurveTo(x-4,y-4,x,y+2);c.quadraticCurveTo(x+4,y-3,x+9,y-3);c.stroke();}
  c.fillStyle='#214f4c';c.textAlign='center';c.font='bold 45px serif';c.fillText('海　岬　行',210,521);c.font='16px system-ui';c.fillText('C A P E    C O A S T    R A I L W A Y',210,560);
});}
export function TicketOfficePrint(){const tex=useMemo(coastPrint,[]);useEffect(()=>()=>tex.dispose(),[tex]);return <group position={[2.783,1.62,1.28]} rotation-y={Math.PI/2}>
  <mesh><boxGeometry args={[1.02,1.45,.065]}/><meshStandardMaterial color="#665d4d"/></mesh><mesh position-z={.035} raycast={noPick}><planeGeometry args={[.95,1.37]}/><meshStandardMaterial map={tex} roughness={.79}/></mesh></group>;}

// Project the eaves along the room key. On shadowless profiles a narrow
// band of vertex colours lets the terrazzo pass from sun to blue skylight.
// The far quay stays in full sun and real shadow maps need no baked shadow.
export function platformGeometry(shadows:boolean){
  const p:number[]=[],uv:number[]=[],rgb:number[]=[],index:number[]=[];
  const roof=canopyEaves, cx=roof.x-roof.y*SHORE_SUN[0]/SHORE_SUN[1],cz=roof.z-roof.y*SHORE_SUN[2]/SHORE_SUN[1];
  const feather=.30;
  function cuts(min:number,max:number,centre:number,width:number,bake:boolean){
    const lo=centre-width/2,hi=centre+width/2;
    const edges=bake?[lo-feather,lo+feather,hi-feather,hi+feather]:[];
    return [min,...edges.filter(v=>min<v&&v<max),max];
  }
  for(const f of [platform,quay]){
    const bake=!shadows&&f===platform;
    const xs=cuts(f.x-f.w/2,f.x+f.w/2,cx,roof.w,bake),zs=cuts(f.z-f.d/2,f.z+f.d/2,cz,roof.d,bake);
    const first=p.length/3;
    for(const [i,x] of xs.entries())for(const [j,z] of zs.entries()){
      p.push(x,.001,z);uv.push(x/1.25,z/1.25);
      if(!shadows){
        const inset=Math.min(roof.w/2-Math.abs(x-cx),roof.d/2-Math.abs(z-cz));
        const shade=bake?Math.max(0,Math.min(1,.5+inset/(2*feather))):0;
        rgb.push(1-.42*shade,1-.31*shade,1-.17*shade);
      }
      if(i>0&&j>0){
        const k=first+i*zs.length+j, previousRow=k-zs.length;
        index.push(previousRow-1,previousRow,k-1,k-1,previousRow,k);
      }
    }
  }
  const g=new BufferGeometry();g.setAttribute('position',new Float32BufferAttribute(p,3));g.setAttribute('uv',new Float32BufferAttribute(uv,2));
  if(!shadows)g.setAttribute('color',new Float32BufferAttribute(rgb,3));
  g.setIndex(index);g.computeVertexNormals();return g;
}

/** A metre-scaled terrazzo print; the two joined slabs share a UV origin. */
export function PlatformFinish({shadows}:{shadows:boolean}){const map=useMemo(()=>{
  const map=paintedSurface(256,256,c=>{let seed=7641;const rand=()=>((seed=Math.imul(seed,1664525)+1013904223>>>0)/4294967296);c.fillStyle='#c5bfb1';c.fillRect(0,0,256,256);
    for(let i=0;i<11000;i++){const x=rand()*256,y=rand()*256;const light=rand()>.45;c.fillStyle=light?'rgba(239,230,205,.34)':'rgba(103,101,91,.20)';const w=.34+rand()*1.24;c.fillRect(x,y,w,w*(.5+rand()*.86));}
    for(let i=0;i<260;i++){c.fillStyle=i%3?'rgba(92,100,91,.24)':'rgba(248,236,198,.37)';const x=rand()*256,y=rand()*256,s=.6+rand()*1.15;c.beginPath();c.moveTo(x,y);c.lineTo(x+s*1.6,y+.28*s);c.lineTo(x+.53*s,y+1.2*s);c.fill();}
    c.fillStyle='rgba(84,78,61,.23)';c.fillRect(0,0,256,1.2);c.fillRect(0,0,1.2,256);c.fillStyle='rgba(252,245,211,.52)';c.fillRect(1.6,1.5,254,.75);
  });map.wrapS=map.wrapT=RepeatWrapping;return map;
},[]);const geometry=useMemo(()=>platformGeometry(shadows),[shadows]);
  useEffect(()=>()=>geometry.dispose(),[geometry]);useEffect(()=>()=>map.dispose(),[map]);
  return <mesh geometry={geometry} raycast={noPick} receiveShadow userData={{playerCollision:false}}>
    <meshStandardMaterial key={shadows?'real-shadow':'baked-eaves'} map={map} vertexColors={!shadows} roughness={.89} polygonOffset polygonOffsetFactor={-1} polygonOffsetUnits={-1}/>
  </mesh>;}

export function StationClock(){const plate=useMemo(()=>paintedSurface(320,320,c=>{
  c.fillStyle='#f2ead5';c.fillRect(0,0,320,320);c.translate(160,160);for(let i=0;i<60;i++){c.save();c.rotate(i*Math.PI/30);c.fillStyle=i%5?'#798176':'#364e48';c.fillRect(i%5?-1:-3,-142,i%5?2:6,i%5?6:15);c.restore();}
  c.fillStyle='#3d5046';c.textAlign='center';c.textBaseline='middle';c.font='bold 33px serif';for(const [s,x,y] of [['12',0,-99],['3',101,0],['6',0,102],['9',-101,0]] as const)c.fillText(s,x,y);
  for(const [a,w,l] of [[-.84,9,65],[1.69,5,95]]){c.save();c.rotate(a);c.fillRect(-w/2,-l,w,l+12);c.restore();}c.fillStyle='#a05b3c';c.beginPath();c.arc(0,0,7,0,7);c.fill();
}),[]);useEffect(()=>()=>plate.dispose(),[plate]);return <group position={stationClockPosition}>
  {[-1,1].map(s=><mesh key={s} position-z={.075*s} rotation-y={s<0?Math.PI:0} raycast={noPick}><circleGeometry args={[.258,48]}/><meshStandardMaterial map={plate} roughness={.67}/></mesh>)}</group>;}
