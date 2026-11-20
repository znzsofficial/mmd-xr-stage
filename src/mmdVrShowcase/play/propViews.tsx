// Rendering entry points only. The catalog checks these export names at compile
// time; importing a store, HUD label or guide must never load a station renderer.
import { AstralSaber } from './AstralSaber';
import { MoonPost } from './MoonPost';
import { EncoreMic } from './encore/EncoreMic';
import { EncoreStation } from './encore/EncoreStation';
import { FerryStation } from './ferry/FerryStation';
import { KiteReel, MeadowStation } from './kite/KiteStation';
import { BubbleStream, LiquidSpray, StampAim } from './heldEffects';
import {siliconeOutlet} from './siliconeProfile';
import { BubblePiece, SiliconePiece, StampPiece } from './simplePieces';
import type { PropView } from './propView';

export const meadowReel:PropView = {Piece:KiteReel, Station:MeadowStation};
export const ribbonMic:PropView = {Piece:EncoreMic, Station:EncoreStation};
export const shellBlower:PropView = {Piece:BubblePiece, HeldEffect:BubbleStream, Station:FerryStation};
export const lunarPunch:PropView = {Piece:StampPiece, HeldEffect:StampAim, Station:MoonPost};
export const astralHilt:PropView = {Piece:AstralSaber};
export const silicone:PropView = {Piece:SiliconePiece,HeldEffect:LiquidSpray,outlet:siliconeOutlet};
