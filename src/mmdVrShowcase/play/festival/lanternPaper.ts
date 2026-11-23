import { BufferGeometry, CatmullRomCurve3, Color, Float32BufferAttribute, OctahedronGeometry, TubeGeometry, Vector3 } from 'three';
import { ball, PaintedParts, ring, turn } from '../modelParts';
import { lanternGrip } from './lanternFlight';

const tau=Math.PI*2;
type Dot=readonly [number,number,number,string];
function paintedSheet(rows:number,cols:number,dot:(row:number,col:number)=>Dot){
  const pos:number[]=[],colors:number[]=[],index:number[]=[],color=new Color();
  for(let r=0;r<=rows;r++)for(let c=0;c<=cols;c++){
    const [x,y,z,tint]=dot(r,c);pos.push(x,y,z);color.set(tint);colors.push(color.r,color.g,color.b);
    if(r<rows&&c<cols){const a=r*(cols+1)+c,b=a+cols+1;index.push(a,a+1,b,a+1,b+1,b);}
  }
  const g=new BufferGeometry();g.setAttribute('position',new Float32BufferAttribute(pos,3));
  g.setAttribute('color',new Float32BufferAttribute(colors,3));g.setIndex(index);g.computeVertexNormals();return g;
}

/** A single sheet, hinge at its foot. In the closed bud the top folds
 * back towards the centre. In flower the very same ribs turn outwards. */
export function lanternPetal(){
  // height, distance from hinge axis, half-width, fold depth
  const rows=[[0,.008,.004,.001],[.012,.029,.016,.006],[.040,.046,.025,.009],[.055,.047,.025,.009],
    [.059,.047,.025,.009],[.078,.036,.019,.006],[.093,.018,.010,.003],[.099,.004,.002,.001]];
  return paintedSheet(rows.length-1,6,(r,c)=>{
    const [y,radius,w,fold]=rows[r],u=(c-3)/3,edge=Math.abs(u),crease=c===3?1:c%2?.45:0;
    const color=c===0||c===6?'#db7879':r===3||r===4?'#ffe7a6':c===3?'#fff1da':c%2?'#ffcbb7':'#f4a5a0';
    return [u*w,y-edge*fold*.3,radius-edge*edge*fold+crease*.0018,color];
  });
}

/** Ten scallops, a pleated paper crown and a bright turned-under hem. The
 * underside has its own print, since one normally looks up at swimming jellies. */
function bell(paper:boolean){
  const rows=[[.001,.011],[.022,.010],[.038,.004],[.041,0],[.043,.003],
    [.042,.007],[.037,.021],[.028,.032],[.015,.040],[.001,.043]];
  return paintedSheet(rows.length-1,60,(r,c)=>{
    const a=tau*c/60,fold=(1+Math.cos(10*a))*.5,[radius,h]=rows[r];
    const rad=radius*(.95+.05*fold),scallop=r>1&&r<7?.0038*(1-fold):0;
    const tint=paper?(r===4?'#f5cd83':r<4?'#eea68d':c%6===0?'#fddfb3':r>7?'#fff4db':c%6<3?'#e99e95':'#edae9a'):
      r===3?'#effffe':r===4?'#80d9d9':r<3?'#edc9a9':r>7?'#fffced':c%6===0?'#f5fff2':c%6<3?'#c9ebe7':'#a2d6dc';
    return [rad*Math.sin(a),h+scallop,rad*Math.cos(a),tint];
  });
}

export function lanternBell(){
  const p=new PaintedParts();p.add(bell(false));
  p.add(ball(0,.007,0,.018,.013,.018,12),'#ffe8ae');
  for(let i=0;i<10;i++){
    const a=tau*(i+.5)/10;
    p.add(new OctahedronGeometry().scale(.0025,.003,.0025).translate(.035*Math.sin(a),.008,.035*Math.cos(a)),'#ffffe6');
  }
  return p.finish();
}

export function lanternTassels(){
  const p=new PaintedParts();
  for(let i=0;i<7;i++){
    const a=tau*i/7,inner=i===1||i===5,r=inner?.012:.032,len=(inner?.122:.084)+.018*Math.sin(3.1*i+.4);
    const path=Array.from({length:9},(_,k)=>{
      const t=k/8,phi=a+(inner?1.4:.47)*Math.sin(t*6+i)*t,d=r*(1-.42*t)+.008*Math.sin(5*t+i)*t;
      return new Vector3(d*Math.cos(phi)+.009*t*t,-len*t+.006,d*Math.sin(phi));
    });
    const g=new TubeGeometry(new CatmullRomCurve3(path),12,inner?.0045:.0023,5,false);
    p.add(g,inner?'#ffc5a5':i%2?'#b6ece4':'#ffe8c7');
    const end=path[8];p.add(new OctahedronGeometry().scale(.0028,.004,.0028).translate(end.x,end.y,end.z),'#f9ffdb');
  }
  return p.finish();
}

/** A hand lantern with a lacquered bamboo grip, pleated jellyfish shade and
 * hanging silk knots. Modelled in final Piece coordinates for the wrist fit. */
export function lanternHandpiece(){
  const p=new PaintedParts(),[gx,gy,gz]=lanternGrip.point;
  const grip=(g:BufferGeometry)=>g.rotateX(-lanternGrip.pitch).translate(gx,gy,gz);
  p.add(grip(turn([[0,-.051],[.008,-.051],[.012,-.048],[.009,-.04],[.009,.023],[.011,.031],[.008,.035],[.0045,.082],[0,.084]],18)),'#83504a');
  for(const y of [-.043,-.027,-.022,.026,.032,.068])p.add(grip(ring(y>.05?.0056:.0093,.0013,20).rotateX(Math.PI/2).translate(0,y,0)),y<0?'#e4bb8b':'#d1aa60');
  p.add(grip(ball(0,.090,0,.018,.020,.018,14)),'#efc37a');
  const cz=-.085,cy=.063;
  p.add(bell(true).scale(1.26,1.15,1.26).translate(0,cy,cz));
  p.add(ring(.047,.0015,40).rotateX(Math.PI/2).translate(0,cy+.005,cz),'#a67448');
  for(let i=0;i<6;i++){
    const a=tau*(i+.5)/6,x=.044*Math.cos(a),z=.044*Math.sin(a),end=.048+.013*Math.cos(i*3);
    const curve=new CatmullRomCurve3([new Vector3(x,cy+.006,cz+z),new Vector3(x*1.09,cy-.015,cz+z*1.08),
      new Vector3(x*.94+.003,cy-end*.72,cz+z*.98),new Vector3(x*.81+.003,cy-end,cz+z*.9)]);
    p.add(new TubeGeometry(curve,8,.0017,5,false),i%2?'#a4d2c7':'#be7779');
    const tip=curve.points[3];p.add(new OctahedronGeometry().scale(.003,.004,.003).translate(tip.x,tip.y,tip.z),'#e9bd79');
  }
  p.add(ball(0,cy+.05,cz,.006,.005,.006,10),'#e5b87a');
  return p.finish();
}
