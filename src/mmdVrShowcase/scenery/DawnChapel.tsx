import { useEffect, useMemo, useState } from 'react';
import { BufferGeometry, Color, DoubleSide, Float32BufferAttribute, OctahedronGeometry, RepeatWrapping, SRGBColorSpace, TextureLoader, type Texture } from 'three';
import { CHAPEL, CHAPEL_BAYS, CHAPEL_DAIS, CHAPEL_PEWS, CHAPEL_PIERS } from './ChapelLayout';
import { Batch, type Part } from './SceneryBatch';
import { noPick } from './sceneryPaint';
import { span } from './detailParts';
import roseURL from './chapel-rose.webp';
import lancetURL from './chapel-lancet.webp';
import stoneURL from './chapel-ashlar.webp';
import floorURL from './chapel-pavement.webp';

type V = Part['p'];
const half=CHAPEL.width/2, end=CHAPEL.length/2;
// A pointed transverse vault rises from each engaged pier. A shallow web
// swells between the diagonal ribs, giving the ceiling depth even without shadows.
function arch(side:number,t:number,z:number):V {
  const a=t*Math.PI*.415;
  return [side*(half-half*(1-Math.cos(a))/(1-Math.cos(Math.PI*.415))),
    CHAPEL.shoulder+(CHAPEL.crown-CHAPEL.shoulder)*Math.sin(a)/Math.sin(Math.PI*.415),z];
}

class Surface {
  private pos:number[]=[]; private uv:number[]=[]; private colors:number[]=[]; private c=new Color();
  tri(points:V[],uv:number[][],tint='#ffffff'){
    this.c.set(tint);
    for(let i=0;i<3;i++){this.pos.push(...points[i]);this.uv.push(...uv[i]);this.colors.push(this.c.r,this.c.g,this.c.b);}
  }
  quad(a:V,b:V,c:V,d:V,uv:number[][],color?:string){this.tri([a,b,c],[uv[0],uv[1],uv[2]],color);this.tri([a,c,d],[uv[0],uv[2],uv[3]],color);}
  finish(){const g=new BufferGeometry();g.setAttribute('position',new Float32BufferAttribute(this.pos,3));g.setAttribute('uv',new Float32BufferAttribute(this.uv,2));g.setAttribute('color',new Float32BufferAttribute(this.colors,3));g.computeVertexNormals();return g;}
}

function chapelSurfaces(){
  const shell=new Surface(),glass=new Surface();
  for(const side of [-1,1]){
    const Y=CHAPEL.shoulder;
    shell.quad([side*half,0,-end],[side*half,0,end],[side*half,Y,end],[side*half,Y,-end],[[0,0],[9,0],[9,Y/3],[0,Y/3]]);
    for(const z of CHAPEL_BAYS){
      // Single opaque leaded pane in a moulded recess. Crop the same cartoon to
      // a pointed crown; don't alpha-blend layered cards across the stereo view.
      const x=side*(half-.037),w=.86,sill=1.17,spring=3.59,top=4.61;
      const pt=(u:number,h:number):V=>[x,h,z+u];
      const uv=(u:number,h:number)=>[.5+u/(2*w),(h-sill)/(top-sill)];
      const edge:[number,number][]=[[-w,sill],[w,sill],[w,spring]];
      for(let j=1;j<=16;j++){const u=w*(1-j/8);edge.push([u,spring+(top-spring)*Math.sqrt(1-Math.abs(u/w))]);}
      for(let j=0;j<edge.length;j++){const a=edge[j],b=edge[(j+1)%edge.length];glass.tri([pt(0,spring),pt(...a),pt(...b)],[uv(0,spring),uv(...a),uv(...b)]);}
      for(let i=0;i<12;i++){
        const u=i/12,v=(i+1)/12;
        const web=(t:number,k:number)=>{const p=arch(side,t,z+k*1.5);p[1]+=.20*Math.sin(Math.PI*t)*Math.cos(Math.PI*k/2);return p;};
        for(let k=-1;k<1;k++) shell.quad(web(u,k),web(v,k),web(v,k+1),web(u,k+1),[[u*3,k*.75],[v*3,k*.75],[v*3,(k+1)*.75],[u*3,(k+1)*.75]],'#d2c8be');
      }
    }
    for(const z of [-end,end])for(let i=0;i<16;i++){
      const p=arch(side,i/16,z),q=arch(side,(i+1)/16,z);
      shell.quad([p[0],0,z],[q[0],0,z],q,p,[[p[0]/2,0],[q[0]/2,0],[q[0]/2,q[1]/3],[p[0]/2,p[1]/3]]);
    }
  }
  return {masonry:shell.finish(),lancets:glass.finish()};
}

