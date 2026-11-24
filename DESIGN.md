---
name: MMD XR Stage — Stage HUD
description: 深梅紫与旧金; one visual-novel interface for screen and XR viewing.
colors:
  surface: "#291d29"
  inset: "#201820"
  control: "#402d3b"
  raised: "#513849"
  border: "#997852"
  ink: "#fff1df"
  muted: "#d5bcc4"
  primary: "#e4c28b"
  selected: "#6c374e"
  track: "#997852"
  fill: "#d990a3"
  danger: "#ffcfca"
  danger-surface: "#772f40"
  disabled: "#b59faa"
typography:
  title:
    fontFamily: "Yu Mincho, Songti SC, SimSun, Georgia, serif"
    fontSize: "34px"
    fontWeight: 600
  body:
    fontFamily: "system-ui, sans-serif"
    fontSize: "28px"
    fontWeight: 400
  button:
    fontFamily: "system-ui, sans-serif"
    fontSize: "31px"
    fontWeight: 550
  button-active:
    fontFamily: "system-ui, sans-serif"
    fontSize: "31px"
    fontWeight: 650
  label:
    fontFamily: "system-ui, sans-serif"
    fontSize: "28px"
    fontWeight: 500
  value:
    fontFamily: "system-ui, sans-serif"
    fontSize: "30px"
    fontWeight: 650
  centered-label:
    fontFamily: "system-ui, sans-serif"
    fontSize: "30px"
    fontWeight: 600
rounded:
  panel-texture: "32px"
  handle-texture: "18px"
  progress-texture: "16px"
  tab-indicator-texture: "2px"
spacing:
  panel-rule-inset-texture: "40px"
  progress-inset-texture: "16px"
components:
  button:
    backgroundColor: "{colors.control}"
    textColor: "{colors.ink}"
    typography: "{typography.button}"
  button-active:
    backgroundColor: "{colors.selected}"
    textColor: "{colors.primary}"
    typography: "{typography.button-active}"
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.surface}"
    typography: "{typography.button-active}"
  button-quiet:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    typography: "{typography.button}"
  button-tab:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    typography: "{typography.button}"
  button-tab-active:
    backgroundColor: "{colors.selected}"
    textColor: "{colors.primary}"
    typography: "{typography.button-active}"
  button-danger:
    backgroundColor: "{colors.danger-surface}"
    textColor: "{colors.danger}"
    typography: "{typography.button}"
  button-disabled:
    backgroundColor: "{colors.inset}"
    textColor: "{colors.disabled}"
    typography: "{typography.button}"
  panel:
    backgroundColor: "{colors.surface}"
    rounded: "{rounded.panel-texture}"
  value-label:
    textColor: "{colors.muted}"
    typography: "{typography.label}"
  slider:
    backgroundColor: "{colors.track}"
---

# Design System: MMD XR Stage — Stage HUD

## Overview

**深梅紫与旧金.** The player can go from observing a character to changing clothes, editing a pose or adjusting playback without leaving the visual world of the adult visual novel. The actor workbench sets the language for *all* in-session UI: dark plum fields, ivory lettering, thin brass borders and a restrained wine-red selection. Titles use a book face; actions and measurements use sans-serif.

`src/mmdVrShowcase/pelvic/palette.ts` defines the inks, title stack and XR button-state pairs. The screen dialog and XR exit HUD receive its CSS properties at their roots; XR sheets and painted keys sample it directly. See the [surface contract](.impeccable/surfaces/vr-hud.md).

The preparation page retains its **窗光工作室** palette: warm white `#faf9f5`, ink `#192f28` and a deep green launch control `#175948`. The panorama is a static render of the built-in classroom. Stage lighting, skies, scene signage and model materials are independent of HUD colors.

## Colors

Use the same pairs in the actor home, clothing, interaction, body settings, pose, observation, backpack, music, player/environment settings and recovery. The palette's `paper`, `rule` and `gold` map to the frontmatter's `surface`, `border` and `primary`.

