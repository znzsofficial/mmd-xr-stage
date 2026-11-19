import { BufferGeometry, Color, Float32BufferAttribute, LatheGeometry, Vector2 } from 'three';
import type { Part } from '../SceneryBatch';
import { span } from '../detailParts';

export type V = [number,number,number];
export const C = {chalk:'#e7e6d9',white:'#ebece6',porcelain:'#e8ede9',milk:'#d4dbd4',green:'#4f9285',teal:'#39796f',pine:'#285d5b',mint:'#b7d4c7',iron:'#6e8284',chrome:'#aebcba',graphite:'#354c4e',wood:'#bd9b76',oak:'#c9ad8b',rose:'#af7b80',slate:'#638487'};
type Mount = {p:V,w:number,h:number,yaw:number,cell:number};
export class ClinicParts {
  blocks:Part[]=[]; soft:Part[]=[]; poles:Part[]=[]; bowls:Part[]=[]; ovals:Part[]=[]; bulbs:Part[]=[]; glow:Part[]=[]; plates:Mount[]=[]; education:Mount[]=[];
  add(list:Part[],p:V,s:V,color:string,rx=0,ry=0,rz=0){list.push({p,s,color,rx,ry,rz});}
  box(x:number,y:number,z:number,w:number,h:number,d:number,c:string,rx=0,ry=0,rz=0){this.add(this.blocks,[x,y,z],[w,h,d],c,rx,ry,rz);}
  pad(x:number,y:number,z:number,w:number,h:number,d:number,c:string,rx=0,ry=0,rz=0){this.add(this.soft,[x,y,z],[w,h,d],c,rx,ry,rz);}
  cylinder(x:number,y:number,z:number,w:number,h:number,d:number,c:string,rx=0,ry=0,rz=0){this.add(this.poles,[x,y,z],[w,h,d],c,rx,ry,rz);}
  egg(x:number,y:number,z:number,w:number,h:number,d:number,c:string,rx=0,ry=0,rz=0){this.add(this.ovals,[x,y,z],[w,h,d],c,rx,ry,rz);}
  rod(a:V,b:V,d:number,c:string){this.poles.push(span(a,b,d,c));}
  lit(x:number,y:number,z:number,w:number,h:number,d:number,c:string){this.add(this.glow,[x,y,z],[w,h,d],c);}
  print(x:number,y:number,z:number,w:number,h:number,yaw:number,cell:number){this.plates.push({p:[x,y,z],w,h,yaw,cell});}
  // The plate face is advanced along its own normal, not the world Z axis.
  frame(x:number,y:number,z:number,w:number,h:number,yaw:number,cell:number,edge=C.graphite){
    this.box(x,y,z,w+.045,h+.045,.032,edge,0,yaw);
    this.print(x+.019*Math.sin(yaw),y,z+.019*Math.cos(yaw),w,h,yaw,cell);
  }
  poster(x:number,y:number,z:number,width:number,yaw:number,cell:number){
    const nx=Math.sin(yaw),nz=Math.cos(yaw),h=width*880/640;
    // Shallow oak gallery frame, cream mount and a separate printed sheet.
    this.box(x,y,z,width+.069,h+.069,.036,C.oak,0,yaw);
    this.box(x+.019*nx,y,z+.019*nz,width+.044,h+.044,.008,C.white,0,yaw);
    this.education.push({p:[x+.025*nx,y,z+.025*nz],w:width,h,yaw,cell});
  }
  platesGeometry(education=false){
    const pos:number[]=[],uv:number[]=[],idx:number[]=[];
    const columns=education?3:4,rows=education?2:4;
    for(const {p:[x,y,z],w,h,yaw,cell} of education?this.education:this.plates){
      const start=pos.length/3, col=cell%columns,row=Math.floor(cell/columns);
      for(const [a,b] of [[-1,-1],[1,-1],[1,1],[-1,1]]){
        pos.push(x+a*w*.5*Math.cos(yaw), y+b*h*.5, z-a*w*.5*Math.sin(yaw));
        const v=cell===14?(b>0?.275:.702):(b>0?.003:.997);
        uv.push((col+(a<0?.002:.998))/columns,1-(row+v)/rows);
      }
      idx.push(start,start+1,start+2,start,start+2,start+3);
    }
    const g=new BufferGeometry();g.setAttribute('position',new Float32BufferAttribute(pos,3));g.setAttribute('uv',new Float32BufferAttribute(uv,2));g.setIndex(idx);g.computeVertexNormals();return g;
  }
}

// Outer foot and lip, rolled rim and descending inner glaze constitute one
// continuous ceramic surface: close-up views really see down into the bowl.
export function bowlGeometry() {
  const profile=[[.07,-.5],[.28,-.44],[.39,-.28],[.48,.19],[.50,.40],[.49,.49],[.44,.50],[.419,.39],[.37,.12],[.27,-.15],[.11,-.28],[.045,-.29]];
  return new LatheGeometry(profile.map(([r,h])=>new Vector2(r,h)),28);
}

export function curtainGeometry(x:number,z:number){
  const pos:number[]=[],rgb:number[]=[],idx:number[]=[];
  const rows=[[.50,'#709a90'],[.53,'#a7c9bc'],[.58,'#abc9bd'],[1.58,'#a8c9bb'],[2.18,'#b4cfc2'],[2.19,'#86aa9e'],[2.214,'#d3dccc'],[2.40,'#d5dfd2'],[2.416,'#92b3a5'],[2.452,'#adc8b9']] as const;
  for(const [j,[h,col]] of rows.entries())for(let k=0;k<=96;k++){
    const a=k/96,drop=(2.45-h)/1.95,phase=a*9*2*Math.PI+drop*.50*Math.sin(a*10),fold=Math.sin(phase);
    pos.push(x+(.056+.022*drop)*fold,h+drop*.026*Math.sin(a*16),z+(a-.5)*(1.08+drop*.095));
    const c=new Color(col).multiplyScalar(.9+.1*Math.cos(phase));rgb.push(c.r,c.g,c.b);
    if(j>0&&k>0){const i=j*97+k;idx.push(i-98,i-1,i-97,i-1,i,i-97);}
  }
  const g=new BufferGeometry();g.setAttribute('position',new Float32BufferAttribute(pos,3));g.setAttribute('color',new Float32BufferAttribute(rgb,3));g.setIndex(idx);g.computeVertexNormals();return g;
}

// A rounded rectangular extrusion with chamfered top and bottom. Kept small
// because it repeats on joinery, bed segments and the waiting seats.
export function padGeometry(){
  const pos:number[]=[],idx:number[]=[],verts=16;
  for(const [y,scale] of [[-.5,.94],[-.37,1],[.26,1],[.5,.945]]){
    for(let corner=0;corner<4;corner++){
      const cx=corner===0||corner===3?.409:-.409, cz=corner<2?.409:-.409;
      for(let k=0;k<4;k++){
        const a=(corner+k/3)*Math.PI/2;pos.push((cx+.091*Math.cos(a))*scale,y,(cz+.091*Math.sin(a))*scale);
      }
    }
  }
  for(let ring=0;ring<3;ring++)for(let i=0;i<verts;i++){
    const a=ring*verts+i,b=ring*verts+(i+1)%verts;idx.push(a,a+verts,b,b,a+verts,b+verts);
  }
  for(let i=1;i<verts-1;i++){idx.push(0,i,i+1,48,48+i+1,48+i);}
  const g=new BufferGeometry();g.setAttribute('position',new Float32BufferAttribute(pos,3));g.setIndex(idx);g.computeVertexNormals();return g;
}
