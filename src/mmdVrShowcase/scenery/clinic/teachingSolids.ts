import { BufferGeometry, CatmullRomCurve3, Color, ExtrudeGeometry, Float32BufferAttribute, Shape, TubeGeometry, Vector3 } from 'three';
import { EXHIBITS, FIXTURES } from './clinicLayout';
import type { V } from './clinicParts';

// Each section is an actual closed casting, not a camera-facing illustration.
// Author profiles in centimetres, viewed from +Z. Merge the small castings
// into one indexed, vertex-coloured surface; no scene nodes per vessel or jaw.
type XY=[number,number];
type Path=([number,number,number,number,number,number]|XY)[];
class Castings {
  vertices:number[]=[];normals:number[]=[];colors:number[]=[];indices:number[]=[];
  origin:V=[0,0,0];
  roll=0; pitch=0; yaw=0;
  append(g:BufferGeometry,col:string){
    if(this.roll)g.rotateZ(this.roll);
    if(this.pitch)g.rotateX(this.pitch);
    if(this.yaw)g.rotateY(this.yaw);
    const c=new Color(col),p=g.getAttribute('position'),n=g.getAttribute('normal'),index=g.getIndex(),start=this.vertices.length/3;
    for(let i=0;i<p.count;i++){
      this.vertices.push(this.origin[0]+p.getX(i)*.01,this.origin[1]+p.getY(i)*.01,this.origin[2]+p.getZ(i)*.01);
      this.normals.push(n.getX(i),n.getY(i),n.getZ(i));this.colors.push(c.r,c.g,c.b);
    }
    for(let i=0;i<(index?.count??p.count);i++)this.indices.push(start+(index?index.getX(i):i));
    g.dispose();
  }
  cast(start:XY,path:Path,z:number,depth:number,col:string,bevel=.40){
    const s=new Shape();s.moveTo(...start);
    for(const a of path){if(a.length===2)s.lineTo(...a);else s.bezierCurveTo(...a);}
    s.closePath();const g=new ExtrudeGeometry(s,{depth,steps:1,curveSegments:6,bevelThickness:bevel,bevelSize:bevel,bevelSegments:1});
    this.append(g.translate(0,0,z),col);
  }
  tubing(points:V[],radius:number,col:string,closed=false){
    const c=new CatmullRomCurve3(points.map(v=>new Vector3(...v)),closed);
    const segments=Math.max(8,points.length*(closed?2:3)),sides=7,g=new TubeGeometry(c,segments,radius,sides,closed);
    if(!closed){
      // The tube primitive is open-ended. Close both cut ends (especially
      // visible on the grip) using the existing rim, prior to batching.
      const ix=Array.from(g.getIndex()!.array),end=segments*(sides+1);
      for(let k=1;k<sides-1;k++)ix.push(0,k+1,k,end,end+k,end+k+1);
      g.setIndex(ix);
    }
    this.append(g,col);
  }
  finish(){
    const g=new BufferGeometry();g.setIndex(this.indices);
    g.setAttribute('position',new Float32BufferAttribute(this.vertices,3));g.setAttribute('normal',new Float32BufferAttribute(this.normals,3));
    g.setAttribute('color',new Float32BufferAttribute(this.colors,3));g.computeBoundingSphere();return g;
  }
}
const bone='#e3cf91',marrow='#c6aa72',tissue='#e2b19e',muscle='#b64e65',lining='#f4caac',bladder='#568eab',bowel='#af7e54';

