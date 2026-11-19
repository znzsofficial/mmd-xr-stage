import {useBackpack} from '../backpack';
import {useMmdVrStore} from '../mmdVrStore';
import {otherZone,type CampusRoom} from './CampusLayout';
import ground from './meadow-walk.webp';
import flowers from './garden-botanicals.webp';
import timber from './garden-joinery.webp';

// Let the normal room-generation boundary take a complete snapshot before it
// tears down actors and Bullet. Do not walk out of a half-restored room.
export function canWalkBetweenZones(room:CampusRoom){
  const s=useMmdVrStore.getState(),b=useBackpack.getState();
  return s.overlayOpen&&s.prefs.scenery===room&&!s.physicsBusy&&!s.physicsFatal&&!s.assetLoad.running&&!s.assetLoad.failures.length&&!s.placeMode&&!b.busy&&!b.command&&!b.draft;
}
export function walkBetweenZones(room:CampusRoom){
  if(!canWalkBetweenZones(room))return false;
  useMmdVrStore.getState().setPrefs({scenery:otherZone(room)});return true;
}

/** Start only when approaching the rear door. Same URL/credentials as the
 * room texture loader. No second canvas, GPU texture or hidden garden. */
export function hintLawnPrints(){
  const links=[ground,flowers,timber].map(url=>{const l=document.createElement('link');l.rel='preload';l.as='image';l.crossOrigin='anonymous';l.href=url;document.head.appendChild(l);return l;});
  return ()=>links.forEach(l=>l.remove());
}
