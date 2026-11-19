import { useEffect, useMemo } from 'react';
import { BufferGeometry, Color, DoubleSide, Float32BufferAttribute, LatheGeometry, Vector2, type Texture } from 'three';
import { ARCHIVE_FEET, BRIDGES, CHART_CASES, DIAL_FOOT, DOME_FEET, TERRACES } from './ObservatoryLayout';
import { Batch, type Part } from './SceneryBatch';
import { span } from './detailParts';
import { noPick, paintedSurface } from './sceneryPaint';

type V=Part['p'];
const tau=2*Math.PI, bronze='#b49a72',gold='#e7c696',stone='#9795a5',night='#455067',verdigris='#5f968c';

function architecture(){
  const blocks:Part[]=[],shafts:Part[]=[],glass:Part[]=[];
  const box=(p:V,s:V,color:string,ry=0)=>blocks.push({p,s,color,ry});
  const shaft=(p:V,s:V,color:string)=>shafts.push({p,s,color});
  const rod=(a:V,b:V,d:number,color:string)=>shafts.push(span(a,b,d,color));
  const beam=(a:V,b:V,d:number,color:string)=>blocks.push(span(a,b,d,color));

  // Four viaduct arms. Slight vertical separation at joints avoids two
  // coplanar tops; the visible differences are below foot-marker height.
  BRIDGES.forEach(({x,z,w,d},i)=>box([x,-.23-i*.004,z],[w,.45,d],night));
  function causeway(ew:boolean,start:number,end:number,width:number){
    const world=(u:number,y:number,v:number):V=>ew?[u,y,-20+v]:[v,y,u];
    const n=Math.ceil((end-start)/1.5),len=(end-start)/n;
    for(let i=0;i<n;i++){
      const u=start+(i+.5)*len;
      for(const side of [-1,1]){const tint=['#9d9a9d','#aaa4a2','#99989e','#a4a1a0'][(i+(side+1))%4];
        box(world(u,-.025,side*width/4),ew?[len-.018,.044,width/2-.018]:[width/2-.018,.044,len-.018],tint);}
      box(world(u,.001,0),ew?[len-.05,.004,.037]:[.037,.004,len-.05],bronze);
      if(i%2===0)for(const side of [-1,1]){
        const v=side*(width*.5-.13),a=world(u,.065,v);
        box(a,[.31,.13,.31],stone);box(world(u,.39,v),[.17,.58,.17],night);box(world(u,.69,v),[.24,.09,.24],bronze);
        glass.push({p:world(u,.79,v),s:[.13,.17,.13],color:i%4?'#a4dacb':'#ffe0a8'});
      }
    }
    for(const side of [-1,1]){const v=side*(width*.5-.13);
      for(const y of [.35,.59])beam(world(start,y,v),world(end,y,v),.048,bronze);
      beam(world(start,-.51,v),world(end,-.51,v),.23,stone);
      // Stepped corbels and diagonal under-bracing, visible from the side islands.
      for(let u=start+.4;u+2.8<end;u+=3.1){const top=world(u+1.45,-.50,v),base=world(u+1.45,-1.86,v);
        beam(world(u,-.53,v),base,.18,stone);beam(base,world(u+2.9,-.53,v),.18,stone);beam(base,top,.12,bronze);}
    }
  }
  causeway(false,-32.1,-21.8,3.8);causeway(false,-18.2,-6.65,3.8);
  causeway(true,-17.55,-1.9,3.6);causeway(true,1.9,17.55,3.6);
  box([0,-.016,-20],[3.8,.024,3.6],'#9a999f');
  for(let i=0;i<8;i++){const a=tau*i/8;box([.56*Math.sin(a),.002,-20+.56*Math.cos(a)],[.052,.005,.73],i%2?bronze:'#abd3c8',a);}

  // Rear half of the copper rotunda: its open half faces the causeway.
  for(const [i,{x,z,w,d}] of DOME_FEET.entries()){
    box([x,.12,z],[w,.24,d],stone);shaft([x,.35,z],[.54,.22,.54],bronze);
    shaft([x,2.09,z],[.43,3.31,.43],stone);shaft([x,3.81,z],[.62,.20,.62],bronze);
    const next=DOME_FEET[i+1];if(next){beam([x,3.94,z],[next.x,3.94,next.z],.27,night);beam([x,4.10,z],[next.x,4.10,next.z],.09,gold);}
  }
  const shellPoint=(az:number,el:number,r=5.72):V=>[r*Math.cos(az)*Math.cos(el),4.13+4.15*Math.sin(el),-39+r*Math.sin(az)*Math.cos(el)];
  for(let k=0;k<=12;k++){const az=Math.PI+k*Math.PI/12;for(let j=0;j<7;j++)rod(shellPoint(az,j*.213,5.76),shellPoint(az,(j+1)*.213,5.76),k%3===0?.092:.057,bronze);}
  for(const el of [.05,.71,1.38])for(let k=0;k<20;k++)rod(shellPoint(Math.PI+k*Math.PI/20,el,5.76),shellPoint(Math.PI+(k+1)*Math.PI/20,el,5.76),.065,gold);
  shaft([0,8.38,-39],[.48,.38,.48],bronze);glass.push({p:[0,8.82,-39],s:[.27,.61,.27],color:'#bae9d4'});

  // West: an open library of star charts. A vaulted canopy is high above the
  // portrait lane; low stone plinths alone reserve placement footprints.
  for(const {x,z,w,d} of ARCHIVE_FEET){box([x,.1,z],[w,.2,d],stone);shaft([x,1.62,z],[.32,2.88,.32],stone);box([x,3.1,z],[.57,.19,.57],bronze);}
  for(const z of [-23.2,-16.8]){box([-23.2,3.25,z],[5.94,.21,.43],night);box([-23.2,3.39,z],[6.02,.072,.49],gold);}
  for(const x of [-25.9,-23.2,-20.5])for(let i=0;i<12;i++){
    const pt=(i:number):V=>[x,3.21+1.74*Math.sin(i*Math.PI/12),-20+3.2*Math.cos(i*Math.PI/12)];beam(pt(i),pt(i+1),.14,bronze);
  }
  for(let j=-2;j<=2;j++){const angle=Math.PI/2+j*.43;box([-23.2,3.27+1.74*Math.sin(angle),-20+3.2*Math.cos(angle)],[5.63,.085,.09],gold);}
  for(const {x,z,w,d} of CHART_CASES){box([x,.11,z],[w,.22,d],stone);box([x,.72,z],[.26,1.06,.65],night);
    box([x,1.47,z],[.20,1.07,d],bronze);box([x,1.47,z],[.21,.98,d-.08],night);}

  // East: a meridian transit instrument in a fork mount, with a sighting tube,
  // ocular and engraved limb. One pedestal, with room to stage either side.
  const {x,z,w,d}=DIAL_FOOT;box([x,.11,z],[w,.22,d],stone);shaft([x,.48,z],[1.18,.56,1.18],night);shaft([x,.8,z],[1.32,.12,1.32],bronze);
  for(const side of [-1,1])rod([x,.84,z+side*.38],[x,2.0,z+side*.42],.16,bronze);
  const limb=(a:number):V=>[x+1.12*Math.cos(a),2.01+1.12*Math.sin(a),z];
  for(let k=0;k<40;k++){const a=tau*k/40;rod(limb(a),limb(a+tau/40),.079,gold);if(k%5===0)rod([x,2.01,z],limb(a),.049,bronze);}
  rod([x-.88,1.52,z],[x+1.23,2.70,z],.35,verdigris);rod([x+1.10,2.62,z],[x+1.33,2.75,z],.44,bronze);rod([x-.97,1.47,z],[x-.78,1.58,z],.16,gold);
  return {blocks,shafts,glass,shellPoint};
}