- **Read:** ivory text on plum paper; dusty rose secondary labels on paper or a darker inset. The old-gold rule is a divider or outline, not small text.
- **Act:** ordinary buttons have a slightly lighter plum face. Hover raises that face and brightens its edge. A primary action reverses the pair: dark lettering on gold, dark lettering on ivory when hovered.
- **Select:** gold text on wine, plus weight or an underline. Preserve selection when hovered. Disabled takes precedence: muted lettering on a dark inset and no hover tint. Do not fade the entire label into the background.
- **Stop:** pale rose text on burgundy, with a rose edge. Reserve these colors for destructive actions, stopping and critical notices.

An animated anatomical view and its calibrated measurement view use the same actor-local angle. Keep tissue, actual contact and simulated liquid distinct; selection colors are UI, not physical evidence.

**Show what a button did.** Entering an actor tool replaces the backpack list. Start body editing with the chest slider and a reversible preview on the actor. Start rod fitting with one action that places the visible stand outside the opening. Give a blocked action a recovery at the same location (including restoring a hidden clothing material). Use “inside” only after a measured crossing; a mounted or stopped rod has a position, not confirmed contact. Put anatomy, capacity and model fit behind named controls instead of presenting them all above the primary action.

**Body editor navigation.** Chest shape and milk supply share an actor draft. Name both on the main sheet; the return action on a detail page names its destination. On mobile keep save/discard readable during scrolling; in XR keep those targets clear of the diagram controls.

**One choice should take one decision.** Present mutually exclusive behaviours as one labelled group; changing directly from off to a recording mode must not require enabling an intermediate mode. Where a stand action already names its destination, pressing it both chooses that destination and requests the action. Retain separate controls for genuinely different outcomes, such as stopping a motor versus cancelling one pending delivery. Keep scene-wide adjustments that change the picture often (light, exposure, shadow) together and put occasional rendering options in Visual details.

**Keep the organ and its close-up at different scales.** Uterus opens on the rotatable whole organ and its retained fluid. Egg is a separate observation tab: on the insertion sheet only, place “受孕率（游戏）” and “强制排卵” beside the egg selection; zero eggs is a real empty view. Keep the selected egg’s recorded outcome legible at HUD size. The Vulva tab owns the single membrane-mode choice. In the fixed operating column keep the adjustable depth next to speed and distinguish requested travel from measured penetration.

Selecting an actor opens that actor’s tools; the backpack button opens the catalog. A player can fold an unsaved body preview to inspect the stage and resume the same section. Keep left/right drain receipts beside their actions and distinguish an actual stage effect from a fill-only update. An illustration reached from Lactation returns there.

Put **插入 / 泌乳** in the first row on the actor sheet. The next tools include clothing, posing, observation and a separate body editor. The insertion workbench pairs one live view with the operating controls; on a narrow phone the monitor sits above them. Zoom within the same picture box so the operating keys stay in place. Horizontal drag turns the figure, vertical touch scrolls the sheet. In XR the title moves the local workbench and the illustration turns independently; the player chooses their own viewing position. The viewed organ and release target are independent. Milk taken during interaction updates the actor's left and right stock, visible in the breast figure.

**Actor status, appearance first.** The breast view opens as a warm, softly lit external figure against the actor panel's plum field. Breathing and the lower silhouette are legible without text on the figure. Cutaway and labels are separate choices. Reserve relative left/right readouts for enabled lactation.

Keep the soft and raised nipple/areola choices together beneath the external figure; the cutaway uses that space for anatomy. Inspect the same frozen front, oblique and profile view on both settings. On the interaction sheet the first placement shows a stationary stand; show the operating and release controls after the clothing choice. Screen players can explicitly frame the actor's expression while continuing to use the controls. Never move the headset to a reaction shot.

For the external vulva, use a light flesh tone on outer skin and a warmer coral pink in the inner folds and opening, following the adult model's resting and open colour relationships. Do not shade the recess with plum or purple-brown. Keep material study C's matte pads, directional inner highlights and soft root shadows. The stage attachment uses the actual room fill; compare its colour beside visible actor skin, not only on the isolated HUD plate. Keep the calibrated opening and real occlusion. Compare at 156 px and close up, including an oblique turn and near profile; the highlight must turn with the surface, not trace a fixed white outline. Review figures stay local.

