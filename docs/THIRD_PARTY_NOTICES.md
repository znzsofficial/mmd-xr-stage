# Third-Party Notices

This file records notices for third-party code copied into the repository rather than installed only through the package manager.

## Seaside Terminus sky and shoreline

The two WebP hemispheres in `public/scenery/terminus/` derive from [**Kloofendal 48d Partly Cloudy (Pure Sky)**](https://polyhaven.com/a/kloofendal_48d_partly_cloudy_puresky), photographed by Greg Zaal, with sky edits by Jarod Guest. Poly Haven releases this HDRI under [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/) ([asset licence and redistribution terms](https://polyhaven.com/license)). The [original 4K Radiance HDR](https://dl.polyhaven.org/file/ph-assets/HDRIs/hdr/4k/kloofendal_48d_partly_cloudy_puresky_4k.hdr) has MD5 `816340c969d2e60d659051d13ac3c4dc`.

The station uses the upper hemisphere only. The sun-facing cloud bank is reprojected above the room key, keeping the horizon and zenith fixed and leaving a clear line of sight to the sun from the steps. The HDR exposure is compressed and graded for blue marine daylight. The photographic solar core is removed for a directional disc and aureole drawn at runtime, and the lowest few degrees are blended into coastal haze. The 512 × 128 water reflection is an area average of the same 4096 × 1024 sky in linear light. The source HDR is not distributed with the game.

The harbour cliff albedo and tangent normal derive from [**Cliff Side**](https://polyhaven.com/a/cliff_side), photographed by James Ray Cock and Dario Barresi, processed by Jenelle van Heerden, under the same CC0 licence. The stage uses a desaturated, resized 768px albedo and a resized, renormalized 384px OpenGL normal map. Source 1K JPEG MD5: `a64986e5f858e4f8df30f0394ededd78` (diffuse), `604fd4101fe5ad92181c22b96ed795c5` (normal).

The bench and ticket shelf use board strips cropped from [**Oak Wood Planks**](https://polyhaven.com/a/oak_wood_planks) by Dimitrios Savva (Poly Haven, CC0 1.0). [`bake-waiting-bay.py`](../src/mmdVrShowcase/scenery/terminus/bake-waiting-bay.py) verifies the original 2K diffuse and roughness maps and adds the cut ends, wear and metal finishes to the two local atlases. No third-party textures are requested at runtime.

The park benches reuse these oak strips. The park's bark texture derives from [**Bark Brown 02**](https://polyhaven.com/a/bark_brown_02), Poly Haven, CC0 1.0. The [tree bake](../src/mmdVrShowcase/scenery/terminus/park/bake-trees.py) also draws the original leaf sprays and canopy shade. The fountain's [reflection bake](../src/mmdVrShowcase/scenery/terminus/park/bake-fountain-probe.py) incorporates the same credited harbour sky. The park geometry, storefronts and signs are original work.

## Planetoid locomotion (npm packages)

The on-demand XR planet module uses [React Three Rapier 2.2.0](https://github.com/pmndrs/react-three-rapier) and [Rapier JS 0.19.2](https://github.com/dimforge/rapier.js) (Apache-2.0). Its WASM is distributed in the compat package. The standalone planet experiment and retained earlier release modules use [Ecctrl 2.0.2](https://github.com/pmndrs/ecctrl) (MIT, © 2023–2026 Erdong Chen). These are independent of the MMD Bullet backend.

## @webxr-input-profiles/assets 1.0.20

`public/xr-input/1.0.20/` contains unmodified controller profiles/models for Meta Quest Touch Plus, Touch Plus v2, Touch Pro, Oculus Touch/v2/v3, generic trigger and trigger/squeeze/thumbstick controllers, plus the generic hand models. The local `profilesList.json` indexes only this bundled subset; other controller profiles use the library's generic-trigger fallback.

Source: the npm package `@webxr-input-profiles/assets@1.0.20` from [WebXR Input Profiles](https://github.com/immersive-web/webxr-input-profiles). MIT License, Copyright (c) 2019 Amazon. The complete license is included in [`public/xr-input/1.0.20/LICENSE.md`](../public/xr-input/1.0.20/LICENSE.md).

These assets are served from the application's origin because loading controller profiles is required to establish input state, not merely to display a model. Preserve profile-relative model paths when updating the bundle.

## @yohawing/three-mmd-loader

`public/mmd/0.9.0/` contains the unmodified `mmd_bullet.js` and `mmd_bullet.wasm` from `dist/physics/mmd/` in the [official 0.9.0 npm package](https://www.npmjs.com/package/@yohawing/three-mmd-loader/v/0.9.0). `public/mmd/0.8.6/` retains the pair from the 0.8.6 package for older open tabs.

The game's loader uses a generated patch from the [stage fork](https://github.com/znzsofficial/three-mmd-loader). The exact source revision and distribution digest are recorded in [loader-source.json](../loader-source.json). The native runtime is [mmd-anim v0.5.5](https://github.com/yohawing/mmd-anim/tree/v0.5.5) (MIT, © 2026 Yohawing); its vendored Bullet library carries the [zlib license](https://github.com/yohawing/mmd-anim/blob/v0.5.5/crates/mmd-anim-physics-bullet/vendor/bullet3/LICENSE.txt).

MIT License

Copyright (c) 2026 yohawing

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.

## Noto Sans SC

Noto Sans SC is provided by Google Inc. through `@fontsource-variable/noto-sans-sc` version 5.3.0 and is licensed under the [SIL Open Font License, Version 1.1](https://openfontlicense.org/open-font-license-official-text/).

## @zip.js/zip.js 2.15.0

ZIP import uses zip.js, bundled under the BSD 3-Clause License.

Copyright (c) 2023, Gildas Lormeau

Redistribution and use in source and binary forms, with or without
modification, are permitted provided that the following conditions are met:

1. Redistributions of source code must retain the above copyright notice, this
   list of conditions and the following disclaimer.
2. Redistributions in binary form must reproduce the above copyright notice,
   this list of conditions and the following disclaimer in the documentation
   and/or other materials provided with the distribution.
3. Neither the name of the copyright holder nor the names of its
   contributors may be used to endorse or promote products derived from
   this software without specific prior written permission.

THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS"
AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE
IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE
DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT HOLDER OR CONTRIBUTORS BE LIABLE
FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL
DAMAGES (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR
SERVICES; LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER
CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY,
OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE
OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
