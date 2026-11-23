import {Vector3} from 'three';
import {HOME_SURFACE_GRAVITY,PLANET_RADIUS} from '../scenery/planet/planetLayout';

// Ground motors need their reference values without loading the moon atlas.
export const ROOM_GRAVITY=9.81;
export const homeWorld={id:'home',radius:PLANET_RADIUS,centre:new Vector3(0,-PLANET_RADIUS,0),surfaceGravity:HOME_SURFACE_GRAVITY} as const;
