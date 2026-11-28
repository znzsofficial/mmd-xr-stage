import {useSyncExternalStore} from 'react';
import {RepeatWrapping, SRGBColorSpace, TextureLoader, type Texture} from 'three';
import timber from './waiting-bay.webp';
import bark from './park/zelkova-bark.webp';
import sprays from './park/zelkova-sprays.webp';
import leafShade from './park/zelkova-shade.webp';

// Share only these immutable scenery prints. A cropped blackboard, a player
// texture, and a data map have different sampler/ownership contracts.
export function coastalPrint(url:string, repeat=false) {
  const subscribers=new Set<()=>void>();
  let loading:Texture|null=null, ready:Texture|null=null;
  return {
    snapshot:()=>ready,
    subscribe(notify:()=>void) {
      subscribers.add(notify);
      if (!loading) {
        const map=new TextureLoader().load(url, texture=>{
          if(loading!==texture)return; // an abandoned request finished after re-entry
          ready=texture;
          for(const publish of subscribers)publish();
        },undefined,()=>{
          if(loading===map){loading=null;map.dispose();}
        });
        map.colorSpace=SRGBColorSpace;map.anisotropy=4;
        if(repeat)map.wrapS=map.wrapT=RepeatWrapping;
        loading=map;
      }
      return ()=>{
        subscribers.delete(notify);
        if(!subscribers.size){ready=null;loading?.dispose();loading=null;}
      };
    },
  };
}

const prints={
  shops:coastalPrint('/scenery/terminus/park-shops.webp'),
  paving:coastalPrint('/scenery/terminus/park-paving.webp',true),
  timber:coastalPrint(timber), bark:coastalPrint(bark,true),
  sprays:coastalPrint(sprays), leafShade:coastalPrint(leafShade),
};

export function useCoastalPrint(key:keyof typeof prints){
  const print=prints[key];
  return useSyncExternalStore(print.subscribe,print.snapshot,()=>null);
}
