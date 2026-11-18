// All distances in metres; front of the class is -Z. The gaps between the
// paired desks, the window wall and the entrance are intentional standing space.
export interface Footprint { x: number; z: number; w: number; d: number; yaw?: number }
export const ROOM = { w: 10.8, d: 11.2, h: 3.46, sill: .86, transom: 2.64, lintel: 3.13, bays: 5 };
export const CLASS_SUN: [number, number, number] = [-6, 3.5, -2];
export const WINDOWS = Array.from({ length: ROOM.bays }, (_, i) => {
  const width = ROOM.d / ROOM.bays;
  return { z: -ROOM.d / 2 + (i + .5) * width, width };
});

export const STUDENTS = [-3.07, -1.17, .73, 2.63].flatMap((z, row) =>
  [-3.18, -2.25, 2.05, 2.98].map((x, col) => {
    const i = row * 4 + col;
    const desk: Footprint = { x, z: z + (col > 1 ? .14 : 0), w: .86, d: .56 };
    const chair: Footprint = { x: x + Math.sin(i * 2.3) * .072, z: desk.z + .51 + (i % 3) * .054,
      w: .47, d: .51, yaw: Math.sin(i * 1.63) * .17 };
    return { desk, chair, i };
  }));
export const LECTERN: Footprint = { x: -2.45, z: -4.62, w: 1.64, d: .65 };
export const BOOKCASE: Footprint = { x: 3.89, z: -5.21, w: 2.08, d: .53 };
export const REAR_CASE: Footprint = { x: -.8, z: 5.26, w: 3.22, d: .50 };
export const CHALK_TRAY: Footprint = {x: -.70, z: -ROOM.d/2+.19, w: 6.02, d: .23};
export const DOOR_CENTERS = [-3.68,3.54];
export const CLASS_FIXTURES = [LECTERN, BOOKCASE, REAR_CASE, ...STUDENTS.flatMap(s => [s.desk, s.chair])];
export const CLASS_OBSTACLES = [...CLASS_FIXTURES, CHALK_TRAY,
  ...WINDOWS.map(({z,width}) => ({x: -ROOM.w/2+.15, z: z-width/2+.42, w:.31, d:.80})),
  ...DOOR_CENTERS.map(z => ({x:ROOM.w/2-.10,z,w:.20,d:1.51})),
];

export function seededRandom(seed: number) {
  return () => ((seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296);
}
