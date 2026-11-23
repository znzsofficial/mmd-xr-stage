import {BufferGeometry,Float32BufferAttribute,RingGeometry} from 'three';
import {PaintedParts,box,ring,turn} from '../../play/modelParts';
import {windFace,type WindTerminal} from './windTerminalLayout';
import {windCollarBed} from './windCollarBed';

const brass='#bf9365',enamel='#285e61',cream='#ead7af',seal='#34464c';

// An octagonal casting with a closed back. The little bevel catches the
// same warm highlight as the ribs of the transit dome. +Z is the reader.
function bezel(){
  const positions:number[]=[],indices:number[]=[];
  for(const [w,h,z] of [[.486,.207,-.096],[.516,.229,-.074],[.516,.229,-.030],[.503,.215,-.006]]){
    const cut=.024;
    for(const [x,y] of [[-w+cut,-h],[w-cut,-h],[w,-h+cut],[w,h-cut],[w-cut,h],[-w+cut,h],[-w,h-cut],[-w,-h+cut]])positions.push(x,y,z);
  }
  for(let j=0;j<3;j++)for(let i=0;i<8;i++){
    const a=j*8+i,b=j*8+(i+1)%8;indices.push(a,b,b+8,a,b+8,a+8);
  }
  for(let i=1;i<7;i++)indices.push(0,i+1,i,24,24+i,25+i);
  const g=new BufferGeometry();g.setAttribute('position',new Float32BufferAttribute(positions,3));g.setIndex(indices);
  // Hard bevels, rather than interpolation around the extremely thin rim.
  const flat=g.toNonIndexed();g.dispose();flat.computeVertexNormals();return flat;
}
function housing(){
  const p=new PaintedParts();
  const cast=(profile:number[][],paint:string)=>p.add(turn(profile,12).scale(1,1,.76).translate(0,0,-.038),paint);
  cast([[0,-.250],[.188,-.250],[.205,.075],[.205,.117],[.181,.146]],brass);
  cast([[.181,.146],[.173,.188]],cream);
  cast([[.173,.188],[.126,.242],[0,.249]],brass);
  const shaft=(profile:number[][],paint:string)=>p.add(turn(profile,12).scale(1,1,.76).translate(0,0,-.055),paint);
  shaft([[0,.239],[.104,.239],[.104,.293],[.083,.335],[.061,.68],[.074,.879]],enamel);
  shaft([[.074,.879],[.103,.911],[.103,.938]],cream);
  shaft([[.103,.938],[.103,.98],[.075,1.113],[0,1.113]],enamel);
  // A dark insulating gasket behind the printed face, not on top of it.
  const onHead=(g:BufferGeometry,paint:string)=>p.add(g.rotateX(windFace.tilt).translate(0,windFace.y,windFace.z),paint);
  onHead(bezel(),brass);onHead(box(0,0,-.005,.976,.402,.006),seal);
  // An enamel name strip on the closed rear cover.
  onHead(box(0,0,-.097,.65,.145,.004),enamel);
  return p.finish();
}

// Cast the nozzle and its active stripe onto the local shell, in the port's
// frame. Feet of the pedestal deliberately socket into the rock.
function collarBed(site:WindTerminal){
  const height=windCollarBed(site);
  return (g:BufferGeometry)=>{
    const pos=g.attributes.position;
    for(let k=0;k<pos.count;k++){
      pos.setY(k,pos.getY(k)+height(pos.getX(k),pos.getZ(k)));
    }
    g.computeVertexNormals();g.computeBoundingSphere();return g;
  };
}
export function windTerminalModel(site:WindTerminal){
  const parts=new PaintedParts(),bed=collarBed(site);
  for(const [r,tube,y,paint] of [[.68,.075,.030,seal],[.71,.023,.088,brass],[.48,.028,.035,cream]] as const)
    parts.add(bed(ring(r,tube,56).rotateX(Math.PI/2).translate(0,y,0)),paint);
  for(let i=0;i<18;i++)parts.add(bed(box(0,.050,.565,.074,.085,.19).rotateY(i*Math.PI/9+.17)),i%3?'#697b83':'#a4aea9');
  parts.add(housing().translate(...site.mount.toArray()));
  const body=parts.finish(),indicator=bed(new RingGeometry(.656,.682,56).rotateX(-Math.PI/2).translate(0,.100,0));
  return {body,indicator};
}
