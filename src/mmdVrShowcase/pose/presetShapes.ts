import type { PosePresetId } from './presetCatalog';

// Directions, not joint angles or metre positions. Axes: actor-left, floor-up,
// actor-forward. The solver fits these to this skeleton's measured bind basis.
export type Direction = readonly [number, number, number];
type Pair = readonly [Direction, Direction];
type Shape = {
  trunk: Pair; // direction towards head, direction out of chest
  headPitch: number; // degrees about anatomical left, relative to the trunk
  leg: Pair; arm: Pair; // base→middle, middle→end; X mirrors for the right side
  rightLeg?: Pair; rightArm?: Pair; // asymmetric poses: literal, unmirrored
  foot: Pair; palm?: Pair; // toes/fingers and dorsal normal; in stage axes
  support: 'back' | 'knees' | 'feet' | 'side';
};
export const presetShapes: Record<PosePresetId, Shape> = {
  supine: {
    trunk:[[0,.025,-1],[0,1,.025]], headPitch:7, support:'back',
    leg:[[.46,.82,.38],[.04,-.91,.41]], arm:[[.69,-.03,.72],[.24,.02,.97]],
    foot:[[.15,0,1],[0,1,0]], palm:[[.2,0,1],[0,1,0]],
  },
  legsUp: {
    trunk:[[0,.075,-1],[0,1,.075]], headPitch:12, support:'back',
    leg:[[.45,.83,-.39],[.05,.91,.41]], arm:[[.51,.28,.81],[-.28,.88,.38]],
    foot:[[.14,.37,-1],[0,-1,-.37]],
  },
  allFours: {
    trunk:[[0,.09,1],[0,-1,.09]], headPitch:-27, support:'knees',
    leg:[[.19,-.99,.10],[.08,-.015,-1]], arm:[[.13,-.91,-.26],[-.07,-.92,.38]],
    foot:[[.09,-.07,-1],[0,-1,.07]], palm:[[.075,0,1],[0,1,0]],
  },
  straddle: {
    trunk:[[0,.98,.20],[0,-.20,.98]], headPitch:-6, support:'knees',
    leg:[[.73,-.53,.67],[-.23,.045,-1]], arm:[[.48,-.85,.15],[-.22,-.54,.81]],
    foot:[[.08,0,-1],[0,-1,0]],
  },
  side: {
    trunk:[[0,.045,-1],[-1,0,0]], headPitch:8, support:'side',
    leg:[[-.89,-.08,.48],[.76,-.07,.66]], rightLeg:[[-.52,.035,.86],[.61,.02,.79]],
    arm:[[-.8,-.46,.21],[.39,-.54,-.73]], rightArm:[[-.46,.06,-.88],[-.55,.19,.81]],
    foot:[[-1,0,.12],[-.12,0,-1]],
  },
  standingLean: {
    trunk:[[0,.60,.80],[0,-.80,.60]], headPitch:-23, support:'feet',
    leg:[[.17,-.95,.29],[.085,-.97,-.23]], arm:[[.28,-.87,-.35],[-.17,-.92,.30]],
    foot:[[.15,0,1],[0,1,0]],
  },
};