For the vaginal close-up the walls are the subject. Use an asymmetric longitudinal cut with apposed, rounded folds, deeper shadow in their recesses and small moving highlights. Show only the measured portion of the silicone mould between the walls; the calibration pointer belongs in the measurement tool. At a fixed angle compare rest, shallow contact, deeper contact and full withdrawal on the actual rig. Fluid is a separate retained volume, not a gloss or an animation that starts when the player moves a slider.

Quest review accepted the external peach/coral colours. When the external opening widens, its centre should reveal a short folded inner surface with depth and oblique occlusion rather than a flat swatch. In the whole-uterus view, retain the ovaries and tubes while showing the measured shaft and local wall response in the lower tract. An axis line alone does not communicate insertion; the physical stop is the cervix, not inside the uterine cavity. These are observation views, independent of whether the optional actor attachment is visible.

Keep **Everyday view / Pregnancy reference** together above the part tabs in Body observation. The heading, Back control and angle keys stay put when the viewer compares the two. For the vulva, vagina and uterus the main plate itself must show the tissue and organ in the chosen view, at the same angle as the everyday plate. Adding a locator beside an unchanged everyday drawing does not make it a reference model. Label the reference as an illustration, not a current actor condition. The insertion workbench keeps its ordinary live monitor; egg records and replay are independent.

Inside the uterine reference, use a sleeping anime portrait: tapered eyelids, short swept locks, warm cel shadows and an asymmetric curled pose. Judge the face, hand, knee and foot silhouettes in the whole organ at 156 px as well as at screen size. Keep the umbilical attachment on the belly and the maternal structures legible through rotation.

The optional XR FPS readout uses gold text over plum. The neutral scene background and grid keep their stage colors. The placement stamp and pose markers use dark/light contrast plus their existing footprint, cross and joint shapes; validity must not depend on color alone.

Hand and controller rays share a `#79baff` beam and a hollow hit marker with a white inner band and ink outer rim. Both bands use the existing cursor quad, independent of scene exposure. The 39 mm cursor quad and 7 mm beam are visuals; neither enlarges the interaction target. Live House scenery colors are intentionally separate from the HUD palette.

## Typography

**Control copy and scene art have different jobs.** The adult doujin style comes from framing, the colour and weight of the illustration, the actor's response, and the timing of events. Use familiar game wording for buttons and status: “保持穿衣”, “取消释放”, “待释放”. Avoid instructional or restrictive narration on the everyday action sheet. When the player needs an explanation, keep the specific reason beside its recovery or in the detail page.

Use the local Yu Mincho / Songti SC / SimSun / Georgia stack for sheet headings. Buttons, body text and values use system sans-serif. No font download is needed. Frontmatter font sizes, rounded tokens and spacing tokens are **Canvas pixels**, not CSS layout or world-space sizes.

- Buttons use the button role, switching weight when active; text is centered with a maximum width of texture width minus 28 px.
- Values pair muted, left-aligned labels with gold, right-aligned numbers; centered captions use the centered-label role.
- Recovery/details use title and body roles, with body baselines spaced 48 texture pixels apart.
- Drag labels use 500/26 px; status uses 600/26 px; playback time uses 600/22 px; the diagnostic FPS badge uses 700/28 px.

Button textures are 88 px high, with width `max(256, round(88 × geometryWidth / geometryHeight))`. Value textures use the same ratio rule. Texture dimensions and geometry jointly determine apparent type size; no CSS line-height or inferred modular scale applies.

## Layout

The public watch strip opens a scenery picker or backpack. Pickers and advanced settings replace the strip at its recalled location. Explicit selection opens an anchored tool sheet beside the asset. On screen, the same actions appear beside the picture, with a persistent transport strip below. Preserve widths, mobile scrolling and the space for the 3D view. Local sheets and common XR controls share `components/PorcelainControls.tsx` (historical filename).

Geometry dimensions below are **local Three.js units**, meter-based in the XR scene before parent transforms; they are not texture pixels. Model/object control groups additionally scale by 1.2.

