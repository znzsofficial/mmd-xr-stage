import {lowerPad,UPPER} from './arcadeLayout';

export const arcadeView={entry:[[.28,3.16,12.64],[0,3.33,4.36]],shots:[
  {key:'arcHallReturn',eye:[0,1.58,-1.30],aim:[0,1.46,4.65]},
  {key:'arcLowerPad',eye:[lowerPad.x,1.65,lowerPad.z],aim:[5.83,2.18,-.68]},
  {key:'arcUpperEntry',eye:[0,UPPER+1.58,5.86],aim:[0,UPPER+.87,-1.66]},
  {key:'arcEastEnd',eye:[4.88,UPPER+1.58,.54],aim:[-6.72,UPPER+.77,-.43]},
  {key:'arcWestEnd',eye:[-4.91,UPPER+1.58,.73],aim:[6.76,UPPER+.87,-.18]},
  {key:'arcWood',eye:[4.44,UPPER+1.52,-3.24],aim:[-.55,UPPER+.65,-1.92]},
  {key:'arcLounge',eye:[-7.67,1.62,3.34],aim:[-13.44,1.62,-1.10]},
  {key:'arcGraffiti',eye:[6.18,3.29,11.67],aim:[9.61,2.41,4.17]},
  {key:'arcSky',eye:[-.52,1.60,.37],aim:[-.41,6.66,-.40]},
  {key:'arcDown',eye:[.11,UPPER+1.89,-1.98],aim:[.08,.48,1.39]},
  {key:'arcLowEast',eye:[6.92,1.66,.91],aim:[-6.25,1.72,-1.04]},
  {key:'arcLowWest',eye:[-6.96,1.67,.05],aim:[6.80,1.51,.77]},
  {key:'arcGlass',eye:[12.01,1.60,-3.76],aim:[11.53,1.38,1.32]},
  {key:'arcEastCourt',eye:[-8.08,UPPER+1.48,3.61],aim:[-12.41,.85,-.75]},
]} as const;
