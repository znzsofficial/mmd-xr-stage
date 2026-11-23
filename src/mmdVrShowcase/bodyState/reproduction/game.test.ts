import {afterEach,expect,it,vi} from 'vitest';
import {resolveConception} from './game';

afterEach(()=>vi.restoreAllMocks());

it('resolves the endpoints without randomness or an inferred delivery target',()=>{
  const draw=vi.spyOn(Math,'random');
  expect(resolveConception(1,0,-1)).toMatchObject({chance:0,success:false});
  const certain=resolveConception(2,100,1);
  expect(certain).toMatchObject({chance:100,success:true});
  expect(certain).not.toHaveProperty('target');
  expect(draw).not.toHaveBeenCalled();
});

it.each([.5,37.5,60,99])('uses one strict draw below %s percent',chance=>{
  const threshold=chance/100;
  const draw=vi.spyOn(Math,'random').mockReturnValueOnce(threshold-Number.EPSILON).mockReturnValueOnce(threshold);
  expect(resolveConception(1,chance,-1).success).toBe(true);
  expect(resolveConception(2,chance,1).success).toBe(false);
  expect(draw).toHaveBeenCalledTimes(2);
});
