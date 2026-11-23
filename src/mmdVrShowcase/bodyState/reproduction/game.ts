/** A fictional, discrete game clock. Drawing, VMD time, balance changes and
 * the body editor's reversible calendar are deliberately not inputs. */
import type {BodyProfile} from '../data';

type Rhythm=Pick<BodyProfile,'length'|'peakDays'|'lutealDays'|'ovulation'>;
type Trial={day:number;chance:number;fertilized:boolean;implants:boolean};
export type GameStage='waiting'|'anovulatory'|'unobserved'|'ovulated'|'expired'|'unfertilized'|'fertilized'|'transit'|'cavity'|'notImplanted'|'pregnant'|'complete';
export type ReproductionGame={seed:string;day:number;round:number;start:number;length:number;release:number|null;
  eggs:number;side:-1|1;trial:Trial|null;lastDoseDay:number|null};
export const TERM_DAYS=280;
const CAVITY=4,IMPLANT=6;

// Independent keyed draws: moving a camera, repeating a dose, re-entering a
// room, or turning the feature off and on cannot consume new random numbers.
function draw(seed:string,round:number,purpose:string){
  let h=0x811c9dc5;for(const ch of `${seed}:${round}:${purpose}`)h=Math.imul(h^ch.charCodeAt(0),0x01000193);
  h=Math.imul(h^(h>>>16),0x85ebca6b);h=Math.imul(h^(h>>>13),0xc2b2ae35);return ((h^(h>>>16))>>>0)/0x100000000;
}
function roundAt(seed:string,start:number,round:number,p:Rhythm):ReproductionGame{
  const release=p.ovulation?start+p.length-p.lutealDays-1-Math.floor(p.peakDays/2):null;
  return {seed,day:start,round,start,length:p.length,release,eggs:0,side:draw(seed,round,'side')<.5?-1:1,trial:null,lastDoseDay:null};
}
const releaseCount=(g:ReproductionGame)=>draw(g.seed,g.round,'eggs')<.20?2:1;
export function startGame(seed:string,p:Rhythm & Pick<BodyProfile,'day'>){
  const g=roundAt(seed,1,1,p);
  // A first opt-in opens the book on the committed date. Starting on the
  // release day can produce today's egg; no prior event is ever reconstructed.
  return {...g,day:p.day,eggs:p.day===g.release?releaseCount(g):0};
}
export function stageOf(g:ReproductionGame):GameStage{
  if(g.trial){const t=g.trial,age=g.day-t.day;
    if(!t.fertilized)return 'unfertilized';
    if(age===0)return 'fertilized';if(age<CAVITY)return 'transit';if(age<IMPLANT)return 'cavity';
    return !t.implants?'notImplanted':age+1>=TERM_DAYS?'complete':'pregnant';
  }
  if(g.release===null)return 'anovulatory';
  if(g.eggs===0)return g.day>g.release?'unobserved':'waiting';return g.day-g.release<=1?'ovulated':'expired';
}
function windowChance(g:ReproductionGame){
  if(!g.eggs||g.release===null)return 0;
  return g.day===g.release?60:g.day===g.release+1?48:0;
}

/** One confirmed, positive retained internal delivery. Only the first such
 * dose in the two-day window resolves this cohort, even after a failed roll.
 * A single roll partitions into no fertilization, failed implantation, or
 * implantation. No pregnancy is reported before the sixth elapsed game day. */
export function receiveDose(g:ReproductionGame):ReproductionGame{
  if(g.trial)return g;
  if(stageOf(g)!=='ovulated')return g.lastDoseDay===g.day?g:{...g,lastDoseDay:g.day};
  const chance=windowChance(g),fertilization=chance===60 ? .80 : .64;
  const result=draw(g.seed,g.round,'outcome');
  return {...g,lastDoseDay:g.day,trial:{day:g.day,chance,fertilized:result<fertilization,implants:result<chance/100}};
}

export function progressDays(g:ReproductionGame,days:number,nextRhythm:Rhythm){
  if(!Number.isSafeInteger(days)||days<=0)return g;
  for(let i=0;i<days;i++){
    const stage=stageOf(g);if(stage==='complete')break;
    const day=g.day+1;
    // Finish even a late cohort before starting the next cycle. Reveal a
    // failed implantation for at least one day. Gestation suspends ovulation.
    if(day>=g.start+g.length&&!(g.trial?.fertilized&&stage!=='notImplanted')){
      g=roundAt(g.seed,day,g.round+1,nextRhythm);continue;
    }
    g={...g,day,eggs:day===g.release?releaseCount(g):g.eggs};
  }
  return g;
}

/** Stop on playable milestones rather than skipping the opening or silently
 * dropping an unobserved implantation result. This never issues a dose. */
export function nextMilestone(g:ReproductionGame){
  const stage=stageOf(g);
  if(stage==='complete')return {key:'end',days:0} as const;
  if(stage==='waiting')return {key:'release',days:g.release!-g.day} as const;
  if(stage==='ovulated'||stage==='fertilized')return {key:'day',days:1} as const;
  if(stage==='transit')return {key:g.day===g.trial!.day+1?'four':g.day===g.trial!.day+2?'eight':'cavity',days:1} as const;
  if(stage==='cavity')return {key:'implant',days:g.trial!.day+IMPLANT-g.day} as const;
  if(stage==='pregnant')return {key:'weeks',days:Math.min(28,TERM_DAYS-1-g.day+g.trial!.day)} as const;
  return {key:'round',days:Math.max(1,g.start+g.length-g.day)} as const;
}

/** Small, serializable, present-tense snapshot shared by both organ views.
 * The future implantation result is never sent to the illustrator. */
export function reproductiveSample(g:ReproductionGame){
  const stage=stageOf(g),fertilized=!!g.trial?.fertilized,implanted=stage==='pregnant'||stage==='complete';
  const age=fertilized?g.day-g.trial!.day:0;
  return {stage,eggs:g.eggs,side:g.side,fertilized,implanted,gestation:implanted?age+1:0,
    cells:stage==='transit'?2**age:0,secondOvum:g.eggs===2&&g.release!==null&&g.day<=g.release+1,
    travel:Math.min(1,age/CAVITY),chance:g.trial?.chance??windowChance(g),tried:!!g.trial,exposed:g.lastDoseDay!==null,round:g.round,day:g.day};
}
export type ReproductiveSample=ReturnType<typeof reproductiveSample>;
