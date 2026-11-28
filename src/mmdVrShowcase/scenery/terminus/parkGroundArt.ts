import {BufferGeometry,CatmullRomCurve3,Color,CylinderGeometry,Float32BufferAttribute,Matrix4,Shape,ShapeGeometry,TubeGeometry,Vector3} from 'three';
import {RoundedBoxGeometry} from 'three/addons/geometries/RoundedBoxGeometry.js';
import {mergeGeometries,mergeVertices} from 'three/addons/utils/BufferGeometryUtils.js';
import {PaintedParts,box,rod,turn} from '../../play/modelParts';
import {fountainCourt,laneMouth,parkBeds,parkDeck,parkLights,parkSeats,parkShops,parkTrees,parkWalls,seatWidth} from './parkLayout';

const sage='#637a74',iron='#46585a', ivory='#e4ddc7';
export function parkStreetFurniture(){
  const hardware=new PaintedParts(),timber:BufferGeometry[]=[];
  for(const seat of parkSeats){
    const transform=new Matrix4().makeRotationY(seat.yaw).setPosition(seat.x,0,seat.z);
    const metal=(g:BufferGeometry,tint=iron)=>hardware.add(g.applyMatrix4(transform),tint);
    function board(y:number,z:number,h:number,d:number,angle:number,row:number){
      const g=mergeVertices(new RoundedBoxGeometry(seatWidth,h,d,1,.012)),v=g.getAttribute('position'),n=g.getAttribute('normal'),uv=g.getAttribute('uv');
      for(let i=0;i<v.count;i++){
        const x=v.getX(i),ny=n.getY(i),nz=n.getZ(i),cross=Math.abs(ny)>Math.abs(nz)?v.getZ(i)/d:v.getY(i)/h;
        if(Math.abs(n.getX(i))>.7){uv.setXY(i,(row*128+4+(v.getZ(i)/d+.5)*120)/1024,1-(8*64+4+(v.getY(i)/h+.5)*56)/1024);}
        else uv.setXY(i,.008+.984*(x/seatWidth+.5),1-(row*64+4+(cross+.5)*56)/1024);
      }
      g.rotateX(angle).translate(0,y,z).applyMatrix4(transform);timber.push(g);
    }
    // A gently dipped seat pan, raised front edge and 11-degree reclined
    // back; each strip has an eased edge and runs between both cast supports.
    for(let j=0;j<5;j++)board(.451-.017*Math.sin(Math.PI*j/4),-.254+j*.100,.048,.090,j===0?.10:0,j);
    for(let j=0;j<3;j++)board(.575+j*.116,.237+j*.024,.104,.048,.195,5+j);
    for(const x of [-.79,.79]){
      for(const z of [-.195,.19]){
        metal(box(x,.017,z,.16,.034,.145),sage);
        for(const dx of [-.052,.052])metal(new CylinderGeometry(.013,.013,.009,6).translate(x+dx,.039,z),'#9ca69e');
      }
      const bow=new CatmullRomCurve3([new Vector3(x,.035,-.20),new Vector3(x,.28,-.15),new Vector3(x,.403,-.17),new Vector3(x,.403,.165),new Vector3(x,.28,.15),new Vector3(x,.035,.19)]);
      metal(new TubeGeometry(bow,17,.026,8,false),sage);
      metal(box(x,.404,-.044,.058,.048,.50));metal(rod([x,.38,.166],[x,.844,.286],.023));
      const arm=new CatmullRomCurve3([new Vector3(x,.42,-.18),new Vector3(x,.594,-.21),new Vector3(x,.652,-.151),new Vector3(x,.657,.095),new Vector3(x,.605,.177),new Vector3(x,.43,.18)]);
      metal(new TubeGeometry(arm,18,.019,8,false),sage);
    }
    metal(rod([-.82,.337,.018],[.82,.337,.018],.018));
  }
  const oak=mergeGeometries(timber,false)!;for(const g of timber)g.dispose();
  for(const w of parkWalls){
    hardware.add(box(w.x,.18,w.z,w.w,.36,w.d),'#bab7a2');hardware.add(box(w.x,.39,w.z,w.w+.05,.061,w.d+.05),ivory);
    const alongX=w.w>w.d,dx=alongX?w.w:0,dz=alongX?0:w.d,n=Math.ceil((w.w+w.d)/1.8);
    for(let j=0;j<=n;j++){
      const f=j/n-.5,x=w.x+dx*f,z=w.z+dz*f;hardware.add(rod([x,.396,z],[x,w.top,z],.026),sage);
    }
    hardware.add(rod([w.x-dx/2,w.top-.02,w.z-dz/2],[w.x+dx/2,w.top-.02,w.z+dz/2],.029),sage);
  }
  // Slim pedestrian lamps: a flat warm lens sits inside a weather hood.
  for(const {x,z} of parkLights){
    hardware.add(turn([[.15,0],[.15,.062],[.11,.095],[.106,.32],[.068,.35],[.045,3.24]],16).translate(x,0,z),sage);
    hardware.add(rod([x,3.14,z],[x+.40,3.43,z],.034),sage);
    hardware.add(box(x+.40,3.435,z,.47,.087,.215),iron);hardware.add(box(x+.40,3.386,z,.41,.021,.16),'#eadab9');
  }
  // Flush radial tree grates: trunk flare and soil show through the long slots.
  for(const tree of parkTrees){
    const {x,z}=tree;
    hardware.add(new CylinderGeometry(.685,.685,.018,44).translate(x,.001,z),'#5e6250');
    for(const r of [.335,.49,.66])hardware.add(turn([[r-.013,.009],[r-.013,.016],[r+.013,.016],[r+.013,.009]],52).translate(x,0,z),'#71736a');
    for(let j=0;j<27;j++){
      const a=j*2*Math.PI/27,s=Math.sin(a),c=Math.cos(a);
      hardware.add(rod([x+.32*c,.012,z+.32*s],[x+.66*c,.012,z+.66*s],.009,.009,5),'#818078');
    }
  }
  return {oak,hardware:hardware.finish()};
}