const limestone='#d4c9b7',capital='#e5d9c1', shadowStone='#ac9e8c',wood='#785447',edgeWood='#91664e',gold='#bf975f';
function fittings(){
  const blocks:Part[]=[],rounds:Part[]=[],ribs:Part[]=[],lights:Part[]=[],flowers:Part[]=[];
  const box=(p:V,s:V,color:string,rx=0,ry=0,rz=0)=>blocks.push({p,s,color,rx,ry,rz});
  const round=(p:V,s:V,color:string)=>rounds.push({p,s,color});
  for(const {x,z,w,d} of CHAPEL_PIERS){
    const sign=Math.sign(x);
    box([x,.12,z],[w,.24,d],shadowStone);box([x,.30,z],[w-.03,.12,d-.03],capital);
    box([x,2.6,z],[w-.16,4.5,d-.18],limestone);
    for(const k of [-1,0,1])round([x-sign*(k===0?.19:.12),2.58,z+k*.154],[.184,4.47,.184],capital);
    for(const [y,t,h] of [[.41,.52,.12],[4.63,.53,.12],[4.78,.60,.17],[4.91,.65,.10]])box([x,y,z],[t,h,t],y===4.63?shadowStone:capital);
  }
  for(const sign of [-1,1]){
    for(const y of [.12,.83,4.81])box([sign*(half-.045),y,0],[.092,y===.12?.24:.085,18.03],y===.83?shadowStone:limestone);
    for(let i=0;i<=6;i++)for(let j=0;j<14;j++){
      const z=-9+3*i, a=arch(sign,j/14,z),b=arch(sign,(j+1)/14,z);a[0]*=.958;b[0]*=.958;a[1]-=.04;b[1]-=.04;
      ribs.push(span(a,b,.173,limestone));
    }
    for(const z of CHAPEL_BAYS){
      // Paired diagonals meet at a carved boss on the centre ridge.
      for(const k of [-1,1])for(let j=0;j<14;j++){
        const rib=(t:number)=>{const v=arch(sign,t,z+k*1.5*(1-t));v[0]*=.968;v[1]-=.084;return v;};
        ribs.push(span(rib(j/14),rib((j+1)/14),.106,capital));
      }
      if(sign===1)round([0,CHAPEL.crown-.10,z],[.285,.20,.285],gold);
      const x=sign*(half-.09);
      box([x,1.14,z],[.21,.15,1.98],capital);
      for(const k of [-1,1]){
        box([x,2.37,z+k*.9],[.12,2.45,.12],limestone);
        for(let j=0;j<12;j++){
          const v=(t:number):V=>[x,3.59+1.07*t,z+k*.90*(1-t*t)];
          ribs.push(span(v(j/12),v((j+1)/12),.132,capital));
        }
      }
      box([x,2.69,z],[.106,3.06,.062],shadowStone);
      for(const y of [2.10,3.28])box([x,y,z],[.064,.030,1.68],'#655e55');
    }
    // Flank the sanctuary with carved blind lancets: narrow shafts, stepped
    // archivolts and small hanging textiles picked out in old gold.
    const cx=sign*3.21,cz=-8.82;
    for(const k of [-1,1]){
      round([cx+k*.71,2.21,cz],[.125,2.18,.125],capital);round([cx+k*.71,3.28,cz],[.18,.13,.18],limestone);
      for(let j=0;j<10;j++){
        const v=(t:number):V=>[cx+k*.71*(1-t*t),3.33+1.29*t,cz];ribs.push(span(v(j/10),v((j+1)/10),.124,capital));
      }
    }
    box([cx,2.59,cz+.064],[.90,1.67,.046],'#667c7b');
    for(const k of [-1,1])box([cx+k*.393,2.59,cz+.092],[.025,1.67,.012],'#c6a97d');
    for(const y of [1.79,1.90,3.35])box([cx,y,cz+.092],[.90,.035,.013],'#c6a97d');
    ribs.push(span([cx-.55,3.47,cz+.12],[cx+.55,3.47,cz+.12],.055,gold));
    box([cx,2.60,cz+.095],[.022,.54,.012],'#e1c999');
    for(const k of [-1,1]){
      flowers.push({p:[cx+k*.07,2.81,cz+.11],s:[.055,.134,.020],rz:-k*.56,color:'#e9d8ad'});
      flowers.push({p:[cx+k*.069,2.54,cz+.109],s:[.035,.099,.014],rz:-k*.70,color:'#bfbb91'});
    }
    flowers.push({p:[cx,2.87,cz+.11],s:[.049,.146,.022],color:'#eee1ba'});
    // Stone dado panelling beneath the rose.
    box([sign*4.23,1.28,-8.89],[2.85,.12,.18],capital);
    for(const k of [-1,0,1])box([sign*4.25+k*.86,.67,-8.89],[.09,1.17,.12],limestone);
  }
  for(const {x,z,w} of CHAPEL_PEWS){
    box([x,.46,z],[w-.04,.095,.47],edgeWood);box([x,.74,z+.249],[w-.09,.48,.083],wood,.10);
    box([x,.995,z+.272],[w,.057,.106],edgeWood);box([x,.58,z+.27],[w-.17,.041,.088],edgeWood);
    for(const k of [-1,1]){
      const xx=x+k*(w/2-.072);
      box([xx,.10,z],[.14,.20,.65],wood);box([xx,.31,z],[.105,.42,.35],wood);box([xx,.59,z+.07],[.11,.21,.56],edgeWood);
      box([xx,.72,z+.20],[.12,.40,.20],wood);round([xx,.96,z+.21],[.16,.09,.16],edgeWood);
      box([x+k*.66,.68,z+.318],[.68,.044,.12],edgeWood,.10);
      if((x>0)===(k>0)){const xx=x+k*.68;box([xx,.76,z+.326],[.14,.185,.035],'#655659',.12,0,k*.06);
        box([xx,.844,z+.326],[.133,.012,.030],'#ddc9a2',.12,0,k*.06);}
    }
    box([x,.15,z-.299],[w-.31,.062,.14],'#866c64');
  }
  const dais=CHAPEL_DAIS;
  for(let i=0;i<3;i++){const d=dais.d-i*.25;box([0,.06+.12*i,-end+d/2],[dais.w-.35*i,.12,d],i===1?'#bfaf99':'#d6c7b0');}
  box([0,.98,-7.48],[2.76,1.23,.85],'#9c876e');box([0,1.64,-7.48],[3.03,.14,1.04],capital);
  box([0,1.717,-7.47],[3.04,.023,1.04],'#f2e9d8');box([0,1.28,-6.944],[1.16,.87,.027],'#819389');
  for(const sign of [-1,1]){
    box([sign*1.0,1.02,-7.038],[.60,.77,.086],'#b39b7d');
    for(const k of [-1,1])box([sign*1.0+k*.233,1.02,-6.984],[.047,.72,.025],capital);
    for(const y of [.68,1.36])box([sign*1.0,y,-6.984],[.50,.044,.025],capital);
  }
  for(let i=0;i<23;i++)box([(i-11)*.050,.831,-6.946],[.019,.067,.023],'#ceb786');
  for(const x of [-.49,.49])box([x,1.28,-6.925],[.032,.87,.013],'#dcc297');
  box([0,1.26,-6.919],[.042,.28,.015],'#e5cea2');box([0,1.31,-6.918],[.17,.037,.016],'#e5cea2');
  // Brass altar cross is below the window, with space for the character's outline.
  round([0,1.78,-7.78],[.27,.12,.27],gold);box([0,2.20,-7.78],[.065,.85,.06],gold);box([0,2.37,-7.78],[.39,.06,.062],gold);
  for(const sign of [-1,1]){
    for(let j=0;j<3;j++){
      const x=sign*(.66+.245*j),z=-7.52-.085*j,h=1.94+.08*j;
      round([x,1.75,z],[.14,.055,.14],gold);round([x,(h+1.75)/2,z],[.042,h-1.75,.042],gold);round([x,h,z],[.09,.046,.09],gold);
      round([x,h+.14,z],[.044,.27,.044],'#f8e6bd');lights.push({p:[x,h+.305,z],s:[.016,.042,.016],color:'#ffcb79'});
    }
    const x=sign*2.39,z=-7.56;
    box([x,.70,z],[.47,.67,.47],limestone);box([x,1.06,z],[.54,.07,.54],capital);round([x,1.29,z],[.25,.41,.25],'#648080');
    for(let i=0;i<9;i++){
      const a=i*2.4;const tip:V=[x+.22*Math.sin(a),1.65+(i%4)*.10,z+.20*Math.cos(a)];ribs.push(span([x,1.41,z],tip,.018,'#778362'));
      for(let k=0;k<5;k++){const b=k*Math.PI*2/5+i;flowers.push({p:[tip[0]+.039*Math.cos(b),tip[1]+.02,tip[2]+.039*Math.sin(b)],s:[.043,.066,.034],rx:.6*Math.cos(b),rz:.6*Math.sin(b),color:i%3?'#f8efd7':'#d7bcc2'});}
    }
    // Carved double doors and small brass pulls finish the view on turning around.
    box([sign*.70,1.61,8.91],[1.38,3.22,.13],wood);
    for(const x of [sign*.17,sign*1.23])box([x,1.57,8.816],[.096,3.03,.057],edgeWood);
    for(const y of [.23,1.08,2.82])box([sign*.70,y,8.813],[1.26,.10,.064],edgeWood);
    round([sign*.19,1.15,8.76],[.053,.18,.053],gold);
  }
  return {blocks,rounds,ribs,lights,flowers};
}

