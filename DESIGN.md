---
name: MMD XR Stage — VR HUD
description: 浅瓷与墨蓝; controller-first porcelain controls for immersive viewing.
colors:
  surface: "#edf1f6"
  control: "#ffffff"
  border: "#ccd5e2"
  ink: "#172638"
  muted: "#52627a"
  primary: "#244fc5"
  selected: "#dce7ff"
  track: "#a6b5ca"
  danger: "#a52b3d"
  danger-surface: "#fbe7eb"
  disabled: "#5d6b7f"
typography:
  title:
    fontFamily: "system-ui, sans-serif"
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
    backgroundColor: "{colors.surface}"
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

# Design System: MMD XR Stage — VR HUD

## Overview

**Creative North Star: "浅瓷与墨蓝"**

The user-selected direction is cool porcelain, ink typography and restrained cobalt selection. Quiet, flat controls support a Quest 3S viewer who mainly watches and occasionally adjusts settings with controllers.

This system applies only to the VR HUD in `src/mmdVrShowcase/hudAppearance.ts` and `src/mmdVrShowcase/components/MmdVrHud.tsx`. The preparation page has its own user-selected **窗光工作室** direction: warm white `#faf9f5`, ink text `#192f28`, deep green entry controls `#175948`, a classroom panorama and a pale green import area. The entry action is above the fold; device settings start collapsed. The original scene render for `prep/classroom-window.webp` shows the built-in classroom from `ac546a6`, with no imported assets or HUD. Serve the static picture and local line icons without creating a preview renderer. Stage lighting, backgrounds and model materials have independent colors.

**Key Characteristics:**
- Cool porcelain surfaces with ink labels.
- Selection through tint, weight and a small tab indicator.
- Flat, rounded controls with controller-sized targets.
- Code-painted textures; no shipped raster assets.

Direction authority: the confirmed choice recorded in `.impeccable/surfaces/vr-hud.md`. Development-emulator layout review is recorded in `.openchamber/screenshots/porcelain-visual-final-2026-11-17T14-03-46-087.jpg` and `.openchamber/screenshots/porcelain-watch-final-2026-11-17T14-05-25-104.jpg`. These are review captures, not product assets or proof of interaction success. Quest 3S optical readability, comfort, controller/hand behavior and performance validation remain pending.

Publication state is tracked in `docs/HANDOFF.md`; this design shipped in `c5232fd`. The initial review found time text painted across the progress track; it is now painted at texture Y=24, above the track at Y=56–62, on a 0.13-high seek plane. The scoped follow-up review approved that fix with a synthetic-duration capture (`porcelain-progress-fixed-2026-11-17T14-14-09-711.jpg`).

## Colors

The frontmatter preserves the actual Canvas hex values from `HUD_COLORS`, rather than sampled screenshot colors.

- **Primary:** cobalt `primary` marks selected text, tab indicators, slider fill and thumbs; pale blue `selected` carries active controls and dragging feedback.
- **Neutral:** porcelain `surface` backs panels and quiet controls; white `control` distinguishes ordinary buttons. `ink` is primary text, `muted` secondary labels, `border` structural separators, `track` unfilled sliders and `disabled` unavailable labels.
- **Semantic:** `danger` on `danger-surface` identifies destructive actions and critical notices.

**The HUD Boundary Rule.** HUD tokens never become global preparation-page or stage colors.

**Private actor tools.** The pelvic workbench has its own mature visual-novel treatment: deep plum, pearl lettering, rose tissue, restrained brass rules and clipped control corners. The organ view also appears in the cycle workspace. These are scoped surfaces within the existing player; do not retint the common porcelain HUD or light the stage from an illustration. An animated anatomical view and a calibrated measurement view use the same actor-local angle. Actual contact, simulated liquid and illustrative motion have separate visual meanings.

**Show what a button did.** Entering an actor tool replaces the backpack list. Start body editing with the chest slider and a reversible preview on the actor. Start rod fitting with one action that places the visible stand outside the opening. Give a blocked action a recovery at the same location (including restoring a hidden clothing material). Use “inside” only after a measured crossing; a mounted or stopped rod has a position, not confirmed contact. Put anatomy, capacity, model fit and cycle settings behind named controls instead of presenting them all above the primary action.

**Body editor navigation.** Chest shape, cycle and lactation are peer sections with a shared draft. Show all three names on the main sheet; reserve the detail header for a return action that names its destination. On mobile keep the save/discard row readable during scrolling. On XR separate that row from the diagram and date controls. Freezing a figure, holding a cycle day and saving a character are distinct actions with distinct labels.

**Actor status, appearance first.** The breast view opens as a warm, softly lit external figure against the actor panel's plum field. Breathing and the lower silhouette are legible without text on the figure. Cutaway and labels are separate choices. Reserve relative left/right readouts for enabled lactation. On the cycle page let the date and visible change lead; the tissue comparison and anatomical references belong one level down in the experience or in the guide.

For the external vulva, the user prefers soft cherry and peach highlights, with rose shadows separating the inner and outer folds. Preserve saturated midtones and the measured entrance. Judge the effect at the size of the actual HUD and in a nearly side-on view: highlights should turn with the folds, not outline a hard ring.

