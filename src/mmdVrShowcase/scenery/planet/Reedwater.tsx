import {RoomShader} from '../daylightMaterials';
import {useEffect,useMemo} from 'react';
import {useFrame} from '@react-three/fiber';
import {BufferGeometry,Color,DoubleSide,Float32BufferAttribute,Quaternion,SphereGeometry,Vector3,type Texture} from 'three';
import {PaintedParts,box,rod,ring,ball} from '../../play/modelParts';
import {noPick} from '../sceneryPaint';
import {moonShell} from './moonSurface';
import {groveSites,reedCentre,reedGauge as reedGaugeUp,reedRadius,reedRelief,reedSeaLevel} from './reedBiosphere';
import {surfaceGrain} from './surfaceGrain';
import {sunDirection,type Moon} from './windAtlas';
import {ReedSkimmers} from './ReedSkimmers';

const vert=`attribute float bed;attribute float canopy;varying vec3 pt,n,eye;varying float height,underTree;
  void main(){pt=position;n=normal;height=bed;underTree=canopy;vec4 w=modelMatrix*vec4(position,1.);eye=cameraPosition-w.xyz;gl_Position=projectionMatrix*viewMatrix*w;}`;
const groundFrag=`${surfaceGrain}
  varying vec3 pt,n,eye;varying float height,underTree;uniform float sea;uniform vec3 sun;
  void main(){vec3 N=normalize(n);float day=max(0.,dot(N,sun));vec3 g=grainAt(pt,N,2.2,length(eye));
    float h=height-sea;float patchTone=.5+.5*sin(3.3*pt.x+1.5*sin(pt.y*2.7)+1.6*pt.z)*cos(1.8*pt.z-.9*pt.y);
    vec3 ground=mix(vec3(.065,.126,.089),vec3(.51,.40,.213),smoothstep(-.46,.05,h));
    vec3 turf=mix(vec3(.035,.172,.068),vec3(.26,.41,.086),smoothstep(.08,.92,patchTone+g.r*.30));
    turf=mix(turf,vec3(.32,.45,.14),smoothstep(.41,.63,h)*.64);
    ground=mix(ground,turf,smoothstep(.035,.15,h+.045*g.b));
    ground*=max(.45,1.+g.r*.76+g.g*.54-g.b*.21);
    gl_FragColor=vec4(ground*(vec3(.27,.36,.33)+day*vec3(.98,.91,.76)*(1.-underTree*.62)),1.);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }`;
const waterFrag=`varying vec3 pt,n,eye;varying float height;uniform vec3 sun,plumb;uniform float sea,clock;
  void main(){float depth=sea-height;if(depth<.006)discard;
    vec3 N=normalize(pt),V=normalize(eye);vec3 a=vec3(.88,.41,-.27),b=vec3(.21,-.39,.9);
    vec2 k=vec2(dot(pt,a)*16.,dot(pt,b)*25.);vec2 weight=1.-smoothstep(vec2(.18),vec2(2.),fwidth(k));
    float w0=cos(k.x+1.3*sin(k.y*.13+clock)-clock*2.)*weight.x,w1=sin(k.y+clock*3.+.83*sin(k.x*.24))*weight.y;
    vec3 A=a-dot(a,N)*N,B=b-dot(b,N)*N;float fine=dot(pt,b)*74.+1.4*sin(dot(pt,a)*9.)-4.*clock;
    float cap=cos(fine)*(1.-smoothstep(.23,2.,fwidth(fine)));
    vec3 rip=pt-plumb;rip-=dot(rip,N)*N;float dist=length(rip),phase=dist*33.-clock*5.;
    float wake=smoothstep(.04,.19,dist)*(1.-smoothstep(.39,1.5,dist))*(1.-smoothstep(.2,2.,fwidth(phase)));
    vec3 NW=normalize(N+.084*A*w0+B*(.053*w1+.033*cap)+rip/max(.015,dist)*(.085*sin(phase)*wake));
    float fres=pow(1.-clamp(dot(V,NW),0.,1.),3.);float day=max(0.,dot(N,sun));
    vec3 shallow=vec3(.035,.36,.275),deep=vec3(.006,.105,.163);vec3 col=mix(shallow,deep,smoothstep(.01,.36,depth));
    col*=vec3(.34,.46,.53)+vec3(.68,.73,.64)*day;
    col=mix(col,vec3(.23,.55,.60),fres*.46);float glint=pow(max(0.,dot(NW,normalize(V+sun))),53.);
    col+=vec3(.70,.67,.42)*glint*day+vec3(.09,.14,.09)*max(0.,w0*w1)*exp(-4.*depth);
    float edge=1.-smoothstep(.012,.080+fwidth(depth),depth);col+=vec3(.27,.37,.21)*edge;
    float shoalWave=depth*60.+w0*.56-clock*2.;col+=vec3(.035,.084,.072)*pow(.5+.5*cos(shoalWave),6.)*exp(-6.*depth);
    col+=vec3(.09,.16,.13)*wake*pow(.5+.5*cos(phase),5.);
    gl_FragColor=vec4(col,.61+.33*smoothstep(.012,.34,depth)+.04*fres);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }`;

