import {activeGame,useReproduction} from '../bodyState/reproduction/store';
import {reproductiveSample} from '../bodyState/reproduction/game';
import {reproductionReadings} from '../bodyState/reproduction/readings';
import {PrivateLine} from '../pelvic/HudPrivateControls';

export function useUterusRecord(id:string,uterus:boolean,zh:boolean){
  const g=useReproduction(s=>uterus?activeGame(id,s):undefined);
  return g?reproductionReadings(reproductiveSample(g),zh):null;
}
type RecordProps={record:ReturnType<typeof reproductionReadings>};
export function ScreenReproductionReadouts({record:r}:RecordProps){
  return <dl className="uterus-record">{[r.eggs,r.chance,r.progress].map(v=><div key={v.label}><dt>{v.label}</dt><dd>{v.value}</dd></div>)}</dl>;
}
/** Two fixed baselines: the stage wording is replaced in place by gestation. */
export function HudReproductionReadouts({record:r,width:w}:RecordProps&{width:number}){
  return <group name="observation:reproductive-record">
    <PrivateLine position={[0,0,0]} width={w} text={`${r.eggs.label} ${r.eggs.value}`} value={`${r.chance.label} ${r.chance.value}`}/>
    <PrivateLine position={[0,-.097,0]} width={w} text={r.progress.label} value={r.progress.value}/>
  </group>;
}
