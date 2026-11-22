# Stage HUD · screen and XR

Mode: Operate. Targets: `screen/ScreenStage.tsx` and `components/MmdVrHud.tsx` under `src/mmdVrShowcase/`. The viewer uses a mouse, touch or Quest controllers to choose an actor, make an adjustment and return to watching.

## Direction contract

THESIS: Opening the backpack or playback settings should feel like turning to another page of the same adult visual novel as the actor's tools.

OWN-WORLD: Deep plum paper, ivory text, old-gold rules, a wine-coloured selected field. A Mincho or Song-style face identifies headings; measurements and actions stay in a clear sans. Use `pelvic/palette.ts` for both the browser and the headset.

STORY: Pick a character, choose clothing, interaction or observation, then fold the sheet. Pose, body settings, music and common controls use the same cues for selection, focus, danger and unavailability.

FIRST VIEWPORT: On screen, scene selector above the picture, transport below, tools at the side. In XR, the compact watch strip opens a room menu; actor actions appear beside the selected character. Keep targets, anchors and controller release behaviour intact.

FORM: seed: none (pinned). “所有 tab 统一，不能一页现代、一页成人游戏。” The existing actor workbench is the reference. The preparation studio and the light on the actors belong to their own worlds.

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance. Record screen and headset evidence separately.