function roofs(at:ReturnType<typeof architecture>['shellPoint']){
  const p:number[]=[],c:number[]=[],color=new Color();
  const quad=(v:V[],s:string)=>{color.set(s);for(const i of [0,1,2,0,2,3]){p.push(...v[i]);c.push(color.r,color.g,color.b);}};
  for(let i=0;i<24;i++)for(let j=0;j<7;j++){
    if(i===17||i===18)continue; // slit open to the meridian
    const a=Math.PI+i*Math.PI/24,b=a+Math.PI/24,u=j*.22,v=u+.218;
    quad([at(a,u),at(b,u),at(b,v),at(a,v)],['#55877e','#65968a','#6ea098','#608d88'][(i+Math.floor(j/2))%4]);}
  for(let bay=0;bay<2;bay++)for(let j=0;j<12;j++){
    const pt=(side:number,k:number):V=>[-25.88+(bay+side)*2.68,3.22+1.72*Math.sin(k*Math.PI/12),-20+3.18*Math.cos(k*Math.PI/12)];
    if(j%4===2)continue;quad([pt(0,j),pt(1,j),pt(1,j+1),pt(0,j+1)],j%4?'#485f7b':'#647d98');}
  const g=new BufferGeometry();g.setAttribute('position',new Float32BufferAttribute(p,3));g.setAttribute('color',new Float32BufferAttribute(c,3));g.computeVertexNormals();return g;
}