type Point=[number,number,number];
export function parkPavement(){
  const positions:number[]=[],uv:number[]=[],colors:number[]=[],indices:number[]=[],ink=new Color();
  function quad(points:Point[],color:string){
    const i=positions.length/3;ink.set(color);
    for(const [x,y,z] of points){positions.push(x,y,z);uv.push(x/3.68,z/3.68);colors.push(ink.r,ink.g,ink.b);}
    indices.push(i,i+1,i+2,i,i+2,i+3);
  }
  function slab(x:number,z:number,w:number,d:number,y:number,color:string){
    quad([[x-w/2,y,z-d/2],[x-w/2,y,z+d/2],[x+w/2,y,z+d/2],[x+w/2,y,z-d/2]],color);
  }
  const {x,z,w,d}=parkDeck;
  // Cut the straight walks and their basalt bands into the forecourt itself.
  // A cross band runs through the junction; the lengthwise band stops at its edge.
  const inlays=[
    ...[34.52,34.68].map(z=>({x:9.65,z,w:26.8,d:.062,color:'#abb6ab'})),
    ...[19.76,19.95].map(x=>({x,z:22.5,w:.067,d:28.87,color:'#a9b6ad'})),
    {x:8.88,z:35.85,w:25.3,d:2.3,color:'#dbd9cc'},
    {x:21.5,z:22.5,w:3.3,d:29,color:'#d1d8d3'},
    {x,z,w,d,color:'#fffdf7'},
  ].map(r=>({left:r.x-r.w/2,right:r.x+r.w/2,near:r.z-r.d/2,far:r.z+r.d/2,color:r.color}));
  const edges=(values:number[])=>Array.from(new Set(values)).sort((a,b)=>a-b);
  const rows=edges(inlays.flatMap(r=>[r.near,r.far]));
  const columns=edges(inlays.flatMap(r=>[r.left,r.right]));
  for(let j=1;j<rows.length;j++){
    const near=rows[j-1],far=rows[j],bands=inlays.filter(r=>r.near<=near&&far<=r.far);
    for(let i=1;i<columns.length;i++){
      const left=columns[i-1],right=columns[i];
      const band=bands.find(r=>r.left<=left&&right<=r.right)!;
      quad([[left,0,near],[left,0,far],[right,0,far],[right,0,near]],band.color);
    }
  }
  slab(laneMouth.x,laneMouth.z,laneMouth.w,laneMouth.d,0,'#dbd9cc');
  // The stripes are paint on the new district's flush crossing, not another slab.
  for(let j=0;j<5;j++)slab(21.4,42.79+j*.61,2.28,.24,.004,'#e7e3cf');
  // Matte falloff against a recess. Same stone and world UVs as the adjacent
  // sidewalk; the softened edge is contact shade rather than a black strip.
  for(const s of parkShops){
    const c=Math.cos(s.yaw),sn=Math.sin(s.yaw),tint=s.yaw===Math.PI?'#dbd9cc':'#d1d8d3';
    const vertex=(along:number,out:number):Point=>[s.x+along*c+out*sn,.0035,s.z-along*sn+out*c];
    const count=colors.length;
    quad([vertex(-s.w/2,.14),vertex(-s.w/2,.82),vertex(s.w/2,.82),vertex(s.w/2,.14)],tint);
    for(const k of [0,3])for(let j=0;j<3;j++)colors[count+k*3+j]*=.73;
  }
  const f=fountainCourt;
  const at=(a:number,r:number,y:number):Point=>[f.x+r*Math.sin(a),y,f.z+r*Math.cos(a)];
  const segments=88;
  for(const [lo,hi,tint] of [[2.75,3.19,'#c1c7be'],[3.19,3.28,'#9ea9a5'],[3.28,4.60,'#e4e4cf'],[4.60,4.68,'#b3bdae'],[4.68,4.84,'#e1d6bc']] as const){
    for(let j=0;j<segments;j++){
      const a=j*Math.PI*2/segments,b=(j+1)*Math.PI*2/segments;
      quad([at(a,lo,.006),at(a,hi,.006),at(b,hi,.006),at(b,lo,.006)],j%11===0&&hi===4.60?'#bfc9be':tint);
    }
  }
  const floor=new BufferGeometry();floor.setAttribute('position',new Float32BufferAttribute(positions,3));floor.setAttribute('color',new Float32BufferAttribute(colors,3));floor.setAttribute('uv',new Float32BufferAttribute(uv,2));floor.setIndex(indices);floor.computeVertexNormals();floor.computeBoundingSphere();
  return floor;
}

