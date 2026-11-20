import {A,Skin,type V} from './architectureMesh';

/** Coordinates in the joiner's elevation: u runs across the opening, n is
 * outward depth. Looking from the opposite room reads the other elevation. */
export class Frame {
  constructor(readonly g:Skin,readonly x:number,readonly z:number,readonly alongZ=false){}
  at(u:number,y:number,n:number):V{return this.alongZ?[this.x+n,y,this.z-u]:[this.x+u,y,this.z+n];}
  box(u:number,y:number,n:number,w:number,h:number,d:number,slot:number,c='#ffffff',tx=Infinity,ty=Infinity){
    const [x,,z]=this.at(u,y,n);this.g.block(x,y,z,this.alongZ?d:w,h,this.alongZ?w:d,slot,c,tx,ty);
  }
  line(u:number,y:number,u1:number,y1:number,n:number,w:number,depth=w,c='#ffffff',slot=A.wood as number){
    this.g.beam(this.at(u,y,n),this.at(u1,y1,n),w,depth,slot,c);
  }
  panel(u:number,y:number,n:number,w:number,h:number,sign:number,slot:number,c='#ffffff'){
    this.g.face([this.at(u-sign*w/2,y,n),this.at(u+sign*w/2,y,n),this.at(u+sign*w/2,y+h,n),this.at(u-sign*w/2,y+h,n)],slot,c);
  }
  rim(u:number,y:number,n:number,w:number,h:number,rail:number,d:number,c:string,slot=A.wood as number){
    for(const s of [-1,1]){
      this.line(u+s*(w-rail)/2,y,u+s*(w-rail)/2,y+h,n,rail,d,c,slot);
      this.line(u-w/2,y+rail/2+(h-rail)*(s+1)/2,u+w/2,y+rail/2+(h-rail)*(s+1)/2,n,d,rail,c,slot);
    }
  }
}

/** A closed paper light, set into the actual opening. Recessed muntins are
 * built on both faces of the opaque oiled paper, not printed on plaster. */
export function paperWindow(f:Frame,u:number,base:number,w:number,h:number,wallDepth:number,rich=true){
  const n=wallDepth/2;
  f.box(u,base+h*.5,0,w,h,.024,A.paper,'#f9f0da',1.6,1.4);
  for(const k of [-1,1]){
    f.rim(u,base,k*(n-.015),w+.034,h,.067,.072,'#bba58b');
    f.box(u,base-.026,k*n,w+.15,.074,.083,A.granite,'#d7d3bf');
    const nb=k*(n-.056),ns=Math.max(2,Math.round(w/.60)),bw=(w-.09)/ns;
    for(let i=1;i<ns;i++){const xx=u+(i/ns-.5)*(w-.09);f.line(xx,base+.046,xx,base+h-.046,nb,.040,.034,'#c8ac8b');}
    for(const yy of [.21,.29,.74,.82])f.line(u-w/2+.037,base+h*yy,u+w/2-.037,base+h*yy,nb,.026,.031,'#ccaf8b');
    for(let i=0;i<ns;i++){
      const x=u+((i+.5)/ns-.5)*(w-.09),xx=bw*(rich?.27:.13),cy=base+.51*h;
      const b=base+.29*h,t=base+.74*h;
      if(rich){ // octagonal lantern-jin: interrupted verticals leave a clear central pane
        const joint=.072;const path=[[x-xx,cy-.12],[x-xx+joint,b+joint],[x+xx-joint,b+joint],[x+xx,cy-.12],[x+xx,cy+.12],[x+xx-joint,t-joint],[x-xx+joint,t-joint],[x-xx,cy+.12],[x-xx,cy-.12]];
        for(let j=1;j<path.length;j++)f.line(path[j-1][0],path[j-1][1],path[j][0],path[j][1],nb,.018,.023,'#c4a789');
      }else f.line(x,b,x,t,nb,.021,.027,'#c4a789');
      for(const a of [-1,1]){
        f.line(x+a*xx,base+.045,x+a*xx,base+.21*h,nb,.021,.026,'#c4a789');
        f.line(x+a*xx,base+.82*h,x+a*xx,base+h-.045,nb,.021,.026,'#c4a789');
      }
    }
  }
}

/** Small metal rings hung on a round boss; the tilted ring has an actual
 * hollow centre and stands proud of the open door in both directions. */
export function ringPull(f:Frame,u:number,y:number,n:number,s:number){
  const shape=(a:number,b:number,rad:number,tube:number,off:number):V=>f.at(u+Math.cos(a)*(rad+tube*Math.cos(b)),y+Math.sin(a)*(rad+tube*Math.cos(b)),n+s*(off+tube*Math.sin(b)-.015*Math.sin(a)));
  f.box(u,y+.067,n,wBoss,.105,.028,A.granite,'#83704d');
  const count=14;for(let i=0;i<count;i++)for(let j=0;j<5;j++){
    const a=i/count*2*Math.PI,b=(i+1)/count*2*Math.PI,c=j/5*2*Math.PI,d=(j+1)/5*2*Math.PI;
    const q:[V,V,V,V]=[shape(a,c,.066,.011,.026),shape(b,c,.066,.011,.026),shape(b,d,.066,.011,.026),shape(a,d,.066,.011,.026)];if(s<0)q.reverse();f.g.face(q,A.plain,'#9e8556');
  }
}
const wBoss=.086;
