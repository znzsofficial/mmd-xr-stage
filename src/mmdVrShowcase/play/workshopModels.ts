import { CatmullRomCurve3, Color, ExtrudeGeometry, Float32BufferAttribute, Shape, Vector3 } from 'three';
import {centerZ} from './siliconeProfile';
import { ball, box, coil, PaintedParts, ring, rod, turn } from './modelParts';

export function makeBlower(pool:boolean) {
  const p=new PaintedParts(), teal='#448e91', mint='#a4d2bd', coral='#d7896f', cream='#f1e5c4', brass='#cfa964';
  // Enamel pump housing, sloping grip and rubber heel. The screw-top bottle's
  // rib and moulded fill marks sit above the shell, rather than in the palm.
  p.add(ball(0,.016,-.069,.043,.044,.068),teal);
  p.add(turn([[0,-.113],[.019,-.113],[.022,-.106],[.019,-.091],[.017,-.064],[.021,-.033],[.019,-.011],[0,-.008]],20).rotateX(-.16).translate(0,.012,-.068),mint);
  p.add(rod([0,-.1,-.05],[0,-.093,-.051],.022), '#376667');
  p.add(rod([0,.005,-.049],[0,-.048,-.089],.009,.006),coral);
  const bz=-.045;
  p.add(turn([[0,.04],[.021,.04],[.028,.05],[.03,.061],[.03,.089],[.026,.098],[.017,.103],[.016,.108],[0,.108]]).translate(0,0,bz),'#d3e7da');
  p.add(turn([[.026,.05],[.029,.056],[.0306,.061],[.0306,.077],[.0298,.078]]).translate(0,0,bz),'#5ab8b3');
  for(let i=0;i<5;i++)p.add(box(.0306,.064+i*.006,bz,.0013,.0011,i%2?.008:.014),cream);
  p.add(rod([0,.104,bz],[0,.115,bz],.02,.02,20),coral);
  for(let i=0;i<12;i++){const a=i*Math.PI/6;p.add(rod([.02*Math.cos(a),.106,bz+.02*Math.sin(a)],[.02*Math.cos(a),.113,bz+.02*Math.sin(a)],.0012,.0012,5),cream);}
  // Fork and wet film comb around a genuinely open nozzle. Centre stays on
  // the shared ray; do not move the launch point forward to suit the model.
  for(const s of [-1,1])p.add(rod([s*.021,.019,-.111],[s*.039,.025,-.17],.007,.005),mint);
  p.add(ring(.043,.006,36).translate(0,.025,-.173),coral);
  p.add(ring(.032,.0025,32).translate(0,.025,-.175),cream);
  for(let i=0;i<16;i++){const a=i*Math.PI/8,x=Math.cos(a),y=Math.sin(a);
    p.add(rod([.032*x,.025+.032*y,-.174],[.041*x,.025+.041*y,-.173],.0018,.0024,5),brass);}
  if(pool){for(let i=-2;i<=2;i++)p.add(ball(0,0,0,.0055,.016,.005,12).rotateZ(-i*.25).translate(i*.006,.053-Math.abs(i)*.002,-.103),i%2?'#f3bd9a':coral);}
  return p.finish();
}

export function makePunch() {
  const p=new PaintedParts(), enamel='#485b78', steel='#bdc8c9', brass='#d7a55d', dark='#324252';
  p.add(turn([[0,-.103],[.016,-.103],[.02,-.099],[.018,-.081],[.016,-.06],[.018,-.039],[.024,-.017],[0,-.01]],24).rotateX(-.12).translate(0,.005,-.066),dark);
  // Stamped-metal saddle, guide rails and sprung ram leading to a hex die.
  p.add(ball(0,.02,-.063,.038,.039,.053),enamel);
  p.add(rod([0,.025,-.04],[0,.025,-.102],.034,.027,24),enamel);
  p.add(rod([0,.025,-.102],[0,.025,-.156],.012,.012,18),steel);
  p.add(coil(.017,.006,6,.0019).rotateX(Math.PI/2).translate(0,.025,-.131),brass);
  for(const side of [-1,1]){
    p.add(rod([side*.027,.025,-.085],[side*.027,.025,-.152],.0033,.0033,10),steel);
    p.add(rod([side*.027,.025,-.146],[side*.027,.025,-.155],.0058,.0058,10),brass);
  }
  p.add(rod([0,.025,-.153],[0,.025,-.167],.034,.037,6),brass);
  p.add(rod([0,.025,-.166],[0,.025,-.173],.034,.034,6),'#784657');
  p.add(ring(.03,.0016,6).translate(0,.025,-.174),'#d49184');
  const moon=new Shape();moon.moveTo(.004,.018);moon.bezierCurveTo(-.023,.015,-.022,-.018,.004,-.019);moon.bezierCurveTo(-.009,-.011,-.007,.005,.004,.018);
  p.add(new ExtrudeGeometry(moon,{depth:.0015,bevelEnabled:false,curveSegments:8}).rotateY(Math.PI).translate(0,.025,-.174),'#e4ae91');
  const star=new Shape();for(let i=0;i<8;i++){const a=i*Math.PI/4,r=i%2?.0025:.008;const x=r*Math.cos(a),y=r*Math.sin(a);if(i)star.lineTo(x,y);else star.moveTo(x,y);}star.closePath();
  p.add(new ExtrudeGeometry(star,{depth:.0015,bevelEnabled:false}).rotateY(Math.PI).translate(-.012,.029,-.174),'#e4ae91');
  p.add(rod([0,.02,-.024],[0,.02,.006],.012,.012),steel);
  p.add(ball(0,.02,.009,.028,.024,.011),brass);
  return p.finish();
}