function sagittal(m:Castings){
  const f=EXHIBITS[0];m.origin=[f.x,1.025,f.z-.08];
  // Truncated trunk: anterior at left, sacrum posterior. The raised, differently
  // coloured inserts follow the bladder, cervix/vagina and rectal canal to three outlets.
  m.cast([-18,49],[[0,47,9,48,20,49],[22,43,18,37,21,30],[24,20,29,11,23,6],[19,2,14,0,9,-1],[-4,-3,-10,1,-13,7],[-18,10,-23,16,-24,24],[-25,33,-20,39,-18,49]],0,6,tissue);
  m.cast([15,46],[[20,50,23,48,21,42],[20,34,18,28,13,22],[11,19,9,17,7,16],[11,23,13,30,13,36],[13,41,12,44,15,46]],6,2.1,bone);
  for(let i=0;i<4;i++)m.tubing([[14.5-i*.56,42-i*4.1,8.56],[16.7-i*.64,41.2-i*4.1,8.55],[18.5-i*.84,41.3-i*4.1,8.55]],.30,marrow);
  m.cast([-18,19],[[-15,20,-13,18,-14,14],[-15,10,-16,9,-19,11],[-22,13,-21,18,-18,19]],6,2.1,bone);
  m.cast([-18.8,17.4],[[-17,18.7,-15.5,17.5,-15.8,15.7],[-16,13.8,-16.7,12,-18,12.8],[-19.1,13.7,-19.7,16.5,-18.8,17.4]],8.51,.12,marrow,.10);
  m.cast([8,42],[[14,41,14,35,12,31],[10,27,7,24,7,21],[7,17,12,15,11,11],[11,7,7,5,6,0],[5,-1,3,-1,3,0],[3,6,7,9,6,12],[5,16,1,17,1,21],[1,27,9,31,8,35],[8,38,4,38,4,41],[4,42,6,43,8,42]],6.1,2.65,bowel);
  m.tubing([[7,41,9],[10,37,9],[9,32,9],[5,25,9],[4,21,9],[8,14,9],[8,11,9],[4.4,1,9]],.45,'#e3b98f');
  m.cast([-4,19],[[0,22,2,22,1,18],[0,13,-4,7,-4,1],[-6,-1,-8,0,-8,2],[-8,8,-4,15,-4,19]],6.3,2.7,'#ad7187');
  m.cast([-16,30],[[-17,35,-12,37,-8,36],[-1,35,4,30,3,25],[3,23,1,20,0,18],[-2,16,-5,19,-5,21],[-5,24,-7,25,-10,26],[-14,26,-16,27,-16,30]],6.4,3.8,muscle);
  m.tubing([[-13,33,10.4],[-7,32,10.4],[-2,29,10.4],[.1,25.2,10.4],[-2.2,20,10.4]],.55,lining);
  m.cast([-15,24],[[-12,26,-7,25,-6,22],[-5,19,-7,16,-10,14],[-12,13,-10,7,-10,3],[-11,2,-12,2,-12,3],[-13,8,-12,12,-14,14],[-18,17,-19,21,-15,24]],6.25,2.85,bladder);
  m.tubing([[-15.8,20,9.25],[-14.4,18.4,9.25],[-11.4,18.3,9.25],[-8.6,20.5,9.25]],.5,'#b4d9df');
}

function adnexa(m:Castings){
  const f=EXHIBITS[1];m.origin=[f.x,1.038,f.z-.02];
  // Anterior section: free fimbriae sweep towards, but do not fuse with, the ovary.
  m.cast([-3,3],[[-4,6,-3,12,-5,16],[-7,20,-15,26,-14,32],[-13,38,-7,39,0,39],[7,39,13,38,14,32],[15,26,7,20,5,16],[3,12,4,6,3,3],[2,1,-2,1,-3,3]],-2.5,5.8,muscle,.75);
  m.cast([-10.9,32.3],[[-5,34,5,34,10.9,32.3],[7,30,3,26,1.3,21],[.7,18,.8,11,.8,6],[-.8,6],[-.9,11,-.7,18,-1.3,21],[-3,26,-7,30,-10.9,32.3]],4.07,.31,lining,.22);
  for(const k of [-1,1]){
    m.tubing([[k*10.3,35,4.17],[k*6,35.9,4.17],[k*2.9,36.2,4.17]],.30,'#ca7c88');
    m.tubing([[k*11.6,29.6,4.17],[k*7.4,25.4,4.17],[k*4.5,21.1,4.17]],.32,'#ca7c88');
    m.tubing([[k*11,32,0],[k*16,34,0],[k*21,37,0],[k*26,36,0],[k*27.4,33,0],[k*26.3,30.3,0]],1.05,'#cf7d89');
    for(let j=0;j<5;j++)m.tubing([[k*(26.15+.19*j),30.8,.15],[k*(25+.70*j),29.5,.4],[k*(23.4+1.13*j),28.2-.55*Math.sin(j),.9]],.32,'#c4677c');
    m.tubing([[k*10.8,26,-1],[k*14.2,24.6,-1],[k*18,24.7,-1]],.73,'#bc9279');
    m.cast([k*17.6,24],[[k*17.3,27.7,k*20.3,28.1,k*23.1,27.5],[k*27,26.5,k*26.7,23.2,k*23,21.6],[k*19.3,20,k*17.7,21.3,k*17.6,24]],-1.9,3.8,'#dfa36c',.62);
    for(const [u,y] of [[20,24],[21.7,25.7],[23.7,24.4]])m.tubing([[k*u,y,2.22],[k*(u+.34),y+.24,2.24],[k*(u+.63),y+.1,2.22]],.38,'#f7d99d');
  }
}

