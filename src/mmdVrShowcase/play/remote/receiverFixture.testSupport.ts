/** Generated PMX 2.0: an animated pelvis, a small garment on a lateral seam
 * spring and a hem vertex weighted 75% to its native dynamic bone. */
export function receiverFixture(units=1){
  const bytes:number[]=[], enc=new TextEncoder(), f=new DataView(new ArrayBuffer(4));
  const u8=(n:number)=>{bytes.push(n&255);},u16=(n:number)=>{u8(n);u8(n>>8);},i32=(n:number)=>{u16(n);u16(n>>16);};
  const vec=(...ns:number[])=>ns.forEach(n=>{f.setFloat32(0,n,true);bytes.push(...new Uint8Array(f.buffer));});
  const xyz=(x:number,y:number,z:number)=>vec(x*units,y*units,z*units);
  const str=(s:string)=>{const a=enc.encode(s);i32(a.length);bytes.push(...a);};
  const fixed=(s:string,n:number)=>{const a=new Uint8Array(n);a.set(enc.encode(s));bytes.push(...a);};
  fixed('PMX ',4);vec(2);bytes.push(8,1,0,1,1,1,1,1,1);str('Panel');str('Panel');str('');str('');
  i32(5);
  for(const [x,y,z,w] of [[0,0,0,0],[0,1.65,0,0],[-.015,.89,-.114,.75],[.015,.89,-.114,1],[0,.94,-.114,0]]){
    xyz(x,y,z);vec(0,0,-1,0,0);u8(1);u8(1);u8(0);vec(w,1);
  }
  i32(3);bytes.push(2,3,4);i32(0);i32(1);str('fabric');str('fabric');
  vec(.4,.4,.8,1,0,0,0,1,.3,.3,.3);u8(1);vec(0,0,0,1,0);bytes.push(255,255,0,1,0);str('');i32(3);
  i32(2);
  for(const [n,y,z,p] of [['Pelvis',1,0,-1],['hem',.909,-.114,0]] as const){str(n);str(n);xyz(0,y,z);u8(p);i32(0);u16(0x1e);xyz(0,-.08,0);}
  i32(0);i32(0);i32(2);
  for(const [i,n,y,z] of [[0,'seam post',1,0],[1,'skirt hem',.909,-.114]] as const){
    str(n);str(n);u8(i);u8(0);u16(1);u8(0);xyz(.011,.011,.011);xyz(0,y,z);vec(0,0,0,i*.035,.85,.35,0,.45);u8(i);
  }
  i32(1);str('seam');str('seam');bytes.push(0,0,1);xyz(0,.909,-.114);vec(0,0,0);
  xyz(-.10,0,0);xyz(.10,0,0);vec(0,0,0,0,0,0,45,0,0,0,0,0);
  const pmx=new File([Uint8Array.from(bytes)],'panel.pmx');bytes.length=0;
  fixed('Vocaloid Motion Data 0002',30);fixed('Panel',20);i32(2);
  for(const [frame,x] of [[0,0],[30,.2]]){fixed('Pelvis',15);i32(frame);xyz(x,0,0);vec(0,0,0,1);for(let i=0;i<64;i++)u8(i%16<8?20:107);}
  for(let i=0;i<5;i++)i32(0);
  return {pmx,vmd:new File([Uint8Array.from(bytes)],'pelvis.vmd')};
}