export function makeSilicone() {
  // Millimetre profile including a recessed underside and a broad rolled lip.
  const sections=[[0,-40],[10,-40],[20,-42],[25,-44],[29,-45.6],[32,-45],[34,-42.8],[33.8,-40],[31,-37.8],[25,-36.8],[20,-32],[17.8,-23],[17,-9],[17.2,12],[18.3,38],[19,56],[18.6,73],[17.1,85],[16.8,89],[17.5,91],[19.7,93],[20.2,96],[19.4,102],[17.6,107],[13.7,112.2],[8.7,116.5],[4,118.6],[2.2,119],[1.35,118.4],[1.25,114],[0,113.8]];
  const spline=new CatmullRomCurve3(sections.map(([r,y])=>new Vector3(r/1000,y/1000,0)));
  const p=new PaintedParts(),g=turn(spline.getPoints(84).map(v=>[Math.max(0,v.x),v.y]),40);
  const pos=g.getAttribute('position'),colors=new Float32Array(pos.count*3),tint=new Color(),body=new Color('#c596a3'),tip=new Color('#b87e90'),bore=new Color('#734853');
  for(let i=0;i<pos.count;i++){
    const x=pos.getX(i),y=pos.getY(i),z=pos.getZ(i),angle=Math.atan2(x,z),a=Math.min(1,Math.max(0,(y-.072)/.027));
    // Oval section and a sloping moulded collar; gentle surface relief stays
    // under a millimetre and converges before the rounded outlet lip.
    const ridge=Math.max(0,1-Math.abs(y-.092)/.012),relief=.00065*Math.sin(3*angle+32*y)*Math.max(0,1-Math.abs(y-.042)/.054);
    pos.setXYZ(i,x*.94+relief*Math.sin(angle),y+.0035*ridge*Math.cos(angle),z+centerZ(y)+relief*Math.cos(angle));
    tint.copy(body).lerp(tip,a);if(y>.112&&Math.hypot(x,z)<.0017)tint.lerp(bore,.8);
    tint.toArray(colors,3*i);
  }
  g.computeVertexNormals(); // Smooth the duplicate seam vertices of the lathe.
  const normals=g.getAttribute('normal'),v=new Vector3(),w=new Vector3(),rows=85;
  for(let i=0;i<rows;i++){const j=40*rows+i;v.fromBufferAttribute(normals,i).add(w.fromBufferAttribute(normals,j)).normalize();normals.setXYZ(i,v.x,v.y,v.z);normals.setXYZ(j,v.x,v.y,v.z);}
  g.setAttribute('color',new Float32BufferAttribute(colors,3));p.add(g);
  // Two underside tread rings and a raised circumferential thumb grip; same
  // elastomer, a slightly darker moulding rather than hard metallic trim.
  for(const [r,y,w] of [[.03,-.0453,.0011],[.025,-.044,.0011],[.0328,-.0395,.0013]])p.add(ring(r,w,40).rotateX(Math.PI/2).translate(0,y,0),'#ae818e');
  return p.finish();
}

export function makeHilt() {
  const p=new PaintedParts(), alloy='#596a79',brass='#ce9e63',graphite='#24323e', leather='#58494b';
  p.add(turn([[0,-.112],[.018,-.112],[.025,-.108],[.027,-.102],[.024,-.091],[.021,-.083],[.021,.031],[.025,.038],[.026,.06],[.023,.069],[.024,.084],[0,.084]],32),alloy);
  p.add(turn([[.021,-.081],[.0225,-.077],[.023,-.07],[.023,.018],[.022,.026],[.021,.028]],24),leather);
  p.add(coil(.0224,.014,7,.0015).translate(0,-.025,0),graphite);
  for(const y of [-.094,-.084,.029,.035,.064])p.add(ring(y>.02?.025:.023,.0024).rotateX(Math.PI/2).translate(0,y,0),brass);
  // Recessed emitter well. The animated blade's root remains exactly y=.107.
  p.add(turn([[.023,.071],[.028,.078],[.028,.086],[.031,.09],[.032,.105],[.030,.11],[.023,.11],[.021,.107],[.021,.091]],32),brass);
  p.add(turn([[.022,.092],[.022,.106],[.018,.106],[.017,.10],[.012,.10],[.012,.105],[0,.105]],28),graphite);
  p.add(ring(.014,.0015).rotateX(Math.PI/2).translate(0,.106,0),'#86c6ba');
  for(let i=0;i<8;i++){const a=i*Math.PI/4;p.add(box(0,.097,.0322,.0035,.011,.0015).rotateY(a),graphite);}
  p.add(ball(0,.05,.024,.011,.012,.004),graphite);p.add(ball(0,.051,.027,.0065,.0075,.002),'#83dacc');
  return p.finish();
}
