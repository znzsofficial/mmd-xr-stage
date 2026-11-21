import {CABINET,corner,outline,rings} from './cabinetShape';
import {Masonry,type V} from './masonry';

// An enamelled pavilion in miniature. The pointed panel and its brass inlay are
// tessellated INTO the broad facets; there are no decals over a second metal skin.
function lancet(m:Masonry,a:V,b:V,h:number){
  const at=(u:number,v:number):V=>[a[0]+(b[0]-a[0])*u,a[1]+v*h,a[2]+(b[2]-a[2])*u];
  const rows=[[0,.5,.5],[.09,.37,.33],[.68,.37,.33],[.79,.25,.207],[.93,0,0],[1,0,0]];
  for(let j=1;j<rows.length;j++){
    const [y,o,i]=rows[j-1],[Y,O,I]=rows[j];
    const cut=(outer:number,inner:number)=>[0,.5-outer,.5-inner,.5,.5+inner,.5+outer,1];
    const lo=cut(o,i),hi=cut(O,I),colors=['#404d50','#b49561','#334c53','#3c585c','#9a8058','#404d50'];
    for(let k=0;k<6;k++)m.quad('iron',[at(lo[k],y),at(lo[k+1],y),at(hi[k+1],Y),at(hi[k],Y)],colors[k]);
  }
}

export function ironCabinet(m:Masonry){
  const stone=['#8c8591','#b1a496','#9b9290','#af9d85'];
  const metal=['#967852','#b99764','#475658','#927651','#b89b6a','#685e54','#556a70','#ad9876'];
  for(let row=0;row<rings.length-1;row++)for(let i=0;i<outline.length;i++){
    const a=corner(row,i),b=corner(row,i+1);
    if(row===6&&i%2===0){lancet(m,a,b,rings[row+1][0]-a[1]);continue;}
    m.face(row<4?'toolstone':'iron',[a,b,corner(row+1,i+1),corner(row+1,i)],row<4?stone[row]:metal[row-4],i%4===2?'zy':'xy');
  }
  const last=rings.length-1,cap:V=[CABINET.x,rings[last][0],CABINET.z];
  for(let i=0;i<outline.length;i++)m.quad('iron',[cap,corner(last,i+1),corner(last,i),cap],'#908779');
}
