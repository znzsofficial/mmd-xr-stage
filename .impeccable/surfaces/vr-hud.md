# VR HUD

Mode: Operate. Target: `src/mmdVrShowcase/components/MmdVrHud.tsx`.
Audience: Quest 3S, controllers for menus, hand tracking for trying physics. Viewing first, occasional adjustments.

## Direction contract

THESIS: A quiet, legible settings surface that appears over the stage only when needed; replace the heavy themed button wall.

OWN-WORLD: User selected 浅瓷与墨蓝. Cool porcelain surface, ink text, muted blue-gray labels, discrete cobalt selection, thin structural separators, rounded controls without bevels or thick outlines. UI palette is independent of stage and model colors.

STORY: Watch, recall the menu, choose one category, adjust a named value, return to viewing. Existing playback, paging, materials, physics, recovery and diagnostics remain reachable.

FIRST VIEWPORT: One head-relative menu with integrated recall/drag/back header, four navigation tabs, one task area, and a separate playback footer. Watching uses a small coherent transport strip. Selection reads through type and an indicator, not a flood of theme color.

FORM: The user chose the porcelain alternate on the visual decision page. seed:78b3c8eb31ebd549. Source set considered: media subtitles, gallery labels, contemporary spatial menus, music-library hierarchy, ceramic exhibition labels, museum wayfinding, cinema ticket typography. Catalog challengers did not override controller legibility; typography-led controls contributed clearer hierarchy, other artifact motifs were rejected as irrelevant decoration.

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance

No raster assets are shipped by this change; UI textures are painted from code. Desktop simulation demonstrates layout, not Quest optical readability or performance.
