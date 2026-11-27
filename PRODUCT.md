# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

The primary user plays with imported adult characters on Quest 3S, mainly using controllers, and also watches MMD scenes. They try physical interaction with hand tracking and adjust settings occasionally.

The viewer imports game characters. Built-in modelling means places for those characters: a sunlit classroom, pool terrace, meadow and sky. Prioritize environmental detail, convincing sunlight and responsive local asset loading over bundled characters.

The viewer especially likes fantastical settings such as the Opal Planetoid. Give these worlds a prominent place when curating destinations; adding more small rooms is not itself a goal.

The small enclosed sets were moved off the main list because the viewer finds them oppressive. For new everyday locations, favor connected open-air places with long sightlines, sunlight, tree shade and room to watch a character at different distances. A lively seaside city park is a better reference than another intimate interior.

“Scene people” defaults off and remembers the viewer’s choice. It controls only people already authored into the environment (such as the clinic nurse). It must not spawn a sample actor, affect the viewer’s imported characters or treat static teaching exhibits as people.

At arm’s length, different surfaces should respond to light like different materials: a sealed cabinet side, the grain of a wood shelf and a paper carton should not all read as the same coloured plastic. Give close-up assets appropriate edge profiles, roughness, subtle surface normals and contact shade; compare them in the actual stage under the same lighting.

For character play, the user's reference is Koikatsu's Free H mode: player-controlled sexual interaction between adults and the visible fertilization event take priority over playing dance clips. Dance playback remains available. Partner setup and support for additional import formats still need validation.

When proposing adult content, describe what the player can do with a chosen adult character or prop and what responds. A wedding room, romantic lighting or themed décor alone does not meet that request.

Selecting a character exposes Insertion and Lactation immediately on screen and in XR. Clothing, poses, Body view and Body settings are available beside those actions. Most imported characters are clothed; the HUD figure is a primary way to see the interaction and must stay visible beside the controls. Improving the actor's expression complements that view. The player can keep clothing on during calibrated interaction; exposure and simulated inside contact are independent. Place the release destination beside the action. Body view is reachable without a prop. For lactation the player can look at the actor while holding a side and know before pressing when only a numerical response is possible.

Open **Insertion** on the whole uterus. The adjacent **Egg** tab alone has Force ovulation and the actor’s game conception chance (0–100%, default 60%). An actor starts with zero eggs. A press adds one, to a maximum of three including fertilized eggs. With an available egg, a verified internal release with positively retained fluid gets one chance at delivery; success fertilizes one egg and failure leaves it available. Without an egg there is only a fluid receipt. Eggs keep their own results across views and scenery changes; the selection for observation does not direct the delivery. The event ends at fusion or dispersal.

Pregnancy and physiological calendar management are outside the product direction. Do not propose ovulation schedules, implantation, gestational weeks or belly growth as follow-ups. Clothing, body shape and left/right milk stock remain independent actor tools. Body settings previews shape and starting stock; Body view is read-only.

The optional Pregnancy reference in Body view is an illustration chosen by the viewer, not an actor condition. Opening or rotating it must not change the character, their milk or eggs, or the live insertion sheet. A fitted external attachment, separately, can stay enabled under clothes: only uncovered areas should be visible when the garment moves.

In the dildo controls, use the plain player-facing terms 精液 / semen, 阴道 / vagina and 宫腔 / uterus. The spray, organ view and measurement key use the same milky white. Keep quantities in game units and show the actual cervical stop; the selected destination does not need a “fantasy” prefix.

An anatomical illustration here is a live game view. The player can rotate the same anatomy and see changes in tissue, instrument position and simulated liquid. Use local rendering rather than a gallery of static generated pictures or an external image API; keep illustrative motion separate from measured state.

Breast modelling in Body state means a rotatable HUD study with current actor state, even on a PMX with no breast morphs or suitable bones. Deforming the imported character is a separate, reversible capability. Show side-specific refill only when lactation is enabled; never present the illustration as a scan of the imported mesh.

The player wants the breast figure to look like an anime adult-game portrait, not a medical specimen or a diffuse-shaded plastic torso. Design the shoulder, underarm and breast silhouette as one figure; use tapered linework, warm cel shadows and selective highlights that follow the surface as it turns. Open on external appearance, movement and the character's current state. Let the player uncover internal views and labels on request; keep measured feedback accessible where it guides an action.

The desired silhouette is a flowing teardrop: narrow above, widest in the lower half, with a rounded lower arc returning into the chest. Study 01 was rejected as too square and rigid; the player approved study 02 for the dynamic figure. Compare that same shape frontally, obliquely and from the side in both fullness states. Review images stay in the ignored `local-review/art/breast/` directory.

## Product Purpose

MMD XR Stage loads local model, animation and environment assets into an immersive WebXR stage. Players can interact with a chosen adult character and see its response while operating the controls. Dependable entry and playback, unobstructed viewing, and settings that are easy to reach and dismiss also matter.

When a headset is not in use, the same stage can be watched with a keyboard, mouse or touch. Screen viewing and VR share the current tab's local files and set layouts.

## Operating Context

Local files enter a same-tab backpack. A fresh visit starts on an empty stage: choose the environment in VR, take a character from the backpack and decide where it stands. The everyday move/turn/scale/motion actions belong near the selected character. Advanced settings stay available and out of sight during viewing. Refreshing clears the backpack. Quest hardware validation is required for readability, interaction comfort and actual performance.

## Capabilities and Constraints

The existing implementation uses React Three Fiber, Three.js and WebGL/WebXR with a patched MMD loader and Bullet WASM. Preserve all existing controls, session cancellation, model-scale/physics invariants and error recovery. WebGPU XR support is a separate compatibility investigation, not an approved renderer migration in this design task.

## Brand Commitments

The product name is MMD XR Stage. The whole in-stage HUD uses the adult visual-novel style: deep plum, ivory lettering, brass rules and rose selection. Switching an actor tab, opening the backpack or adjusting playback must not switch visual worlds. The preparation page retains its studio palette; neither UI changes the lighting of the scene or the imported model.

## Product Principles

- Let models and the stage lead; menus appear when needed.
- Prioritize controller readability and reliable targets.
- Keep diagnostics truthful and distinct from measured GPU performance.
- Preserve local asset ownership and established physics behavior.
