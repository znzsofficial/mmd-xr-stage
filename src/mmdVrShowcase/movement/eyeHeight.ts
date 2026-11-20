export const headMargin=.095;
/** Limit the *virtual adjustment* in a tight space. Never counteract a real
 * tracked movement, or fold a jump, step or free-flight altitude into it. */
export function eyeLift(requested:number,tracked:number,headroom=Infinity){
  return requested<0?Math.max(requested,Math.min(0,headMargin-tracked)):
    Math.min(requested,Math.max(0,headroom-tracked-headMargin));
}