- Expanded backdrop: 2.76 × 2.24 at `[0, -0.06, -0.018]` with a 1320 × 1120 texture. Compact watch sheet: 1.89 wide, 0.92 high for the introduction or 0.75 for transport.
- Expanded header shares Y=0.83. The left rail uses 0.47 × 0.18 keys at 0.25 intervals. Task content and playback footer (Y=-0.95) occupy the same panel.
- Default button width is 0.36; effective height is `max(0.13, requestedHeight)`. Transport buttons are 0.5 × 0.14. Drag geometry is 0.92 × 0.11.
- Slider default width is 0.74, track height 0.012, thumb radius 0.036; invisible interaction plane is `(width + 0.12) × 0.16`.
- Recall places the main HUD 1.8 m horizontally ahead of the head and 0.12 m below eye height. When “Face me” is on, dragging its handle keeps the HUD upright and facing the tracked head throughout the hold. Rotate around the point the ray grabbed, including on the offset compact handle. Scrubbing a value or the playback timeline still holds the panel steady.

This spatial UI has no CSS viewport breakpoints. Watch/expanded modes and paged content control density. Recovery/detail planes are 3.2 × 1.05 with 1280 × 420 textures.

## Elevation & Depth

Tonal separation and thin structural rules provide depth. HUD meshes use unlit materials, disabled tone mapping and disabled depth writing/testing; layering uses render order and small Z offsets. No expensive blur, bevels or real 3D shadows belong to this HUD. Stage shadow controls affect the scene, not UI elevation.

UI Canvas textures use sRGB, linear filtering and no mipmaps. Paint hover and selection into the key's existing texture. Leave its mesh material multiplier white (the default) so the ink is reproduced once. Press immediately scales the existing button to 0.985; there is no timed easing. Screen controls have an explicit gold keyboard focus indicator.

## Shapes

Common XR buttons keep their rounded geometry with radius `min(0.025, effectiveHeight × 0.22)`; the painted frame cuts the upper-left and lower-right corners. The workbench's existing cut-corner keys keep their matching ray geometry. Use corner rules inside ordinary screen keys without clipping their hit targets or focus rings.

Expanded panels have one-pixel texture separators inset by the panel-rule-inset-texture token. Selected tabs add a centered, half-width indicator, 4 texture pixels high, starting 6 pixels above the bottom edge. Sliders use circular thumbs and narrow rectangular tracks.

## Components

- **Buttons:** plum ordinary actions; quieter header/back keys; wine selected toggles; gold primary actions. Disabled fill/text take priority. Trigger release activates once; the following click is suppressed.
- **Settings navigation:** B → More opens **Player / Character / Environment** on a left rail, Player first. Player owns normal/free movement, travel speed, turning, controller feedback and visible hands. The active movement mode shows its jump or flight gesture beside the selector. Character owns dance compression, authored physics and contact tuning. Environment owns scene appearance and diagnostics. Keep device requests in prep; viewing controls must be accessible on stage. Model/material details open from the selected asset. Return to viewing hides the rail.
- **Value labels and sliders:** labels and values remain distinct. XR sliders use an old-gold track, rose fill and gold thumb, switching fill and thumb to muted ink when disabled. Keep the invisible drag target. The on-screen pose name field uses an inset face, ivory text and gold caret.
- **Panel and transport:** header recall/drag/back, task area and footer share one surface. Watch mode presents play/pause, menu and exit with drag and recall guidance; seek appears only with a model and positive duration.
- **Recovery and diagnostics:** paged text and explicit actions remain reachable; critical notices use danger styling. Diagnostics describe measured data without equating emulator FPS to headset GPU performance.

## Do's and Don'ts

### Do:
- **Do** keep HUD colors independent of preparation, stage and model colors.
- **Do** distinguish texture pixels from local XR geometry units.
- **Do** preserve readable labels, explicit selected states and controller target sizes.
- **Do** report emulator evidence separately from pending Quest hardware validation.

### Don't:
- **Don't** add expensive blur, bevels or real 3D shadows to the HUD.
- **Don't** replace restrained selection with full-panel accent fills.
- **Don't** ship review screenshots as product assets or claim headset success from them.
