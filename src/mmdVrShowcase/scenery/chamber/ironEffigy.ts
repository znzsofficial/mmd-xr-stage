import {SOLE,MANTLE,VISAGE,effigyPoint as point,ringPoint,rim,type Casting,type Point} from './effigyShape';
import {Masonry,type Finish} from './masonry';

function casting(m:Masonry,b:Casting,f:Finish,tints:readonly string[]){
  for(let row=0;row<b.rings.length-1;row++)for(let i=0;i<rim.length;i++){
    const j=(i+1)%rim.length,low=b.rings[row],high=b.rings[row+1];
    const face:[Point,Point,Point,Point]=[ringPoint(b,low,i),ringPoint(b,low,j),ringPoint(b,high,j),ringPoint(b,high,i)];
    m.face(f,face,tints[(i+row*3)%tints.length],'xy');
  }
  for(const r of [b.rings[0],b.rings[b.rings.length-1]])for(let i=0;i<rim.length;i++){
    const ctr=point(0,r[0],b.offset),a=ringPoint(b,r,i),v=ringPoint(b,r,(i+1)%rim.length);
    m.quad(f,[ctr,a,v,ctr],tints[0]);
  }
}

function radiusAt(b:Casting,y:number){
  for(let i=1;i<b.rings.length;i++){const [h,r]=b.rings[i-1],[H,R]=b.rings[i];if(y<=H)return r+(R-r)*(y-h)/(H-h);}
  return b.rings[b.rings.length-1][1];
}
function front(b:Casting,x:number,y:number,relief=.002){
  const r=radiusAt(b,y),n=Math.abs(x)/r,v=n<.71?1-.12*n/.71:.88-.46*(n-.71)/.29;
  return point(x,y,b.offset+b.depth*r*v+relief);
}

// Not a door: the relief, robe folds and rows of bosses are surface decoration.
export function ironEffigy(m:Masonry){
  casting(m,SOLE,'toolstone',['#8b8272','#9d9382','#97907e']);
  casting(m,MANTLE,'iron',['#4c5250','#525957','#464e4f','#575b55','#4c5150']);
  casting(m,VISAGE,'iron',['#ab977a','#b8aa8b','#c3b397','#ac997e','#bdac8e']);

  // Wide scalloped mantle over fluted skirts. Centre ribs catch the cool window light.
  function ribbon(b:Casting,path:readonly [number,number][],width:number,emboss:number,light:string,dark:string){
    for(let i=1;i<path.length;i++){
      const [x,y]=path[i-1],[X,Y]=path[i],dx=X-x,dy=Y-y,L=Math.hypot(dx,dy),w=width/2,ox=-dy/L*w,oy=dx/L*w;
      for(const side of [-1,1])m.quad('iron',[front(b,x+side*ox,y+side*oy),front(b,X+side*ox,Y+side*oy),front(b,X,Y,emboss),front(b,x,y,emboss)],side===1?light:dark);
    }
  }
  for(const side of [-1,1]){
    ribbon(MANTLE,[[.37*side,1.53],[.285*side,1.47],[.19*side,1.42],[0,1.38]],.033,.014,'#aa956e','#756a54');
    ribbon(MANTLE,[[.331*side,1.41],[.267*side,1.32],[.175*side,1.24],[0,1.19]],.026,.012,'#938575','#625e50');
    for(let i=1;i<=3;i++){const q=i/3;ribbon(MANTLE,[[side*(.056+.13*q),1.15],[side*(.061+.19*q),.89],[side*(.075+.20*q),.70],[side*(.099+.21*q),.31]],.035,.014,'#686e67','#414747');}
  }
  function boss(b:Casting,x:number,y:number,r:number){
    const center=front(b,x,y,r*.63);
    for(let i=0;i<8;i++){
      const a=i*Math.PI/4,v=a+Math.PI/4;m.quad('iron',[center,front(b,x+r*Math.cos(a),y+r*Math.sin(a)),front(b,x+r*Math.cos(v),y+r*Math.sin(v)),center],i<4?'#ae9872':'#82745b');
    }
  }
  for(let i=0;i<10;i++){const y=.32+i*.126;for(const s of [-1,1])boss(MANTLE,s*.845*radiusAt(MANTLE,y),y,.014);}
  for(let i=-4;i<=4;i++)boss(MANTLE,i*.082,.272,.012);
  // Visage: a low repoussé forehead, closed eyelids and long wedge nose, all in the casting.
  for(const s of [-1,1]){
    ribbon(VISAGE,[[.019*s,1.812],[.060*s,1.826],[.111*s,1.813]],.017,.018,'#d9c8a9','#7b6c57');
    ribbon(VISAGE,[[.029*s,1.791],[.067*s,1.786],[.104*s,1.801]],.010,.006,'#6d6251','#7b6a50');
    m.quad('iron',[front(VISAGE,s*.012,1.813,.012),front(VISAGE,s*.030,1.736,.014),front(VISAGE,0,1.727,.040),front(VISAGE,0,1.806,.026)],s>0?'#9d8b72':'#d1ba97');
  }
  ribbon(VISAGE,[[-.041,1.693],[0,1.696],[.041,1.693]],.009,.005,'#776453','#ab947c');
  ribbon(VISAGE,[[-.119,1.878],[0,1.861],[.119,1.878]],.025,.013,'#bb9a6d','#948167');
  boss(VISAGE,0,1.871,.021);
  // Blank wax lozenge below the collar, with a three-stroke inventory mark.
  m.quad('pigment',[front(MANTLE,-.081,1.27,.012),front(MANTLE,0,1.198,.018),front(MANTLE,.081,1.27,.012),front(MANTLE,0,1.343,.018)],'#824739');
  for(const x of [-.025,0,.025])m.quad('pigment',[front(MANTLE,x-.003,1.251,.023),front(MANTLE,x+.003,1.251,.023),front(MANTLE,x+.003,1.290,.023),front(MANTLE,x-.003,1.290,.023)],'#d5b68a');
}
