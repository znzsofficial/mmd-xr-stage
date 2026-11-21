import {BufferGeometry,Float32BufferAttribute} from 'three';
import {box,PaintedParts,ring,rod,turn} from '../../play/modelParts';

type P=[number,number,number];
function facet(p:PaintedParts,points:P[],paint:string){
  const g=new BufferGeometry();g.setAttribute('position',new Float32BufferAttribute(points.flat(),3));
  g.setIndex(points.length===3?[0,1,2]:[0,1,2,0,2,3]);g.computeVertexNormals();p.add(g,paint);
}
function prism(p:PaintedParts){
  // An open, three-sided refractometer: suspended double-ended salt crystal,
  // three collimating lenses, brass apex clamps and a graduated rotary bed.
  const brass='#ba965d',bronze='#71563b',ivory='#dfdcc9',blue='#435c68';
  p.add(turn([[0,-.10],[.30,-.10],[.37,.04],[.37,.15],[.30,.18],[0,.18]],12),blue);
  p.add(turn([[0,.16],[.32,.16],[.39,.20],[.39,.236],[.33,.25],[0,.25]],30),brass);
  for(let i=0;i<36;i++)p.add(box(0,.239,.368,.014,.009,i%3?.019:.037).rotateY(i*Math.PI/18),ivory);
  const ringPoint=(r:number,a:number,h:number):P=>[r*Math.sin(a),h,r*Math.cos(a)];
  for(let i=0;i<3;i++){
    const a=i*2*Math.PI/3;
    p.add(rod(ringPoint(.42,a,-.095),ringPoint(.42,a,.11),.072,.063,8),bronze);
    p.add(rod(ringPoint(.42,a,.085),ringPoint(.35,a,.322),.048,.046,8),brass);
    p.add(rod(ringPoint(.35,a,.29),ringPoint(.31,a,.91),.037,.026,8),ivory);
    p.add(rod(ringPoint(.31,a,.90),ringPoint(.075,a,1.263),.028,.026,8),brass);
    p.add(rod(ringPoint(.265,a,.716),ringPoint(.423,a,.716),.054,.062,12),bronze);
    p.add(rod(ringPoint(.414,a,.716),ringPoint(.433,a,.716),.051,.049,12),'#80a8a8');
  }
  p.add(turn([[0,.245],[.15,.245],[.15,.30],[.065,.32],[.045,.44],[0,.44]],12),blue);
  const clear=['#c7e5dc','#88bec9','#eed2a7','#b5c6e4','#d9abbe','#c5d9d0'];
  for(let i=0;i<6;i++){
    const a=i*Math.PI/3+.16,b=a+Math.PI/3;
    const lo=ringPoint(.191,a,.578),ln=ringPoint(.191,b,.578),hi=ringPoint(.191,a,.977),hn=ringPoint(.191,b,.977);
    facet(p,[[0,.40,0],ln,lo],clear[(i+2)%6]);facet(p,[lo,ln,hn,hi],clear[i]);facet(p,[hi,hn,[0,1.166,0]],clear[(i+4)%6]);
  }
  p.add(turn([[0,1.13],[.049,1.145],[.065,1.23],[.094,1.25],[.094,1.30],[.045,1.324],[0,1.324]],12),blue);
  p.add(ring(.08,.017,18).rotateX(Math.PI/2).translate(0,1.29,0),brass);
}

function kiln(p:PaintedParts){
  // Hooded field annealer. Three open stoking bays reveal the refractory
  // cup behind the darker cast-iron piers. Eccentric flue breaks symmetry.
  const iron='#404b55',oxide='#ac6b48',lip='#909295',fireclay='#ed9c5c';
  p.add(turn([[0,-.12],[.32,-.12],[.42,.045],[.44,.135],[.39,.19],[0,.19]],12),iron);
  p.add(turn([[0,.18],[.37,.18],[.42,.21],[.43,.28],[.35,.30],[0,.30]],12),oxide);
  p.add(turn([[0,.27],[.27,.27],[.245,.37],[.228,.41],[.25,.56],[.21,.59],[0,.59]],12),'#bb6947');
  for(const h of [.35,.44,.53])p.add(ring(.24,.015,16).rotateX(Math.PI/2).translate(0,h,0),fireclay);
  for(let i=0;i<3;i++){
    const a=i*2*Math.PI/3;
    p.add(box(0,.466,.329,.171,.40,.116).rotateY(a),iron);
    p.add(box(0,.485,.394,.12,.19,.020).rotateY(a),lip);
    for(const k of [-1,1])p.add(rod([k*.052,.30,.354],[k*.17,.65,.301],.021,.026,6).rotateY(a),oxide);
  }
  p.add(turn([[0,.61],[.35,.61],[.46,.645],[.46,.704],[.40,.74],[.36,.83],[.26,.93],[.16,.961],[0,.961]],16),iron);
  p.add(ring(.452,.016,32).rotateX(Math.PI/2).translate(0,.679,0),oxide);
  for(let i=0;i<8;i++){
    const a=i*Math.PI/4;p.add(rod([0,.726,.402],[0,.925,.252],.017,.014,6).rotateY(a),lip);
  }
  p.add(turn([[0,.87],[.129,.87],[.135,.95],[.113,.986],[.09,.995],[.09,1.26],[.122,1.282],[.122,1.319],[.080,1.319],[.074,1.24],[0,1.24]],12).translate(.147,0,0),oxide);
  for(const h of [1.035,1.206])p.add(ring(.092,.015,16).rotateX(Math.PI/2).translate(.147,h,0),iron);
  p.add(rod([-.12,.93,-.02],[-.12,1.065,-.02],.032,.03,8),lip);
  p.add(rod([-.12,1.097,-.08],[-.12,1.097,.04],.073,.077,14),iron);
  p.add(rod([-.12,1.097,.04],[-.12,1.097,.046],.064,.064,14),'#dbcfac');
  p.add(rod([-.12,1.097,.048],[-.15,1.131,.048],.009,.005,6),'#994c35');
}

export function twinStation(kind:'prism'|'kiln'){
  const p=new PaintedParts();if(kind==='prism')prism(p);else kiln(p);return p.finish();
}