export function Observatory({floor,shadows}:{floor:Texture;shadows:boolean}){
  const p=useMemo(architecture,[]),roof=useMemo(()=>roofs(p.shellPoint),[p]);
  const chart=useMemo(()=>paintedSurface(768,192,g=>{
    for(let k=0;k<3;k++){g.save();g.translate(128+k*256,96);g.fillStyle=['#233b49','#2f4258','#25484c'][k];g.fillRect(-128,-96,256,192);
      g.strokeStyle='#719494';g.lineWidth=1;for(let i=0;i<5;i++){g.beginPath();g.ellipse(0,-3,88,11+i*12,0,0,tau);g.stroke();g.beginPath();g.ellipse(0,-3,12+i*15,65,0,0,tau);g.stroke();}
      g.beginPath();for(let i=0;i<12;i++){const a=i*1.46+k,x=(i-5.5)*14,y=24*Math.sin(a)+16*Math.cos(i*.71+k);if(i===0)g.moveTo(x,y);else g.lineTo(x,y);}g.strokeStyle='#e7bc7a';g.stroke();
      for(let i=0;i<12;i++){g.fillStyle='#f4ddae';g.beginPath();g.arc((i-5.5)*14,24*Math.sin(i*1.46+k)+16*Math.cos(i*.71+k),i%3?2.4:3.8,0,tau);g.fill();}
      g.fillStyle='#e9d3a1';g.font='13px serif';g.textAlign='center';g.fillText(['I   ·   EQUINOX','II   ·   TRANSIT','III   ·   SOLSTICE'][k],0,82);g.restore();}
  }),[]);
  const plates=useMemo(()=>{const pos:number[]=[],uv:number[]=[];CHART_CASES.forEach(({x,z},k)=>{
    const vs=[[x+.109,1.02,z+.67],[x+.109,1.02,z-.67],[x+.109,1.92,z-.67],[x+.109,1.92,z+.67]],ts=[[k/3,0],[(k+1)/3,0],[(k+1)/3,1],[k/3,1]];for(const i of [0,1,2,0,2,3]){pos.push(...vs[i]);uv.push(...ts[i]);}});
    const g=new BufferGeometry();g.setAttribute('position',new Float32BufferAttribute(pos,3));g.setAttribute('uv',new Float32BufferAttribute(uv,2));g.computeVertexNormals();return g;},[]);
  const foundation=useMemo(()=>new LatheGeometry([[.16,-.61],[.66,-.40],[.82,-.19],[.87,-.12],[.97,-.105],[.97,-.079],[.91,-.074],[1,-.048],[1,-.003]].map(([r,y])=>new Vector2(r,y)),64),[]);
  useEffect(()=>()=>{roof.dispose();foundation.dispose();chart.dispose();plates.dispose();},[roof,foundation,chart,plates]);
  return <group name="court:observatory-district">
    {TERRACES.map(({id,x,z,r})=><group key={id} name={'court:terrace:'+id} position={[x,0,z]}>
      <mesh geometry={foundation} scale={[r,r,r]} raycast={noPick}><meshStandardMaterial color={id==='west'?'#6f7489':'#727c85'} flatShading/></mesh>
      <mesh rotation-x={-Math.PI/2} raycast={noPick} receiveShadow={shadows}><circleGeometry args={[r,96]}/><meshStandardMaterial map={floor} roughness={.9}/></mesh>
    </group>)}
    <Batch name="court:viaduct-and-plinths" parts={p.blocks} casts={shadows}/><Batch name="court:copper-and-stone" round parts={p.shafts} casts={shadows}/>
    <Batch name="court:guide-lamps" parts={p.glass} foliage lit/>
    <mesh geometry={roof} castShadow={shadows} raycast={noPick}><meshStandardMaterial vertexColors side={DoubleSide} roughness={.70}/></mesh>
    <mesh geometry={plates} raycast={noPick}><meshStandardMaterial map={chart} roughness={.85}/></mesh>
  </group>;
}