// Per-room loads, never fetch textures in the preparation page or share disposed maps on re-entry.
function useChapelMaps(){
  const [maps,setMaps]=useState<Partial<Record<'rose'|'glass'|'wall'|'floor',Texture>>>({});
  useEffect(()=>{let mounted=true;const loader=new TextureLoader();
    const load=(url:string,key:keyof typeof maps)=>loader.load(url,t=>{if(!mounted)return;t.colorSpace=SRGBColorSpace;t.anisotropy=4;
      if(key==='wall')t.wrapS=t.wrapT=RepeatWrapping;setMaps(prev=>({...prev,[key]:t}));});
    const textures=[load(roseURL,'rose'),load(lancetURL,'glass'),load(stoneURL,'wall'),load(floorURL,'floor')];
    return ()=>{mounted=false;for(const t of textures)t.dispose();};},[]);return maps;
}

export function DawnChapel({shadows}:{shadows:boolean}){
  const maps=useChapelMaps(),p=useMemo(fittings,[]),surface=useMemo(chapelSurfaces,[]),petal=useMemo(()=>new OctahedronGeometry(1),[]);
  useEffect(()=>()=>{surface.masonry.dispose();surface.lancets.dispose();petal.dispose();},[surface,petal]);
  return <group name="scenery:chapel" pointerEvents="none">
    <mesh geometry={surface.masonry} raycast={noPick} receiveShadow={shadows}><meshStandardMaterial key={maps.wall?'stone':'plain'} map={maps.wall??null} color={maps.wall?'white':'#d7ccbd'} vertexColors roughness={.96} side={DoubleSide}/></mesh>
    <mesh rotation-x={-Math.PI/2} receiveShadow={shadows} raycast={noPick}><planeGeometry args={[CHAPEL.width,CHAPEL.length]}/><meshStandardMaterial key={maps.floor?'inlay':'plain'} color={maps.floor?'white':'#d1c4b4'} map={maps.floor??null} roughness={.86}/></mesh>
    <Batch parts={p.blocks} name="chapel:joinery" casts={shadows}/><Batch parts={p.rounds} name="chapel:turnings" round casts={shadows}/>
    <Batch parts={p.ribs} name="chapel:ribs" round/><Batch parts={p.flowers} name="chapel:lilies" geometry={petal}/><Batch parts={p.lights} name="chapel:candlelight" geometry={petal} lit/>
    <mesh name="chapel:side-glass" geometry={surface.lancets} raycast={noPick}><meshBasicMaterial key={maps.glass?'ready':'loading'} map={maps.glass??null} color={maps.glass?'white':'#c4d9d9'} side={DoubleSide} toneMapped={false}/></mesh>
    <group position={[0,4.91,-8.93]}>
      <mesh raycast={noPick}><circleGeometry args={[1.74,80]}/><meshBasicMaterial key={maps.rose?'ready':'loading'} color={maps.rose?'white':'#bccad1'} map={maps.rose??null} toneMapped={false}/></mesh>
      {([ [1.71,.053,'#aa9577'],[1.81,.086,shadowStone],[1.94,.070,capital] ] as const).map(([r,t,color])=><mesh key={r} position-z={t} raycast={noPick}><torusGeometry args={[r,t,8,80]}/><meshStandardMaterial color={color}/></mesh>)}
    </group>
  </group>;
}
