// After build: immutable lazy modules still reachable from an older open tab.
// Only verified immutable Pages assets; never replace new code or index.html.
import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";

const files = [
  ['fd236688','index-aXLCtKTQ.js','1c5ef1643de3568a864a1ca6f4072f6e9f8831a710b075821c6ec5fd5492eca9'],
  ['fd236688','PlanetPhysics-ttZKcRlb.js','5457c1f710e1b49b471e5231e99d67d6570a933d00fd4e27e1002efe69382b08'],
  ['4a1f20fc','winter-arm-Dr-S30zL.webp','280ca9d25664feed472ba8e93571e22728813c432c6c78e0236656ff4dc7b62a'],
  ['4a1f20fc','PlanetPhysics-CNGGW272.js','09c35e9600e794d905e91affbab8bbe3f1e0c0e7ada4f49505ed69e6755f0752'],
  ['4a1f20fc','index-DWg8yEwu.js','49713bd9cefcdaf7a2d59d37f576858b30bbc30b06a7712e2a938d0431890e95'],
  ['4a1f20fc','vendor-three-BWdAaj0a.js','5d5e3119e3dd0506ad14cad5ac1a2ef3ce0f8a5c97cc2546b96a93f5ca28645a'],
  ['4a1f20fc','vendor-mmd-DKNovTYN.js','b60f91383e066c322367bdbb321e5d89749cb320346f9e14121f390732518567'],
  ['4a1f20fc','emulate-opEjXhZE.js','fc7d5265a907a87f3e3b26a1d92d75933e488abcf75c98ee3a7ac1bdfba253b3'],
  ['38219f66','PlanetPhysics-B5Nkghce.js','12a178e9a12205c90491eef9b1659c7aa4096499e71dc4f163c5f7483ff90b5d'],
  ['38219f66','index-C9AMsOxs.js','d81844d4252656d7b4653c127912b0a5a84db083d53db37096eda4ff6af862f4'],
  ['843fa0c9','winter-arm-BTH3isf0.webp','1a9c99644a7d9446fa65397f5fc3a6f8efeac33a6daadd48deef9e007d695dd8'],
  ['843fa0c9','PlanetPhysics-Dc7_dhpD.js','55348d8795b97fcd52edffa49e372c5c9939c5d98fc4262c0b231715ff8e673c'],
  ['843fa0c9','index-pMVj6YLa.js','67391720c7aafde30c74fef320fa13d337d429eb1599da30cdfc0b0cd4324c31'],
  ['8dcd90e9','PlanetPhysics-II020E8s.js','8721a640104c41e4b04183f8af195383503049b4b29215f5e7d5c3becb899cac'],
  ['8dcd90e9','index-BhSYxMOA.js','ad179c53e52dc7c00ebf960ef7920a629b2902125a4079a662fb88c7c30988d8'],
  ['5e0320e4','PlanetPhysics-Bq1zXxO_.js','62e02e4133d4693469437fc97897b5d1fb537654975484cb2aec25daf652a1dc'],
  ['5e0320e4','index-B3X5PRz7.js','39c68dd0b1e3082e9e26fc4f77bf055850ebf4da8c75f8a0575473501ca29833'],
  // An already-open arcade release can enter the arcade or planet for the first time.
  ['14d11a74','hall-lettering-DnAjU0ST.webp','7d89e675f3088b9df338d348f625d6feb2f4e7de89ce5e082622cb05f86250c2'],
  ['14d11a74','PlanetPhysics-qbkTvyf4.js','454be3221e59d9678e4f8eeeaaacad94486d84289f7b2772c8b7f1614816ca53'],
  ['14d11a74','index-ShALZi0d.js','73330fcf686904c5289cd463eeca4101696221cefcf7f8f8a5d098080326a3b2'],
  ['cfdfbbc6','PlanetPhysics-f2Xm0MaL.js','d7b5aba21bd0a11d7975a4dc22abad8a5c8d1a63127a26ade6addd511ed3efe4'],
  ['cfdfbbc6','index-DXgnwrGM.js','dbc6ef6f54c5f5eb1cf73eacb07631f9c667ef6619c1c5d1ecd4d24fde97aae1'],
  ['cfdfbbc6','vendor-three-D5cTBeFN.js','cd6a940e0c2678daa8fcc7521cd09f06fb9fd85fc7eefb2483bc7a4143f91ff0'],
  ['cfdfbbc6','vendor-mmd-D-Afj8i5.js','43366e05f951130b18cf284851eaf0c38e3b21f3e5896cef5a7202016dcf63e9'],
  // A 15a73d0 prep tab can first request the old chamber print or planet adapter
  // after this release. The adapter statically imports that build's app entry.
  ['8a6648eb','pavement-BH7aJcMu.webp','b26d5e2b16a449f0ae0ea13098010a78b9409b9ce09adc4fbb740bbc67c070d9'],
  ['8a6648eb','PlanetPhysics-D8k0exf1.js','5c579a55522e014ca7b3f274b24bf05cd3d10af251d20d6a653c39e8ae170fe1'],
  ['8a6648eb','index-COLA0-EE.js','aa57c1acf763166d4324ef4811e8efa747b8d69ff19b0addef606360d78eef97'],
  ['bfa9499d','PlanetPhysics-C8b_0I-H.js','e0588c2b93bf4730502f21ca46f1b1930ebdd794e511e3a7addb21581122a3f9'],
  // Old prep already imports its React/Three/vendor modules. Its first planet
  // visit after an update can still request the on-demand motor and WASM.
  ['561c3380','PlanetMotor-BVRXgpWJ.js','c36f9f43236ba248568dbaba80ab01fd513063ac1eb123a9bfbca7b4168725af'],
  ['561c3380','planet-physics-CGqbHp4L.js','0915c83b10adebd455731953e485f62786042953e27227fab75f4bdfde8eed80'],
  ["7530d188", "index-YFpsiatv.js", "d8b245ef63c935bbc79421927b3222f8df55fbc86295c7a752827e4973bd04a0"],
  ["7530d188", "MmdVrScene-BYabBXrY.js", "e1b4a34b880cecf4bef1d7b533f82b92bb4db268c644127af9735ebb9c8d99e2"],
  ["d55e5a7f", "index-slHQRHJX.js", "c00e0a4886f6c175a85d08c6160494a1c9850f7d6a78eb0e9ed24c598a6828ee"],
  ["d55e5a7f", "MmdVrScene-D2YD5kMF.js", "531201673d14507cc1bb2acf135aea785844cebf6a0e5569e98003a5d74610d7"],
  ["d55e5a7f", "vendor-three-Dy_r-u28.js", "342cef6dbbd69b6734112f219931cf62641132a7e7e6009d07a203e216b9c143"],
  ["d55e5a7f", "vendor-mmd-B024cD5e.js", "e765b2d02f0db182191aab998b459520d2a70ff46d7c85159d2098f74c43f75c"],
  ["d55e5a7f", "emulate-M6ay1N5Q.js", "fc6816057946f69b0e74edf88c1cdf25176f5c8aa67a7394971c87364594fe41"],
];
await Promise.all(files.map(async ([id, file, expected]) => {
  const path = new URL(`../dist/assets/${file}`, import.meta.url);
  const verify = bytes => {
    if (createHash("sha256").update(bytes).digest("hex") !== expected) throw new Error(`Unexpected content: ${file}`);
  };
  try { verify(await readFile(path)); return; } catch (error) { if (error.code !== "ENOENT") throw error; }
  const res = await fetch(`https://${id}.mmd-xr-stage.pages.dev/assets/${file}`, { signal: AbortSignal.timeout(45000) });
  if (!res.ok) throw new Error(`${file}: HTTP ${res.status}`);
  const bytes = Buffer.from(await res.arrayBuffer());
  verify(bytes);
  await writeFile(path, bytes, { flag: "wx" });
}));
console.log("Verified legacy XR entry files:", files.length);