// Keep the open glade around the water. A pair of long, flush lawns and four
// knee-high perennial borders sit along the two shop walks, never across them.
export function parkPlanting(){
  const garden=new PaintedParts(),turfPieces:BufferGeometry[]=[],florets:number[]=[],rgb:number[]=[],normals:number[]=[],ink=new Color();let seed=67609;
  const random=()=>((seed=(Math.imul(seed,1664525)+1013904223)>>>0)/4294967296);
  const blade=(a:Point,b:Point,c:Point,color:string)=>{
    florets.push(...a,...b,...c);ink.set(color);
    for(let i=0;i<3;i++){rgb.push(ink.r,ink.g,ink.b);normals.push(0,.985,.173);}
  };
  for(const [cx,cz,sx,sz,tilt] of [[14.25,22.0,4.9,4.2,.19],[12.7,30.2,4.1,2.95,-.20],[8.85,11.15,3.6,2.1,.24]]){
    const outline=new Shape();
    outline.moveTo(-.92,0);outline.bezierCurveTo(-.96,-.71,-.31,-1,.28,-.93);outline.bezierCurveTo(.94,-.84,1,-.13,.89,.38);
    outline.bezierCurveTo(.74,1,.13,1.05,-.34,.81);outline.bezierCurveTo(-.83,.60,-.96,.41,-.92,0);
    garden.add(new ShapeGeometry(outline,24).rotateX(-Math.PI/2).scale(sx*1.018,1,sz*1.018).rotateY(tilt).translate(cx,.007,cz),'#acae98');
    const grass=new ShapeGeometry(outline,24),v=grass.attributes.position,uv=grass.attributes.uv;
    // The last atlas cell carries the entire continuous lawn. Change the
    // handedness of the print between plots so the same clumps don't repeat.
    const flip=turfPieces.length%2?-1:1;
    for(let j=0;j<v.count;j++)uv.setXY(j,(2.5+v.getX(j)*.47*flip)/3,(.50+v.getY(j)*.46)/4);
    turfPieces.push(grass.rotateX(-Math.PI/2).scale(sx,1,sz).rotateY(tilt).translate(cx,.010,cz));
  }
  for(const b of parkBeds){
    const {x,z,w,d}=b;
    garden.add(new RoundedBoxGeometry(w,.235,d,2,.11).translate(x,.118,z),'#c8c5ad');
    garden.add(new RoundedBoxGeometry(w-.12,.12,d-.12,1,.055).translate(x,.218,z),'#696f53');
    for(let i=0;i<Math.floor(w*d*21);i++){
      const dx=(random()-.5)*(w-.35),dz=(random()-.5)*(d-.34),cx=x+dx,cz=z+dz;
      const a=random()*6.28,h=.15+random()*.19;
      for(let j=0;j<5;j++){
        const t=a+j*1.257,s=Math.sin(t),c=Math.cos(t);
        const spread=.073+random()*.092,width=.011+random()*.023;
        blade([cx-width*s,.275,cz+width*c],[cx+width*s,.275,cz-width*c],[cx+spread*c,.26+h*(.64+.45*random()),cz+spread*s],['#82966b','#90a777','#647f64','#789175','#75956d'][j]);
      }
      if((dx*.36+dz*.53+Math.sin(dx*1.6))>-.25&&i%3===0){
        const y=.29+h,c=i%5?'#d49a7c':'#ead9a0';
        for(let k=0;k<5;k++){
          const t=k*Math.PI*.4+a,ex=Math.cos(t),ez=Math.sin(t);
          blade([cx,y,cz],[cx+.05*ex-.024*ez,y+.019,cz+.05*ez+.024*ex],[cx+.05*ex+.024*ez,y+.025,cz+.05*ez-.024*ex],c);
        }
      }
    }
  }
  const leaves=new BufferGeometry();leaves.setAttribute('position',new Float32BufferAttribute(florets,3));leaves.setAttribute('normal',new Float32BufferAttribute(normals,3));leaves.setAttribute('color',new Float32BufferAttribute(rgb,3));leaves.computeBoundingSphere();
  const turf=mergeGeometries(turfPieces,false)!;for(const g of turfPieces)g.dispose();
  return {beds:garden.finish(),leaves,turf};
}

