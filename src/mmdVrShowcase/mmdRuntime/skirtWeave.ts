import {Vector3} from 'three';

export type WeaveColumn={angle:number;bind:Vector3[];raw:Vector3[];posed:Vector3[];gain:number};
type Point={p:Vector3;raw:Vector3;bind:Vector3;weight:number;target:Vector3};

/** The hem is a sheet, not a collection of independent chains. Maintain the
 * warp, weft and two diagonals while it folds; keep a lightly gathered arc in
 * the middle and leave the unpressed selvages/waist as fixed boundaries. */
export function fitSkirtWeave(columns:WeaveColumn[]){
  const edges:{a:Point;b:Point;rest:number}[]=[],all:Point[]=[],dx=new Vector3();
  const sorted=columns.slice().sort((a,b)=>a.angle-b.angle),rows=sorted.map(c=>c.posed.map((p,i)=>{
    const a={p,raw:c.raw[i],bind:c.bind[i],target:new Vector3(),weight:i&&c.gain>0?1:0};all.push(a);return a;}));
  const edge=(a:Point,b:Point)=>{if(a.weight||b.weight)edges.push({a,b,rest:a.bind.distanceTo(b.bind)});};
  for(let k=0;k<rows.length;k++){
    const row=rows[k],other=rows[k+1];for(let i=0;i<row.length-1;i++)edge(row[i],row[i+1]);
    if(!other||sorted[k+1].angle-sorted[k].angle>.65)continue;
    for(let i=0;i<row.length;i++){const j=Math.round(i*(other.length-1)/(row.length-1));edge(row[i],other[j]);
      if(j)edge(row[i],other[j-1]);if(j+1<other.length)edge(row[i],other[j+1]);}
  }
  const limit=new Float64Array(edges.length),floor=new Float64Array(edges.length);
  return (support:(p:Vector3)=>void)=>{
    for(const a of all)a.target.copy(a.p);
    for(let i=0;i<edges.length;i++){const {a,b,rest}=edges[i],measured=a.raw.distanceTo(b.raw);
      limit[i]=Math.max(rest*1.10,measured*1.05);floor[i]=Math.min(rest*.85,measured*.91);}
    for(let pass=0;pass<12;pass++){
      for(let j=0;j<edges.length;j++){const i=pass%2?edges.length-1-j:j,{a,b}=edges[i];dx.subVectors(b.p,a.p);const len=dx.length();
        if(len<=1e-7||len<=limit[i]&&len>=floor[i])continue;
        dx.multiplyScalar((len-Math.min(limit[i],Math.max(floor[i],len)))/(len*(a.weight+b.weight)));
        if(a.weight)a.p.add(dx);if(b.weight)b.p.sub(dx);}
      for(const a of all)if(a.weight){a.p.lerp(a.target,.025);support(a.p);}
    }
  };
}
