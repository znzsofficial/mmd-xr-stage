# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

The confirmed primary user watches MMD scenes on Quest 3S, mainly using controllers. Hand tracking is used to try physical interaction with models. Viewing is the primary activity; settings are adjusted occasionally.

The viewer imports game characters. Built-in modelling means places for those characters: a sunlit classroom, pool terrace, meadow and sky. Prioritize environmental detail, convincing sunlight and responsive local asset loading over bundled characters.

The viewer especially likes fantastical settings such as the Opal Planetoid. Give these worlds a prominent place when curating destinations; adding more small rooms is not itself a goal.

“Scene people” defaults off and remembers the viewer’s choice. It controls only people already authored into the environment (such as the clinic nurse). It must not spawn a sample actor, affect the viewer’s imported characters or treat static teaching exhibits as people.

At arm’s length, different surfaces should respond to light like different materials: a sealed cabinet side, the grain of a wood shelf and a paper carton should not all read as the same coloured plastic. Give close-up assets appropriate edge profiles, roughness, subtle surface normals and contact shade; compare them in the actual stage under the same lighting.

For future character features, the user's reference is Koikatsu's Free H mode: direct, player-controlled intimate interaction with chosen adult characters matters more than playing dance clips. Keep dance playback available. Treat the exact interaction controls, partner setup and supported import formats as design choices still to be validated.

When proposing adult content, describe what the player can do with a chosen adult character or prop and what responds. A wedding room, romantic lighting or themed décor alone does not meet that request.

In the dildo controls, use the plain player-facing terms 精液 / semen, 阴道 / vagina and 宫腔 / uterus. The spray, organ view and measurement key use the same milky white. Keep quantities in game units and show the actual cervical stop; the selected destination does not need a “fantasy” prefix.

An anatomical illustration here is a live game view. The player can rotate the same anatomy and see changes in tissue, instrument position and simulated liquid. Use local rendering rather than a gallery of static generated pictures or an external image API; keep illustrative motion separate from measured state.

Breast modelling in Body state means a rotatable HUD study with current actor state, even on a PMX with no breast morphs or suitable bones. Deforming the imported character is a separate, reversible capability. Show side-specific refill only when lactation is enabled; never present the illustration as a scan of the imported mesh.

The player wants the breast figure to look like an anime adult-game portrait, not a medical specimen or a diffuse-shaded plastic torso. Design the shoulder, underarm and breast silhouette as one figure; use tapered linework, warm cel shadows and selective highlights that follow the surface as it turns. Open on external appearance, movement and the character's current state. Let the player uncover internal views and labels on request; keep measured feedback accessible where it guides an action.

## Product Purpose

MMD XR Stage loads local model, animation and environment assets into an immersive WebXR stage. Success means dependable entry and playback, unobstructed viewing, and settings that are easy to reach and dismiss.

When a headset is not in use, the same stage can be watched with a keyboard, mouse or touch. Screen viewing and VR share the current tab's local files and set layouts.

## Operating Context

Local files enter a same-tab backpack. A fresh visit starts on an empty stage: choose the environment in VR, take a character from the backpack and decide where it stands. The everyday move/turn/scale/motion actions belong near the selected character. Advanced settings stay available and out of sight during viewing. Refreshing clears the backpack. Quest hardware validation is required for readability, interaction comfort and actual performance.

## Capabilities and Constraints

The existing implementation uses React Three Fiber, Three.js and WebGL/WebXR with a patched MMD loader and Bullet WASM. Preserve all existing controls, session cancellation, model-scale/physics invariants and error recovery. WebGPU XR support is a separate compatibility investigation, not an approved renderer migration in this design task.

## Brand Commitments

The product name is MMD XR Stage. The selected VR control palette is 浅瓷与墨蓝 (porcelain and ink blue); the preparation page and the stage use their own palettes.

## Product Principles

- Let models and the stage lead; menus appear when needed.
- Prioritize controller readability and reliable targets.
- Keep diagnostics truthful and distinct from measured GPU performance.
- Preserve local asset ownership and established physics behavior.
