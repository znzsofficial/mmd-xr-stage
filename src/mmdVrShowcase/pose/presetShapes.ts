import type { PosePresetId } from './presetCatalog';

// Directions, not joint angles or metre positions. Axes: actor-left, floor-up,
// actor-forward. The solver fits these to this skeleton's measured bind basis.
export type Direction = readonly [number, number, number];
type Pair = readonly [Direction, Direction];
type Shape = {
  trunk: Pair; // direction towards head, direction out of chest
  headPitch: number; // degrees about anatomical left, relative to the trunk
  headTurn?: number; // degrees about the trunk's headward axis
  pelvisTuck?: number; // roll up from the hips, keeping the shoulder blades down
  leg: Pair; arm: Pair; // base→middle, middle→end; X mirrors for the right side
  rightLeg?: Pair; rightArm?: Pair; // asymmetric poses: literal, unmirrored
  foot: Pair; palm?: Pair; // toes/fingers and dorsal normal; in stage axes
  hold?: { segment:'thigh'|'shin'; fraction:number; normal:Direction; elbow:Direction; leftOnly?:boolean };
  support: 'back' | 'knees' | 'feet' | 'side' | 'front' | 'seat';
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
  thighCradle: {
    trunk:[[0,.095,-1],[0,1,.095]], headPitch:13, support:'back',
    leg:[[.58,.49,-.74],[.18,.68,.71]], arm:[[.82,.18,.55],[-.42,.80,-.43]],
    foot:[[.25,.70,.66],[0,-.68,.73]],
    hold:{segment:'thigh',fraction:.72,normal:[-1,.17,-.15],elbow:[.84,.03,.50]},
  },
  forearmKneel: {
    trunk:[[0,-.46,.89],[0,-.89,-.46]], headPitch:-47, support:'knees',
    leg:[[.37,-.91,.16],[.08,0,-1]], arm:[[.36,-.71,.60],[-.13,0,1]],
    foot:[[.09,0,-1],[0,-1,0]], palm:[[-.15,0,1],[0,1,0]],
  },
  sideLegLift: {
    trunk:[[0,.055,-1],[-1,0,0]], headPitch:5, support:'side',
    leg:[[-.36,.84,.41],[.13,.49,.86]], rightLeg:[[-.11,-.095,1],[.07,-.035,1]],
    arm:[[-.80,.12,.59],[.53,.37,.76]], rightArm:[[-.79,.07,-.61],[.72,.14,-.68]],
    foot:[[-.30,.10,.95],[0,1,0]],
    hold:{segment:'thigh',fraction:.54,normal:[-.91,.36,-.16],elbow:[-.84,.12,-.52],leftOnly:true},
  },
  coveredKneel: {
    trunk:[[0,.94,-.34],[0,.34,.94]], headPitch:16, support:'knees',
    leg:[[.53,-.31,.79],[-.27,0,-.96]], arm:[[.54,-.72,.43],[-.92,.34,.14]],
    foot:[[.12,0,-1],[0,-1,0]],
  },
  matingPress: {
    trunk:[[0,-.06,-1],[0,1,-.06]], pelvisTuck:36, headPitch:6, support:'back',
    leg:[[.35,.32,-.88],[.18,.36,.91]], arm:[[.85,.17,.50],[-.38,.84,-.39]],
    foot:[[.15,.09,1],[0,1,-.09]],
    hold:{segment:'shin',fraction:.25,normal:[1,.15,0],elbow:[.84,.03,.50]},
  },
  proneKneeOut: {
    trunk:[[0,.04,1],[0,-1,.04]], headPitch:-8, headTurn:60, support:'front',
    leg:[[.91,-.06,.41],[-.17,.04,-.98]], rightLeg:[[-.12,-.06,-.99],[.02,.05,-1]],
    arm:[[.88,-.18,-.43],[-.18,-.12,.98]],
    foot:[[.08,-.04,-1],[0,-1,.04]], palm:[[-.25,0,.97],[0,1,0]],
  },
  bracedSeat: {
    trunk:[[0,.73,-.68],[0,.68,.73]], headPitch:25, support:'seat',
    leg:[[.72,.27,.63],[.44,-.34,.83]], arm:[[.23,-.88,-.42],[-.08,-.98,.17]],
    foot:[[.38,.86,.33],[.25,.24,-.94]], palm:[[.48,0,-.88],[0,1,0]],
  },
};