function gestation(m:Castings){
  const f=EXHIBITS[2];m.origin=[f.x,1.015,f.z-.04];
  // Cutaway shell, fluid cavity, placenta on the wall, curled teaching fetus
  // with the head below the trunk. The cord runs from its abdomen to the disc.
  m.cast([-4,0],[[-5,7,-16,9,-18,22],[-22,40,-12,51,0,51],[16,51,23,39,19,24],[18,13,9,7,6,1],[4,-1,-2,-1,-4,0]],-4,6,'#bc6975',.6);
  m.cast([-1,5],[[-9,10,-16.5,16,-16.5,28],[-17,40,-10,47.4,0,47.5],[12,47.8,18.1,39,17,27],[16,17,12,12,5,6],[2,4,-.5,4,-1,5]],2.1,.8,'#abc9c6');
  m.cast([9,44],[[12,45,16,40,16.4,36],[17,33,17.7,29,16,28],[13.7,28,12.4,33,12,35],[10.7,39,7.2,40.7,9,44]],3.1,1.05,'#a95467');
  m.cast([-3.5,18],[[-7,18,-11,21,-11,25],[-12,30,-9,36,-6,39],[-2,43,3,42.5,5,39.6],[7,37,5,33,2.2,31.5],[.5,30,-1,29,-.4,27],[1,25,3,25,3,22],[2,19,-1,17.8,-3.5,18]],3.4,3.2,'#d99b7b',1.05);
  m.cast([-8,22],[[-13,21.5,-13.6,16.4,-11.3,13.2],[-9.4,9.3,-4.3,9,-1.2,11],[-.4,12,.3,13.5,.2,14.5],[1.7,14.7,1.8,15.8,.6,16.5],[.3,18.6,-.2,20.2,-2,21],[-3.7,22.8,-6,22.9,-8,22]],4,3.7,'#edbc9b',.95);
  m.tubing([[-3.7,17.8,8.76],[-2.8,17.5,8.79],[-2.1,17.8,8.77]],.22,'#9f725d');
  m.tubing([[-7.8,18.6,8.76],[-8.6,18.7,8.76],[-8.7,17.5,8.76],[-8.0,16.7,8.76]],.43,'#d69c7e');
  m.tubing([[-7.8,25.8,7.4],[-5,24.9,7.9],[-1.7,22.5,8.1],[.9,19.6,8.05],[1.2,17.3,7.7]],1.05,'#eab490');
  m.tubing([[.5,38.2,6.8],[4.4,36.3,7.1],[6.9,32.6,7],[5.9,31,7.2],[3.3,32.2,7.6],[1.4,34.2,7.4]],1.52,'#edba92');
  m.tubing([[.25,27,6.7],[3.7,26.3,6.4],[7.3,24.3,5.3],[9.8,26.3,5.5],[9.3,30.5,5.4],[10,34.2,5],[13.7,36.4,4.8]],.75,'#a67a88');
}
export function teachingModelGeometry(){const m=new Castings();sagittal(m);adnexa(m);gestation(m);return m.finish();}

