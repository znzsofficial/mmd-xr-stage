import {DistantSystem} from './sky/DistantSystem';
import {StarCatalogue} from './sky/StarCatalogue';
import {TidalNebula} from './sky/TidalNebula';
import {Pulsar} from './sky/Pulsar';
import {useLayoutEffect} from 'react';
import {RepeatWrapping} from 'three';
import {useBakedSurface} from '../useBakedSurface';
import fields from './sky/tidal-cloud-fields.webp';

/** Sky layers render before opaque stage scenery. The group shares neither
 * the locomotion origin nor the collidable room root. */
export function PlanetSky(){
  const map=useBakedSurface(fields,'data');
  useLayoutEffect(()=>{if(map){map.wrapS=RepeatWrapping;map.needsUpdate=true;}},[map]);
  return <group name="planet:winter-arm" renderOrder={-1000} pointerEvents="none">
    <TidalNebula map={map}/><StarCatalogue dust={map}/><Pulsar/><DistantSystem/>
  </group>;
}