function shells(moon:Moon){
  const ground=moonShell(moon),water=new SphereGeometry(reedRadius+reedSeaLevel,ground.parameters.widthSegments,ground.parameters.heightSegments);
  const pos=ground.attributes.position,bed=new Float32Array(pos.count),cover=new Float32Array(pos.count),at=new Vector3();
  const shadows=groveSites.map(s=>s.base.clone().sub(reedCentre).addScaledVector(sunDirection,-.55).normalize().multiplyScalar(s.base.distanceTo(reedCentre)));
  for(let i=0;i<bed.length;i++){at.fromBufferAttribute(pos,i);bed[i]=at.length()-reedRadius;
    for(const t of shadows)cover[i]=Math.max(cover[i],Math.exp(-1.9*at.distanceToSquared(t)));}
  ground.setAttribute('canopy',new Float32BufferAttribute(cover,1));
  ground.setAttribute('bed',new Float32BufferAttribute(bed,1));water.setAttribute('bed',new Float32BufferAttribute(bed,1));
  // Suppress dry triangles before rasterization. Shore and bed share the
  // exact same tessellation, so the contour doesn't swim when the eye moves.
  const ix=water.index!,wet:number[]=[];for(let i=0;i<ix.count;i+=3){const a=ix.getX(i),b=ix.getX(i+1),c=ix.getX(i+2);
    if(Math.min(bed[a],bed[b],bed[c])<reedSeaLevel)wet.push(a,b,c);}
  water.setIndex(wet);return {ground,water};
}