export function instrumentGeometry(){
  const m=new Castings(),c=FIXTURES.steelCart,steel='#acbbbc',highlight='#d3dcda',dark='#66797d';
  m.origin=[c.x,.855,c.z];
  const loop=(cx:number,y:number,cz:number,rx:number,rz:number,r:number,col=steel)=>{
    const path:V[]=Array.from({length:12},(_,i)=>{const t=2*Math.PI*i/12;return [cx+rx*Math.cos(t),y,cz+rz*Math.sin(t)];});m.tubing(path,r,col,true);
  };
  // A paired obstetric forceps has two broad fenestrated curved blades, a
  // central lock and two solid grips. All objects are a stationary display.
  for(const k of [-1,1]){
    const x=-25;
    const blade:V[]=[[x+k*.9,.55,2],[x+k*3.3,1.8,-2],[x+k*4.8,3.3,-9],[x+k*4.9,4.1,-14],[x+k*3.5,4.6,-16.4],[x+k*2.2,4.25,-13.7],[x+k*2.1,2.7,-8],[x+k*.9,.55,2]];
    m.tubing(blade.slice(0,-1),.64,highlight,true);
    m.tubing([[x+k*.9,.55,2],[x-k*.3,.75,4.3],[x-k*2.2,.85,8],[x-k*2.9,.95,13.8]],.73,steel);
    m.tubing([[x-k*2.2,.85,8.3],[x-k*2.65,1,10.4],[x-k*3.1,.96,15]],1.1,dark);
  }
  // Duckbill speculum, cast as opposed hollow curved leaves, with a hinge and thumb rest.
  m.origin=[c.x-.066,.891,c.z];m.roll=.90;m.pitch=-.22;m.yaw=.27;
  for(const upper of [false,true]){
    const g=new BufferGeometry(),pos:number[]=[],idx:number[]=[],edges:[V[],V[]]=[[],[]];
    for(let j=0;j<=8;j++)for(let i=0;i<=8;i++){
      const v=j/8,t=i/4-1,z=4-v*14.6+.62*t*t*v,span=2.05*(.75+.25*Math.sin(Math.PI*v))*(1-.38*Math.pow(v,8));
      const point:V=[t*span,(upper?2.2+3.45*v:.35-.12*v)+(upper?1:-1)*(.87*(1-t*t)),z];pos.push(...point);
      if(i===0||i===8)edges[i===0?0:1].push(point);
      if(j&&i){const k=j*9+i;idx.push(k-10,k-1,k,k-10,k,k-9);}
    }
    g.setAttribute('position',new Float32BufferAttribute(pos,3));g.setIndex(idx);g.computeVertexNormals();m.append(g,highlight);
    for(const edge of edges)m.tubing(edge,.21,steel);
  }
  m.tubing([[0,1.1,3.8],[0,-2,5.4],[0,-5.7,6.8],[0,-7.8,7.6]],.94,steel);
  m.tubing([[0,2.3,3.4],[.2,2.9,5],[.1,3.6,7.7]],.76,steel);
  m.tubing([[-2.1,1.6,4],[0,1.6,4],[2.1,1.6,4]],.73,dark);
  m.roll=m.pitch=m.yaw=0;m.origin=[c.x,.855,c.z];
  // Long shanks with oval distal jaws versus short tapered scissor blades.
  for(const [x,scissors] of [[10,false],[28,true]] as const){
    for(const k of [-1,1]){
      loop(x+k*1.79,.48,10.2,1.43,2.55,.42,highlight);
      m.tubing([[x+k*1.7,.46,7.75],[x+k*1,.48,4],[x-k*.15,.6,scissors?1:-.7],[x-k*(scissors?.45:.85),.50,scissors?-.8:-9.4]],scissors?.52:.39,steel);
      if(scissors){
        // Flattened tapered blade with a bright bevel, a closed heel and continuous tip.
        const g=new BufferGeometry(),dy=k*.12;
        g.setAttribute('position',new Float32BufferAttribute([[x+k*.48,.52+dy,1.4],[x-k*1.0,.55+dy,-.1],[x-k*2.65,.51+dy,-8.8],[x-k*.87,.84+dy,-.73],[x-k*2.20,.62+dy,-7.3]].flat(),3));
        g.setIndex([0,1,3,0,3,4,0,4,2,4,3,1,1,2,4]);g.computeVertexNormals();m.append(g,highlight);
      }
      else loop(x-k*.86,.58,-11.3,.69,2.5,.37,highlight);
    }
    m.tubing([[x,.42,scissors?1:-.7],[x,.7,scissors?1:-.7],[x,.99,scissors?1:-.7]],.62,dark);
  }
  return m.finish();
}
