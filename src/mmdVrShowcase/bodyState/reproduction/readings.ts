import type {GameStage,ReproductiveSample} from './game';

const stages:Record<GameStage,readonly [string,string]>={
  waiting:['尚未排卵','Before ovulation'],anovulatory:['本轮不排卵','No ovulation this cycle'],unobserved:['本轮未记录排卵','No release recorded'],ovulated:['已排卵','Ovulated'],
  expired:['卵子已失活','Egg window closed'],unfertilized:['本轮未受精','Fertilization failed'],fertilized:['输卵管内受精','Fertilized in tube'],
  transit:['向宫腔移动','Moving along tube'],cavity:['已抵宫腔，待着床','In cavity · not implanted'],notImplanted:['未能着床','Implantation failed'],
  pregnant:['已着床','Implanted'],complete:['模拟孕期完成','Game gestation complete'],
};
export function stageLabel(s:ReproductiveSample|undefined,zh:boolean){
  if(!s)return zh?'生育模拟未开启':'Simulation off';
  if(s.exposed&&!s.chance&&s.stage!=='ovulated')return zh?'窗口外剂量 · 未受精':'Dose outside window';
  return stages[s.stage][zh?0:1];
}
export function reproductionReadings(s:ReproductiveSample,zh:boolean){
  const n=s.eggs,d=s.gestation;
  const progress=d?(zh?`${s.stage==='complete'?'孕期完成':'已着床'} · 孕日 ${d} / ${Math.floor(d/7)}周${d%7}天`:`${s.stage==='complete'?'Complete':'Implanted'} · Day ${d} / ${Math.floor(d/7)}w ${d%7}d`):
    s.stage==='fertilized'?(s.eggs===2?(zh?'2 枚中 1 枚受精 · 待着床':'1 of 2 fertilized · not implanted'):(zh?'已受精 · 尚未着床':'Fertilized · not implanted')):
    s.stage==='ovulated'?(zh?'已排卵 · 尚未受精':'Ovulated · not fertilized'):
    stageLabel(s,zh);
  return {
    eggs:{label:zh?'本次排卵':'Eggs ovulated',value:zh?`${n} 枚`:String(n)},
    chance:{label:zh?(s.tried?'该次受孕率':'下剂受孕率'):s.tried?'Trial chance':'Dose chance',value:zh?`${s.chance}%（游戏）`:`${s.chance}% (game)`},
    progress:{label:zh?`生育日 ${s.day}`:`Game day ${s.day}`,value:progress},
  };
}