// The water plane can pass under this solid at high tide but cannot surface
// through the paving or read as sea between the buildings. Extend the railway
// along the park's outer retaining wall into the cutting under the street.
export function inlandEmbankment(){
  const land=new PaintedParts();
  const cityEdge=laneMouth.z+laneMouth.d/2,near=parkDeck.z-parkDeck.d/2;
  land.add(box(26.1,-.86,(near+cityEdge)/2,59.8,1.69,cityEdge-near),'#b4b6a6');
  land.add(box(9.7,-.87,8.02,27,.84,.17),'#9a9e8e');
  land.add(box(-6,-.72,29,3.96,.55,22),'#747970');
  for(let z=18.38;z<40;z+=.62)land.add(box(-6,-.405,z,2.48,.14,.21),'#6a5e4f');
  for(const x of [-6.71,-5.29]){
    land.add(box(x,-.235,29,.127,.13,22),'#8b7763');land.add(box(x,-.128,29,.085,.054,22),'#aaa79a');
  }
  land.add(box(-6,.84,39.4,5.9,2.6,3.4),'#999f91');land.add(box(-6,.68,37.68,3.45,2.10,.08),'#4c5855');
  land.add(box(-6,2.23,39.4,6.4,.18,3.6),'#d3cbb4');
  // The tracks disappear under a proper overbridge and a service street
  // instead of a black rectangle on an isolated box. A stepped retaining
  // wall, verge and stairs belong to the far side of the diagonal sightline.
  land.add(box(-6,1.99,37.59,4.43,.24,.29),'#7e8a80');land.add(box(-6,2.35,39.15,8.4,.14,3.73),'#9fa399');
  for(const x of [-8.16,-3.84]){
    land.add(box(x,.58,37.4,.36,2.47,.68),'#aaa994');land.add(box(x,.23,36.76,.47,1.56,.83),'#969c8c');
  }
  land.add(box(-15.26,-.38,35.68,14.0,1.90,22.1),'#909887');
  land.add(box(-12.66,.69,36.66,7.4,.24,18.7),'#a1a291');
  for(let j=0;j<5;j++){
    const h=.21*j+.22;land.add(box(-9.66,h/2-.02,26.4+j*.37,2.0,h,.39),'#a6a998');
  }
  for(let j=0;j<6;j++){
    const z=26.9+j*2.53;land.add(box(-8.34,.09,z,.32,1.37,2.50),j%2?'#939a88':'#9fa48e');land.add(box(-8.34,.82,z,.42,.094,2.52),'#c0bea7');
  }
  // The mouth debouches onto a side street with a shallow drain and pavement
  // on both sides. Far-side ground deliberately meets the delivery buildings.
  land.add(box(18.25,-.038,44.50,36, .055,4.18),'#808984');
  // The new pavement continues level through the crossing and over the old curb.
  land.add(box(8.50,.055,42.44,21.15,.13,.28),'#b5b8a5');
  land.add(box(30.0,-.031,35.5,4.60,.051,16),'#868e88');
  return land.finish();
}
