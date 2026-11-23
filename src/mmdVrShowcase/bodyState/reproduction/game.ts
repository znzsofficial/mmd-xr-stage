/** One delivered dose, resolved at the game odds in force on that frame. */
export type ConceptionEvent = Readonly<{
  id:number; chance:number; success:boolean; at:number; side:-1|1;
  target?:'vaginal'|'fantasyUterine';
}>;

export const DEFAULT_CHANCE=60;

export function resolveConception(id:number,chance:number,side:-1|1,target?:ConceptionEvent['target']):ConceptionEvent {
  const success=chance===100 || (chance>0 && Math.random()<chance/100);
  return {id,chance,success,at:performance.now(),side,...(target?{target}:{})};
}