type P=[number,number,number];const axis=new Vector3(0,1,0),tau=2*Math.PI;
// One opaque botanical batch: folded leaf fans, stalks with cylindrical seed
// heads, water lilies and dry grass tufts. All seeds are fixed in body space.
function flora(){
  const parts=new PaintedParts(),pos:number[]=[],rgb:number[]=[],idx:number[]=[],v=new Vector3(),n=new Vector3(),q=new Quaternion(),base=new Vector3(),c=new Color();
  let seed=1181;const rnd=()=>((seed=(Math.imul(1664525,seed)+1013904223)>>>0)/4294967296);
  const set=(up:Vector3,r:number)=>{q.setFromUnitVectors(axis,up);base.copy(up).multiplyScalar(r);};
  const add=(g:BufferGeometry,ink:string)=>parts.add(g.applyQuaternion(q).translate(base.x,base.y,base.z),ink);
  function vertex(x:number,y:number,z:number,color:string,shade:number){v.set(x,y,z).applyQuaternion(q).add(base);pos.push(v.x,v.y,v.z);c.set(color).multiplyScalar(shade);rgb.push(c.r,c.g,c.b);}
  function blade(root:P,angle:number,len:number,width:number,rise:number,droop:number,ink:string){const k=pos.length/3,ca=Math.cos(angle),sa=Math.sin(angle),steps=len>.36?4:2;
    for(let j=0;j<=steps;j++){const t=j/steps,w=width*(j===0?.06:j===steps?.015:Math.sin(Math.PI*t)**.75),y=root[1]+rise*t+droop*Math.sin(Math.PI*t);
      for(const side of [-1,0,1])vertex(root[0]+ca*t*len-sa*side*w,y+(side===0?w*.41:0),root[2]+sa*t*len+ca*side*w,ink, .60+.32*t+(side===0?.29:side*.11));
      if(j)for(let f=0;f<2;f++){const i=k+j*3+f;idx.push(i-3,i-2,i,i,i-2,i+1);}}
  }
  for(const {up,base:world,height:h} of groveSites){set(up,world.distanceTo(reedCentre));const bend=.16+(rnd()-.5)*.13;
    add(rod([0,-.05,0],[bend*.23,h*.49,.03],.126,.088,8),'#65563e');add(rod([bend*.23,h*.49,.03],[bend,h*.78,-.05],.091,.062,8),'#826c49');
    // A ring of tiered rosettes rather than identical balls on sticks.
    for(let j=0;j<6;j++){const a=j*2.4+rnd()*.38,r=j===0?.06:h*(.26+.14*rnd());const tip:P=[bend+r*Math.cos(a),h*(j===0?1:.70+.19*rnd()),r*Math.sin(a)];
      add(rod([bend*.48,h*.52,0],tip,.060,.029,7),'#7c6c46');
      for(let i=0;i<10;i++){const yaw=i*tau/10+rnd()*.23,len=.48+rnd()*.31,ca=Math.cos(yaw),sa=Math.sin(yaw),fall=.06-.28*rnd(),bow=.13+.12*rnd();
        const tint=['#449471','#80b373','#a5c76d','#367b61'][i%4];
        blade(tip,yaw,len,.036,fall,bow,'#96ac65');
        // Pairs of vanes fold away from the raised central midrib. Their
        // tapered tips leave readable sky gaps even from the opposite shore.
        for(let pair=1;pair<=4;pair++){const f=pair*.17,root:P=[tip[0]+ca*f*len,tip[1]+fall*f+bow*Math.sin(Math.PI*f),tip[2]+sa*f*len];
          for(const side of [-1,1])blade(root,yaw+side*(.96-.49*f),len*(.47-.18*f),.047+.023*(1-f),.02-.15*f,.057,tint);}}
      add(ball(...tip,.082,.105,.078,8),'#dbaa57');}
  }
  function sample(up:Vector3){const h=reedRelief(up.x,up.y,up.z),d=h-reedSeaLevel;if(up.y>.984)return;
    if(d<-.018&&d>-.43&&rnd()<.43){set(up,reedRadius+reedSeaLevel+.025);const sz=.10+.16*rnd(),a=rnd()*tau,k=pos.length/3;
      vertex(0,.015,0,'#809f63',.89);for(let i=0;i<=16;i++){const theta=a+i*(tau-.34)/16;vertex(sz*Math.cos(theta),.021*Math.cos(3*theta),sz*.8*Math.sin(theta),'#6eaa70',.86+.10*Math.cos(theta));if(i)idx.push(k,k+i+1,k+i);}
      if(rnd()<.55){for(let i=0;i<8;i++)blade([.02,.025,0],a+i*tau/8,.09,.038,.085,.015,'#ffbac4');add(ball(.02,.074,0,.039,.034,.039,8),'#eeb857');}
    }else if(d>-.095&&d<.125){set(up,reedRadius+h);for(let i=0;i<6;i++){const a=rnd()*tau,dx=.165*Math.cos(a),dz=.165*Math.sin(a),hh=.27+.35*rnd();
      blade([dx*.32,-.018,dz*.32],a,.14+.21*rnd(),.023,hh*.80,.10,'#a9b45c');if(i%2===0){const mid:P=[dx*.78,hh*.58,dz*.78],tip:P=[dx*1.63,hh,dz*1.63];
        add(rod([dx*.45,0,dz*.45],mid,.012,.009,5),'#8c9e53');add(rod(mid,tip,.009,.006,5),'#99a45c');add(rod(tip,[tip[0]+dx*.20,hh+.10,tip[2]+dz*.20],.022,.017,7),'#92603c');}}}
    else if(d>.13){set(up,reedRadius+h-.023);for(let i=0;i<8;i++)blade([0,0,0],rnd()*tau,.08+.15*rnd(),.017+.022*rnd(),.09+.17*rnd(),.035,['#6a9942','#a5be54','#529247'][i%3]);}
  }
  for(let i=0;i<450;i++){const y=1-2*(i+.5)/450,a=i*2.39996,rr=Math.sqrt(1-y*y);n.set(rr*Math.cos(a),y,rr*Math.sin(a));sample(n);}
  // Additional shoreline colonies, not a uniformly scattered green globe.
  for(let i=0;i<164;i++){n.set((rnd()-.5)*1.42,.52+rnd()*.52,-.13-rnd()*.85).normalize();sample(n);}
  const leaves=new BufferGeometry();leaves.setAttribute('position',new Float32BufferAttribute(pos,3));leaves.setAttribute('color',new Float32BufferAttribute(rgb,3));leaves.setIndex(idx);leaves.computeVertexNormals();parts.add(leaves);return parts.finish();
}

