import {lanternViews} from './lanternBiosphere';
import {clearingDeck} from './lanternClearing';

// Look back from the outer slope: two grove crowns hold the sides while the
// mother cap sits behind the performer's right shoulder. World up like the deck.
const {x,y,z}=clearingDeck;
export const lanternShots=[
  {key:'lanternGlobe',...lanternViews.globe},
  {key:'lanternGills',...lanternViews.grove},
  {key:'lanternNursery',...lanternViews.nursery},
  {key:'lanternClearingView',eye:[x+1.93,y+1.53,z+3.40],aim:[x,y+.94,z]},
] as const;
