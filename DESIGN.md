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

This system applies only to the VR HUD in `src/mmdVrShowcase/hudAppearance.ts` and `src/mmdVrShowcase/components/MmdVrHud.tsx`. The preparation console in `src/styles/mmd-vr-prep.css` retains its separate dark, user-accented system; stage lighting, backgrounds and model materials have independent colors. This was not a catalog-seeded world.

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

The optional FPS badge retains a diagnostic exception: green text (`#9fe870`) over translucent black (`rgba(0,0,0,0.55)`). It is not a general success or selection style. Compatibility fields such as `accent.stageBg` are not HUD palette authority.

## Typography

All type is painted into textures using the system sans-serif stack; no bundled font or display face. Frontmatter font sizes, rounded tokens and spacing tokens are **Canvas pixels**, not CSS layout or world-space sizes.

- Buttons use the button role, switching weight when active; text is centered with a maximum width of texture width minus 28 px.
- Values pair muted, left-aligned labels with ink, right-aligned numbers; centered headings use the centered-label role.
- Recovery/details use title and body roles, with body baselines spaced 48 texture pixels apart.
- Drag labels use 500/26 px; status uses 600/26 px; playback time uses 600/22 px; the diagnostic FPS badge uses 700/28 px.

Button textures are 88 px high, with width `max(256, round(88 × geometryWidth / geometryHeight))`. Value textures use the same ratio rule. Texture dimensions and geometry jointly determine apparent type size; no CSS line-height or inferred modular scale applies.

## Layout

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
- **Navigation:** four tabs (models/objects, visual, physics, comfort). Selected tabs combine tint, heavier text and the cobalt indicator. Material details replace the task area; they do not create a distant second menu.
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