The optional FPS badge retains a diagnostic exception: green text (`#9fe870`) over translucent black (`rgba(0,0,0,0.55)`). It is not a general success or selection style. Prep controls use their studio palette; the neutral stage background, grid and placement aid have their own colours. A legacy OS accent must not tint any of these surfaces.

Hand and controller rays share a `#79baff` beam and a hollow hit marker with a white inner band and ink outer rim. Both bands use the existing cursor quad, independent of scene exposure. The 39 mm cursor quad and 7 mm beam are visuals; neither enlarges the interaction target. Live House scenery colors are intentionally separate from the HUD palette.

## Typography

All type is painted into textures using the system sans-serif stack; no bundled font or display face. Frontmatter font sizes, rounded tokens and spacing tokens are **Canvas pixels**, not CSS layout or world-space sizes.

- Buttons use the button role, switching weight when active; text is centered with a maximum width of texture width minus 28 px.
- Values pair muted, left-aligned labels with ink, right-aligned numbers; centered headings use the centered-label role.
- Recovery/details use title and body roles, with body baselines spaced 48 texture pixels apart.
- Drag labels use 500/26 px; status uses 600/26 px; playback time uses 600/22 px; the diagnostic FPS badge uses 700/28 px.

Button textures are 88 px high, with width `max(256, round(88 × geometryWidth / geometryHeight))`. Value textures use the same ratio rule. Texture dimensions and geometry jointly determine apparent type size; no CSS line-height or inferred modular scale applies.

## Layout

**Backpack workflow revision.** The public watch strip opens a direct scenery picker or the page's backpack. Pickers and advanced settings replace the strip at its recalled location. Only explicit selection opens a porcelain tool sheet beside the targeted asset; its anchor is stable during playback and it gives up input when the public menu or recovery surface is in focus. Placement uses a directional footprint or a crossed invalid mark. Local sheets and common controls share `components/PorcelainControls.tsx`; room geometry, sunlight, wood and fabric do not use HUD tokens. Earlier four-tab measurements below describe the advanced/legacy layout.

Geometry dimensions below are **local Three.js units**, meter-based in the XR scene before parent transforms; they are not texture pixels. Model/object control groups additionally scale by 1.2.

- Expanded backdrop: 2.76 × 2.24; watch backdrop: 1.95 × 0.84. Both use a 1320 × 1120 texture at local position `[0, -0.06, -0.018]`; compact mode omits separators.
- Expanded header shares Y=0.83; four tabs are 0.59 × 0.16, spaced 0.63 center-to-center at Y=0.59. Task content and playback footer (Y=-0.95) occupy the same panel.
- Default button width is 0.36; effective height is `max(0.13, requestedHeight)`. Transport buttons are 0.5 × 0.14. Drag geometry is 0.92 × 0.11.
- Slider default width is 0.74, track height 0.012, thumb radius 0.036; invisible interaction plane is `(width + 0.12) × 0.16`.
- Recall places the panel 1.8 m horizontally ahead of the head and 0.12 m below eye height. All pages share panel position. Following is yaw-only and pauses during interaction.

This spatial UI has no CSS viewport breakpoints. Watch/expanded modes and paged content control density. Recovery/detail planes are 3.2 × 1.05 with 1280 × 420 textures.

## Elevation & Depth

Tonal separation and thin structural rules provide depth. HUD meshes use unlit materials, disabled tone mapping and disabled depth writing/testing; layering uses render order and small Z offsets. No expensive blur, bevels or real 3D shadows belong to this HUD. Stage shadow controls affect the scene, not UI elevation.

Canvas textures use sRGB, linear filtering and no mipmaps. Button hover/press multiplies the texture by the selected tint; press immediately scales geometry to 0.985. There is no timed easing animation. The sidecar's HTML/CSS previews are illustrative flat translations, not XR rendering or interaction validation; their focus outlines are preview-only.

## Shapes

Buttons are rounded planes with radius `min(0.025, effectiveHeight × 0.22)` in local geometry units. Panel corners are painted using the panel-texture radius; stretching the same texture onto the compact plane changes their apparent proportions. Avoid treating either radius as a global CSS radius.

Expanded panels have one-pixel texture separators inset by the panel-rule-inset-texture token. Selected tabs add a centered, half-width indicator, 4 texture pixels high, starting 6 pixels above the bottom edge. Sliders use circular thumbs and narrow rectangular tracks.

## Components

- **Buttons:** white ordinary actions; porcelain quiet/header actions; tinted active toggles; semantic danger actions. Disabled fill/text take priority, while an active disabled button retains active font weight. Hover tint is suppressed when disabled. Trigger release activates once; the following click is suppressed.
- **Settings navigation:** B → More opens **Player / Character / Environment** on a left rail, Player first. Player owns normal/free movement, travel speed, turning, controller feedback and visible hands. The active movement mode shows its jump or flight gesture beside the selector. Character owns dance compression, authored physics and contact tuning. Environment owns scene appearance and diagnostics. Keep device requests in prep; viewing controls must be accessible on stage. Model/material details open from the selected asset. Return to viewing hides the rail.
- **Value labels and sliders:** labels and values remain distinct; dragging uses the larger invisible target. Disabled slider opacity is 0.45. There are no editable text fields in this HUD.
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
