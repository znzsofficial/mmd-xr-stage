import {create} from 'zustand';

export type Side='left'|'right';
export type MilkMode=Side|'both';
export type OutletState='ready'|'confirm'|'blocked'|'missing';
export type MilkPanel={assetId:string;runtimeId:string};
type Reading={panel:MilkPanel;room:object;left:OutletState;right:OutletState};
type Hold={panel:MilkPanel;mode:MilkMode;source?:XRInputSource;valid:(frame?:XRFrame)=>boolean;debited:boolean};

// A panel identity lasts only for this visit. A room identity lasts only for
// this renderer/generation. Neither the physical press nor its timing is saved.
export const useMilkInteraction=create<{panel:MilkPanel|null;reading:Reading|null;hold:Hold|null;shortTap:boolean}>(()=>({panel:null,reading:null,hold:null,shortTap:false}));
export function openMilkPanel(panel:MilkPanel){
  useMilkInteraction.setState({panel,reading:null,hold:null,shortTap:false});
  return ()=>{if(useMilkInteraction.getState().panel===panel)useMilkInteraction.setState({panel:null,reading:null,hold:null,shortTap:false});};
}
export function publishOutlets(panel:MilkPanel,room:object,left:OutletState,right:OutletState){
  const s=useMilkInteraction.getState();if(s.panel!==panel)return;
  const p=s.reading;
  if(p?.room===room&&p.left===left&&p.right===right)return;
  // An exposure change never starts a previously blocked stream. The user
  // can see the new result and press again. An unrelated side needn't stop.
  const keep=p?.room===room&&s.hold&&(s.hold.mode==='right'||p.left===left)&&(s.hold.mode==='left'||p.right===right);
  useMilkInteraction.setState({reading:{panel,room,left,right},hold:keep?s.hold:null});
}
export function retireMilkReading(room:object){
  if(useMilkInteraction.getState().reading?.room===room)useMilkInteraction.setState({reading:null,hold:null,shortTap:false});
}
export function pressMilk(panel:MilkPanel,mode:MilkMode,valid:Hold['valid'],source?:XRInputSource){
  const s=useMilkInteraction.getState();if(s.panel!==panel||s.reading?.panel!==panel||s.hold)return null;
  const hold:Hold={panel,mode,valid,source,debited:false};useMilkInteraction.setState({hold,shortTap:false});return hold;
}
export function releaseMilk(hold:Hold|null,physicalRelease=false){
  if(hold&&useMilkInteraction.getState().hold===hold)useMilkInteraction.setState({hold:null,shortTap:physicalRelease&&!hold.debited});
}
