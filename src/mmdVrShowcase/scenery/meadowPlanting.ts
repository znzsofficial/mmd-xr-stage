import { seededRandom } from './ClassroomLayout';
import { lawnPaving } from './CampusLayout';
import { inLidoApproach } from './LidoLayout';
import { reserveLawnClinic } from './clinic/clinicApproach';

// Keep the two consecutive draws from the same seed: rendered landscaping
// and actor exclusions must agree even at the ends of the borrowed scenery.
const random = seededRandom(11281);
function clearPath(x: number, z: number, margin: number) {
  return !inLidoApproach(x,z,margin) && !reserveLawnClinic(x,z,margin) && !lawnPaving(x,z,margin);
}
export const LAWN_KNOLLS = Array.from({ length: 58 }, () => {
  const x = random() * 54 - 27, z = random() * 54 - 27;
  if (Math.hypot(x, z) < 9) return [];
  return [{ x, z, w: 3 + random() * 6, h: .6 + random() * 1.4,
    d: 2 + random() * 4, yaw: random() * 3 }];
}).flat().filter(k => clearPath(k.x,k.z,Math.max(k.w,k.d)*.65));
export const LAWN_TREES = Array.from({ length: 19 }, (_, i) => {
  const a = i * 2.399, r = 11 + random() * 12;
  return { x: Math.cos(a) * r, z: Math.sin(a) * r, h: 3.3 + 2.2 * random() };
}).concat([{x:5.75,z:-5.2,h:5.6},{x:-6.2,z:-9.4,h:4.4}]).filter(t => clearPath(t.x,t.z,t.h*.42));
