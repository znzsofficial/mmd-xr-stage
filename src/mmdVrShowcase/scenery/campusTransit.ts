import {useBackpack} from '../backpack';
import {useMmdVrStore} from '../mmdVrStore';
import type {RoomLink} from './connections';
import ground from './meadow-walk.webp';
import flowers from './garden-botanicals.webp';
import timber from './garden-joinery.webp';

// Let the normal room-generation boundary take a complete snapshot before it
// tears down actors and Bullet. Do not walk out of a half-restored room.
export function canWalkBetweenZones(room:RoomLink['from']){
  const s=useMmdVrStore.getState(),b=useBackpack.getState();
  return s.overlayOpen&&s.prefs.scenery===room&&!s.physicsBusy&&!s.physicsFatal&&!s.assetLoad.running&&!s.assetLoad.failures.length&&!b.busy&&!b.command&&!b.draft;
}
export function walkBetweenZones(link:RoomLink){
  if(!canWalkBetweenZones(link.from))return false;
  // The gate already translates the XR origin into destination coordinates.
  // A fresh entrance pose here would undo that translation on the next frame.
  useMmdVrStore.getState().setPrefs({scenery:link.to},{preserveViewOnCrossing:true});return true;
}

/** Start only when approaching the rear door. Same URL/credentials as the
 * room texture loader. No second canvas, GPU texture or hidden garden. */
export function hintLawnPrints(){
  const links=[ground,flowers,timber].map(url=>{const l=document.createElement('link');l.rel='preload';l.as='image';l.crossOrigin='anonymous';l.href=url;document.head.appendChild(l);return l;});
  return ()=>links.forEach(l=>l.remove());
}
