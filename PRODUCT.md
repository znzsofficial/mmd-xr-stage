# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

The confirmed primary user watches MMD scenes on Quest 3S, mainly using controllers. Hand tracking is used to try physical interaction with models. Viewing is the primary activity; settings are adjusted occasionally.

The viewer imports game characters. Built-in modelling means places for those characters: a sunlit classroom, pool terrace, meadow and sky. Prioritize environmental detail, convincing sunlight and responsive local asset loading over bundled characters.

## Product Purpose

MMD XR Stage loads local model, animation and environment assets into an immersive WebXR stage. Success means dependable entry and playback, unobstructed viewing, and settings that are easy to reach and dismiss.

## Operating Context

Assets are chosen on the preparation page before entering VR. The viewer can play/pause, adjust models and materials, place environment objects, configure lighting and physics, and recall the menu. Quest hardware validation is required for readability, interaction comfort and actual performance.

## Capabilities and Constraints

The existing implementation uses React Three Fiber, Three.js and WebGL/WebXR with a patched MMD loader and Bullet WASM. Preserve all existing controls, session cancellation, model-scale/physics invariants and error recovery. WebGPU XR support is a separate compatibility investigation, not an approved renderer migration in this design task.

## Brand Commitments

The product name is MMD XR Stage. The user rejects the current VR GUI's colors and styling and asks for a more modern interface. No specific visual reference has been selected. The preparation page is outside this visual redesign.

## Product Principles

- Let models and the stage lead; menus appear when needed.
- Prioritize controller readability and reliable targets.
- Keep diagnostics truthful and distinct from measured GPU performance.
- Preserve local asset ownership and established physics behavior.
