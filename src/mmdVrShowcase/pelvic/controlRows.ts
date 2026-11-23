export type Localize = (zh:string,en:string)=>string;
export type Key = {label:string; press:()=>void; id?:string; active?:boolean; disabled?:boolean; danger?:boolean; primary?:boolean; stop?:boolean; pressToken?:number};
export type Row = {kind:'buttons';keys:Key[];label?:string}|{kind:'note';text:string;warn?:boolean}|{kind:'strokeReading'}|
  {kind:'choose';label:string;names:readonly string[];chosen:string|null;none:string;pick:(name:string|null)=>void}|
  {kind:'field';label:string;value:number;unit:string;range:readonly [number,number];step:number;change:(n:number)=>void;disabled:boolean};
export const buttons=(...keys:Key[]):Row=>({kind:'buttons',keys});
export const note=(text:string,warn=false):Row=>({kind:'note',text,warn});
export const key=(label:string,press:()=>void,options:Omit<Partial<Key>,'label'|'press'>={}):Key=>({label,press,...options});
export const field=(label:string,value:number,unit:string,range:readonly [number,number],step:number,change:(n:number)=>void,disabled=false):Row=>
  ({kind:'field',label,value,unit,range,step,change,disabled});
export const percentRange=([a,b]:readonly [number,number])=>[a*100,b*100] as const;
