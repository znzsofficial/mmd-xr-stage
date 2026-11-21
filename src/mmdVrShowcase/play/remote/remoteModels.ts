import { CatmullRomCurve3, ExtrudeGeometry, Shape, TubeGeometry, Vector3 } from 'three';
import { ball, box, PaintedParts, ring, turn } from '../modelParts';

const berry='#995675', pearl='#f3e5dc', shell='#db9fa7', seam='#593d4e';

/** Tapered two-piece handset with a raised thumb key and an inset lamp window. */
export function makeEggHandset() {
  const p=new PaintedParts(), outline=new Shape();
  outline.moveTo(0,-.047);
  outline.bezierCurveTo(.016,-.047,.021,-.038,.022,-.019);
  outline.lineTo(.026,.026); outline.bezierCurveTo(.027,.049,.022,.060,0,.060);
  outline.bezierCurveTo(-.022,.060,-.027,.049,-.026,.026); outline.lineTo(-.022,-.019);
  outline.bezierCurveTo(-.021,-.038,-.016,-.047,0,-.047);
  const face=(depth:number)=>new ExtrudeGeometry(outline,{depth,curveSegments:7,bevelSegments:3,bevelThickness:.003,bevelSize:.003,bevelEnabled:true});
  p.add(face(.007).translate(0,0,-.011),berry);
  p.add(face(.004).translate(0,0,-.001),pearl);
  p.add(ball(0,.010,.007,.014,.017,.0032),shell);
  p.add(ring(.0062,.0009,24).translate(0,.009,.0102),berry);
  p.add(box(0,.015,.0107,.0019,.0065,.0011),berry);
  p.add(ball(0,.041,.006,.019,.009,.0018),seam);
  for(let i=-1;i<=1;i++)p.add(box(i*.009,.041,.008,.005,.008,.001),'#7b6a71');
  for(const x of [-.004,.004])p.add(ball(x,-.031,-.014,.0016,.002,.0008,10),'#c8a76d');
  return p.finish();
}

/** Soft asymmetric egg, moulded collar and a flexible closed retrieval loop. */
export function makeEggReceiver() {
  const p=new PaintedParts();
  const g=turn([[0,-.031],[.008,-.030],[.014,-.026],[.018,-.020],[.0205,-.012],[.021,0],
    [.0195,.009],[.0165,.018],[.012,.024],[.007,.028],[0,.029]],32).scale(1,1,.88);
  p.add(g,shell);
  p.add(turn([[.004,-.035],[.0065,-.032],[.0081,-.029],[.009,-.028]],24).scale(1,1,.88),berry);
  const loop=new CatmullRomCurve3([[0,-.033,0],[-.006,-.043,.003],[-.010,-.060,.01],[-.007,-.073,.014],
    [.002,-.078,.015],[.009,-.073,.014],[.010,-.060,.01],[.006,-.043,.003],[0,-.033,0]].map(v=>new Vector3(...v)));
  p.add(new TubeGeometry(loop,32,.0022,7,false),berry);
  return p.finish();
}
