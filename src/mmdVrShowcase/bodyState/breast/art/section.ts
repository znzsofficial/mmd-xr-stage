import { cutBounds, ellipse, type Ink, type Side, TAU } from './geometry';

// Coordinates on the actual cut plane. Lobes and duct endpoints live in
// these coordinates too, so annotation leaders rotate with the artwork.
export const W=200, H=238, Y=99, R=96;
export const glandPoint=[.34,.23] as const;
export const ductPoint=[.79,-.26] as const;
export const fatPoint=[.52,-.94] as const;
const lobes = [ // anterior fraction, height, long and short radii in plate units
  [.13,.37,15,9],[...glandPoint,16,10],[.55,.08,13,8],
  [.15,-.03,14,9],[.32,-.20,15,10], [.16,-.52,17,10],
  [.37,-.73,16,9],[.58,-.65,13,8],[.69,-.48,12,7],
];

function outline(ctx:Ink) {
  ctx.beginPath();
  // Sample more densely at the curved anterior tip.
  for(let j=0;j<=36;j++){
    const s=Math.sin(j/36*Math.PI/2),y=Y-cutBounds(s)[0]*R;
    if(j===0)ctx.moveTo(0,y);else ctx.lineTo(W*s,y);
  }
  for(let j=35;j>=0;j--){const s=Math.sin(j/36*Math.PI/2);ctx.lineTo(W*s,Y-cutBounds(s)[1]*R);}
  ctx.closePath();
}

// Seedless, repeatable anatomical engraving. This is an illustrative section,
// not an inferred compartment or a milk-level gauge in anatomical units.
export function drawSection(ctx:Ink, side:Side, fill:number, lactating:boolean) {
  ctx.save();outline(ctx);ctx.clip();
  const fat=ctx.createLinearGradient(18,16,144,229);
  fat.addColorStop(0,'#ebc99f');fat.addColorStop(.4,'#f0c58e');fat.addColorStop(.78,'#e2ad76');fat.addColorStop(1,'#c68e65');
  ctx.fillStyle=fat;ctx.fillRect(0,0,W,H);
  ctx.lineJoin='round';ctx.lineCap='round';

  // Adipose lobules bounded by delicate connective tissue. Adjacent pads
  // share vertices (no stipple of unrelated dots on the surface).
  const knot=(i:number,j:number)=>[i*23+(j%2)*11+4*Math.sin(i*7+j*3.4),j*20+4*Math.sin(i*2.3-j*6.5)];
  ctx.strokeStyle='#c99b70';ctx.lineWidth=.84;
  for(let j=0;j<12;j++)for(let i=-1;i<10;i++) {
    const [x,y]=knot(i,j),[xx,yy]=knot(i+1,j),[dx,dy]=knot(i,j+1);
    ctx.beginPath();ctx.moveTo(x,y);ctx.quadraticCurveTo((x+xx)/2,Math.min(y,yy)-3,xx,yy);
    ctx.moveTo(x,y);ctx.quadraticCurveTo((x+dx)/2+2,(y+dy)/2,dx,dy);ctx.stroke();
  }
  // Suspensory septa travel from posterior fascia towards the dermis.
  ctx.strokeStyle='#f7e0b0';ctx.lineWidth=1.7;
  for(const [a,b,end] of [[66,37,70],[79,50,118],[146,181,134],[161,198,88]]){
    ctx.beginPath();ctx.moveTo(-2,a);ctx.bezierCurveTo(29,a+3,62,b,end,b);ctx.stroke();
  }

  // Distinct lobar ducts converge on several openings, rather than one
  // central tank. Distal branches enter the groups of lobules below.
  const outlet=Y+.30*R;
  for (let i=0;i<lobes.length;i++) {
    const [s,h]=lobes[i],x=s*W,y=Y-h*R;
    const end=outlet+(i-4)*.53,branch=(ty:number,shift:number)=>{
      ctx.beginPath();ctx.moveTo(x-4,ty);ctx.bezierCurveTo(x+27,ty+shift,W*.73,end+.52*(ty-end),W+2,end);
    };
    branch(y,(end-y)*.12);ctx.strokeStyle='#a35f56';ctx.lineWidth=3.65;ctx.stroke();
    ctx.strokeStyle='#fae2be';ctx.lineWidth=1.82;ctx.stroke();
  }
  for (let i=0;i<lobes.length;i++) {
    const [s,h,rx,ry]=lobes[i],x=s*W,y=Y-h*R;
    const angle=Math.atan2(outlet-y,W-x),ca=Math.cos(angle),sa=Math.sin(angle);
    // Increasing fullness of one side affects only its own glandular tissue.
    const growth=lactating ? .89+.30*fill : .92;
    const tint=lactating?fill:0;
    const base=`rgb(${Math.round(179+47*tint)},${Math.round(104+69*tint)},${Math.round(111+51*tint)})`;
    const lit=`rgb(${Math.round(222+25*tint)},${Math.round(159+53*tint)},${Math.round(153+46*tint)})`;
    ctx.save();ctx.translate(x,y);ctx.rotate(angle);ctx.scale(growth,growth);
    // Scalloped outer membrane and asymmetrical lobular islands.
    ctx.beginPath();
    for(let k=0;k<=60;k++){
      const a=k/60*TAU,r=1+.085*Math.cos(8*a+i)+.062*Math.sin(5*a+i*.43);
      const xx=rx*r*Math.cos(a),yy=ry*r*Math.sin(a)*(1-.16*Math.cos(a));
      if(!k)ctx.moveTo(xx,yy);else ctx.lineTo(xx,yy);
    }ctx.closePath();ctx.fillStyle=base;ctx.fill();ctx.lineWidth=1.2;ctx.strokeStyle='#9e6366';ctx.stroke();
    for(let k=0;k<8;k++){
      const a=k/8*TAU+Math.sin(i*3.8+side)*.31,dx=rx*.61*Math.cos(a),dy=ry*.63*Math.sin(a);
      ellipse(ctx,dx,dy,rx*.26,ry*.29,a*.37);ctx.fillStyle=lit;ctx.fill();
    }
    ctx.strokeStyle='#f7d4b8';ctx.lineWidth=1.28;
    for(const k of [-1,1]){
      ctx.beginPath();ctx.moveTo(rx+4,0);ctx.bezierCurveTo(rx*.3,1,rx*.17,k*ry*.40,-rx*.58,k*ry*.52);ctx.stroke();
    }
    ctx.restore();
    ctx.beginPath();ctx.moveTo(x+rx*.86*ca,y+rx*.86*sa);ctx.lineTo(x+(rx+4)*ca,y+(rx+4)*sa);
    ctx.lineWidth=1.55;ctx.strokeStyle='#ffe6c3';ctx.stroke();
  }
  // Retromammary fascia adjacent to the muscle, and a narrow dermal margin.
  ctx.fillStyle='#f4dcc2';ctx.fillRect(0,0,3.5,H);
  outline(ctx);ctx.lineWidth=5.0;ctx.strokeStyle='#f5cdad';ctx.stroke();
  outline(ctx);ctx.lineWidth=1.8;ctx.strokeStyle='#a96f67';ctx.stroke();
  ctx.restore();
}
