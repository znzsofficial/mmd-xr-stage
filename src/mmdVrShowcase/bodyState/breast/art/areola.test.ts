import {expect,it} from 'vitest';
import {camera} from './geometry';
import {portraitY,RASTER_HEIGHT as H,RASTER_SCALE as S,RASTER_WIDTH as W} from './raster';
import {height,middle} from './teardrop';
import {paintTeardrop} from './teardropPaint';
import type {AreolaStyle} from './areola';

// Read the real unadorned skin pass, before optional labels or contours.
// With pigment alone the two outermost occupied pixels would match even
// though a front-facing RGB comparison would report a large change.
it.each([0,1])('moves the actual profile edge locally at fullness %i, retaining the rest of 02',full=>{
  const render=(style:AreolaStyle)=>{
    const rgba=new Uint8ClampedArray(W*H*4),depth=new Float32Array(W*H).fill(-1e4);
    paintTeardrop(rgba,depth,camera(90),full,full,0,0,null,style);
    return (y:number)=>{
      const start=Math.round(portraitY(y,0)*S)*W;
      for(let x=0;x<W;x++)if(rgba[(start+x)*4+3])return x;
      throw Error(`No visible skin at ${y}`);
    };
  };
  const soft=render('soft'),raised=render('rounded'),at=(h:number)=>middle(full)+height(full)*h;
  expect(soft(at(-.39))-raised(at(-.39))).toBeGreaterThanOrEqual(4);
  for(const h of [-.85,-.70,0,.32])expect(raised(at(h))).toBe(soft(at(h)));
});
