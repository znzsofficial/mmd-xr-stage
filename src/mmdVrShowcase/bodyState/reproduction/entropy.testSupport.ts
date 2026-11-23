import {vi} from 'vitest';

// One word per newly opened test book. Unexpected re-seeding fails the test.
export function mockGameEntropy(...words:number[]){
  return vi.spyOn(crypto,'getRandomValues').mockImplementation(array=>{
    const word=words.shift();if(word===undefined||!(array instanceof Uint32Array)||array.length!==4)throw new Error('Unexpected game seed draw');
    array.set([0,0,0,word]);return array;
  });
}
