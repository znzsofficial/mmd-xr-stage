import type Rapier from '@dimforge/rapier3d-compat';
import type {World} from '@dimforge/rapier3d-compat';
import {PAD_RADIUS,PLANET_RADIUS} from '../scenery/planet/planetLayout';
import {makeCrust,stations} from '../scenery/planet/opalTerrain';
import {homeFixtureBoxes} from './planetFixtures';

/** A single invisible fixed body in world coordinates. Also used by the native
 * CPU check, so the measured walk sees the same crust, pad and instruments. */
export function addHomeTerrainSolids(rapier:typeof Rapier,world:World){
  const fixed=world.createRigidBody(rapier.RigidBodyDesc.fixed()),C=rapier.ColliderDesc;
  const g=makeCrust(false);
  world.createCollider(C.trimesh(g.attributes.position.array as Float32Array,Uint32Array.from(g.index!.array)).setTranslation(0,-PLANET_RADIUS,0),fixed);
  g.dispose();
  world.createCollider(C.cylinder(.17,PAD_RADIUS).setTranslation(0,-.17,0),fixed);
  for(const s of stations){const centre=s.base.clone().addScaledVector(s.up,(s.height-.16)/2);
    world.createCollider(C.cylinder((s.height+.16)/2,s.r).setTranslation(centre.x,centre.y,centre.z).setRotation(s.rotation),fixed);}
  for(const {half,center,rotation} of homeFixtureBoxes){
    world.createCollider(C.cuboid(half.x,half.y,half.z).setTranslation(center.x,center.y,center.z).setRotation(rotation),fixed);}
  return fixed;
}
