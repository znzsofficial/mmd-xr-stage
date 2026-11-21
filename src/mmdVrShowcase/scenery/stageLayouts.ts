// Surveyed dimensions shared by the simple plinth and Live House renderers
// and their ground rules. Distances in metres; the audience faces -Z.
export const SIMPLE_FLOOR_RADIUS = 8;
export const LIVE_DECK_SIZE = 11.6;
export const WEDGES = [-1,1].map(side => ({ x: side*2.85, z: 2.4, w: .78, d: .56, yaw: -side*.28 }));
export const BACKLINE = { drums:{x:-2.72,z:-4.52,w:2.05,d:1.32}, keys:{x:3.18,z:-4.34,w:1.63,d:.76} };