export function reedGaugeModel(){const p=new PaintedParts();
  for(const x of [-.27,.27])p.add(rod([x,-.22,0],[x,.95,0],.049,.035,9),'#af8957');
  p.add(box(0,.88,0,.66,.13,.12),'#38716b');p.add(box(-.14,.49,.053,.132,.93,.032),'#eae2b7');
  for(let i=0;i<9;i++)p.add(box(-.154,.10+i*.092,.075,i%3?.053:.094,.015,.012),'#2f5557');
  p.add(rod([.13,.06,.13],[.13,1.10,.13],.015,.015),'#bdaa6f');p.add(ball(.13,reedSeaLevel-reedRelief(reedGaugeUp.x,reedGaugeUp.y,reedGaugeUp.z)+.028,.13,.099,.052,.096),'#edac65');
  p.add(ring(.115,.022,18).translate(.13,1.15,.13),'#e6bf79');return p.finish();}

export function Reedwater({moon,grain}:{moon:Moon;grain:Texture|null}){
  const {ground,water}=useMemo(()=>shells(moon),[moon]),plants=useMemo(flora,[]);
  const u=useMemo(()=>({sun:{value:sunDirection},sea:{value:reedSeaLevel},clock:{value:0},grainMap:{value:grain},grainReady:{value:grain?1:0},
    plumb:{value:new Vector3(.13,0,.13).applyQuaternion(new Quaternion().setFromUnitVectors(axis,reedGaugeUp)).addScaledVector(reedGaugeUp,reedRadius+reedSeaLevel)}}),[grain]);
  useFrame((_,dt)=>{u.clock.value=(u.clock.value+Math.min(.08,dt))%(Math.PI*2);});
  useEffect(()=>()=>{ground.dispose();water.dispose();plants.dispose();},[ground,water,plants]);
  return <group position={moon.centre} userData={{playerCollision:false}}><mesh name="planet:moon-reed" geometry={ground} raycast={noPick}><RoomShader effect="reed" uniforms={u} vertexShader={vert} fragmentShader={groundFrag}/></mesh>
    <mesh name="reed:living-shore" geometry={plants} raycast={noPick}><meshStandardMaterial vertexColors roughness={.80} side={DoubleSide} fog={false}/></mesh>
    <ReedSkimmers/>
    <mesh name="reed:lagoon-water" geometry={water} renderOrder={1} raycast={noPick}><RoomShader effect="reedWater" uniforms={u} vertexShader={vert} fragmentShader={waterFrag} transparent depthWrite={false}/></mesh></group>;
}
