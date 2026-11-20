import {Joinery} from '../retreat/joinery';
import {velvetPlan as p} from './velvetLayout';
import {stripZ} from './velvetLight';
import {chaise,dressBackdrop,loungeBench} from './upholstery';
import {vanity,wardrobe} from './wardrobe';

const brass='#ae8569',plaster='#796773',wood='#705853';
export function buildVelvetStudio(){
  const s=new Joinery();s.slab('wood',p.floor,'#453b40');
  const planks=['#a1897c','#a88f7d','#988078','#a28a7f','#988278'];
  for(let i=0;i<36;i++)for(let j=-1;j<5;j++){
    const x=-4.20+.15+i*.3,st=-4+j*2.04+(i%3)*.68,a=Math.max(-4,st),b=Math.min(4,st+2.04);
    if(b-a>.006)s.box('wood',[x,.0005,(a+b)/2],.297,.001,b-a-.003,planks[(i+j+6)%5]);
  }
  // Isolated mouldings/human-scale room panels; full-height leaves on the
  // reverse wall and the parted doorway give the walk back a landmark too.
  for(const wall of p.walls){
    s.slab('matte',wall,plaster);s.box('wood',[wall.x,.13,wall.z],wall.w+.037,.26,wall.d+.037,wood);
    s.box('metal',[wall.x,.277,wall.z],wall.w+.043,.018,wall.d+.043,brass);
    s.box('matte',[wall.x,3.51,wall.z],wall.w+.103,.13,wall.d+.103,'#968188');
  }
  s.box('matte',[1.2,3.81,0],10.8,.12,8,'#c6aaa3');
  for(let i=0;i<7;i++){
    const z=-3.32+i*1.03;
    s.box('matte',[-4.113,1.75,z],.041,2.69,.88,'#84737d');
    for(const g of [-1,1])s.box('wood',[-4.085,1.75,z+g*.434],.013,2.72,.013,'#ab8b87');
    for(const yy of [.394,3.106])s.box('wood',[-4.085,yy,z],.013,.013,.876,'#ab8b87');
  }
  // Central seam is a real open portal; no decorative transom below the lintel.
  for(const wall of p.divider){s.slab('matte',wall,'#8b7278');s.box('wood',[wall.x,.13,wall.z],.21,.26,wall.d,wood);}
  s.slab('matte',p.lintel,'#927c80');
  for(const z of [.045,2.415])s.box('wood',[2.55,1.34,z],.23,2.68,.055,wood);
  s.box('metal',[2.55,2.68,1.23],.25,.035,2.42,brass);
  for(let i=0;i<14;i++)s.box('wood',[2.444,1.74,-3.75+i*.26],.033,2.68,.030,'#947677');
  // Door leaf and lever. The panel on the outer wall is scenery, not a room jump.
  s.box('wood',[.36,1.13,3.89],1.19,2.26,.085,'#725758');
  for(const off of [-.34,.34])s.box('matte',[.36+off,1.22,3.838],.40,1.75,.025,'#877172');
  s.box('metal',[.79,1.02,3.795],.16,.026,.08,brass);
  // Overhead rail, hangers and end stops. The entire strip moves between three
  // marked detents on this rail; the volume at floor level stays clear.
  s.box('metal',[-.13,3.54,stripZ],4.26,.11,.14,'#46414b');
  for(const x of [-2.04,-.13,1.79]){s.turn('metal',[x,3.651,stripZ],.034,.034,.19,'#6c5c61');s.box('metal',[x,3.48,stripZ],.065,.025,.16,brass);}
  const {x,z}=p.console;
  s.pad('metal',[x,.045,z],.72,.077,.41,.031,'#56474e');s.turn('metal',[x,.59,z],.042,.067,1.03,'#81666a');
  s.pad('stone',[x,1.187,z],.96,.335,.28,.056,'#483b44',[-.19,0,0]);
  s.box('metal',[x,1.026,z+.138],.82,.013,.015,brass);
  for(const xx of [1.63,-3.96]){
    s.box('metal',[xx,2.06,-3.52],.087,.64,.059,'#b18b69');s.orb('metal',[xx,1.80,-3.45],.112,.074,.11,brass);
    s.turn('glow',[xx,2.08,-3.42],.052,.052,.50,'#f9d7ab');
    for(const y of [1.829,2.331])s.turn('metal',[xx,y,-3.42],.063,.063,.031,'#c39e73');
  }
  dressBackdrop(s);chaise(s);wardrobe(s);loungeBench(s);vanity(s);
  // Small corner registration marks belong to the shooting floor, not the UI.
  for(const [mx,mz] of [...p.mainMarks,...p.wardrobeMarks])for(const d of [-1,1]){
    s.box('matte',[mx+d*.21,.0035,mz+.085],.09,.002,.014,'#d4b79b');
    s.box('matte',[mx+d*.247,.0035,mz+.05],.016,.002,.077,'#d4b79b');
  }
  const pieces=s.finish();
  // Project the etching in its real frame; a UV fan would pinch the engraving
  // and stretch its concentric lines at the crown of the arch.
  const print=pieces.find(p=>p.finish==='city')!.geometry;
  print.computeBoundingBox();const b=print.boundingBox!,pos=print.attributes.position,uv=print.attributes.uv;
  for(let i=0;i<pos.count;i++)uv.setXY(i,(pos.getX(i)-b.min.x)/(b.max.x-b.min.x),(pos.getY(i)-b.min.y)/(b.max.y-b.min.y));
  return pieces;
}
