// After build: immutable lazy modules still reachable from an older open tab.
// Only verified immutable Pages assets; never replace new code or index.html.
import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";

const files = [
  ['227e05c1','index-CpuGqpmp.js','120477b708028e911fe325fc6ed9c30a1a316d1181f0e30d046b9659a893ce44'],
  ['227e05c1','PlanetPhysics-DGtWpjkT.js','ce2beeefb7b622019e71ad2c76dd826f5f29a3f47a2da9a61c12548d2ab4b226'],
  ['227e05c1','organ.worker-DDfzHuxh.js','5bf8c0c71981498bf345b6cbaa7415ca97c086d6c11b6f7a6f8fecb7639ced76'],
  ['41ef223b','index-Bmw4f-UL.js','fdcf77e653ecb8d50cf37285cbdc3a1402e6e08a934228b82c7603dc99371a52'],
  ['41ef223b','PlanetPhysics-HmHMkxl3.js','6a77d2fdb30218870ca233803aa0d2ef2802ebe66dfe984637392df90dbd055a'],
  ['41ef223b','organ.worker-dQG0D6Ad.js','3d6c4a49afc3d6a435d5fe81cdfc7cf8b92b00989efc15cda6b2bb548e8e13cb'],
  ['5e339b8e','index-DFLinZu6.js','c21c88f34526fa87a5af71e8b13d8ddd650b4ef420d8b9f7f339867ddeee8495'],
  ['5e339b8e','PlanetPhysics-B32XPLNC.js','2f9d3f129bfa5e7d7935b96a6223a146d0bff79b90d9777b66a6ece1907980a1'],
  ['5e339b8e','index-DGrVppO8.css','8bf64870727369c20b959c666ab6317698d7641e6a745e09617acd11fa8a6cca'],
  ['851afe68','index-DVb-QyN6.css','39fc14ae756649ab7d3092352802711c81cf0490a24d99a11034fd34f6f23da7'],
  ['851afe68','index-BzlVv4Bb.js','f058a420e98608d1752b2b372d526d3d96b5a44ed919fa88cd0e40afc35463d3'],
  ['851afe68','PlanetPhysics-CuysWbwC.js','2dd4a227c992f25e1b47ba8ebe06ab699546c85c6e5685e1db95fe4ccaebb715'],
  ['e4eb3d06','index-Bf5cnFCe.js','0639cfdda733350cb417b42c002852e85b9093cc866b2ebb51426489fc8f5a85'],
  ['e4eb3d06','PlanetPhysics-CSik8scO.js','a57e5293dea3d1497f6603d70569b7348619d630a404055531ee0d0a518696f1'],
  ['d07c4510','index-CBgCJQkW.js','fadb32ece8b00063279c4a136f1302b0ce142718b40895ddcc7785932869c139'],
  ['d07c4510','PlanetPhysics-BUNAA9ci.js','da672ba7c07044d9b8629031239a0ee3cbffd0eb898b71dabd94b235abd9674f'],
  ['bf6b88dd','index-1PTUGxdk.js','f0503edbf71402a2338c7c555895efb0283b210dce56a6477d844da5647a1869'],
  ['bf6b88dd','PlanetPhysics-CmqfHE7E.js','8dd9c328e6afd1d9ac875310cfa16373497eb18167c89cda2f5bacac987cff65'],
  ['8177e079','index-CaqoA6oB.js','92b19c7c692ff7c074fe9933bde697d4f596b9f2e1712a7ac7c3640ce7f50318'],
  ['8177e079','PlanetPhysics-yyThTFmv.js','2b8ca6d7657260ecdefe195186ec4e4aa324043fb67f302de020dc0e4e245e85'],
  ['8177e079','fracture-Bo0rtIqv.webp','79d8342fd8253ad19f23b00447c7a9c12af87eacf8119cabb2e128a774c28219'],
  ['6b33a340','index-iD5Iqxut.js','28372f71c8d30e2900d15ab400d36d7ebf2fe0dbfdeaf97cf2d5989ab808ce55'],
  ['6b33a340','PlanetPhysics-DhmQzHXp.js','b427ac2995a2bcff029be86bb72cd382c2d5cc0b7763173e1c8371b326243dd2'],
  ['265be8b7','index-tPuae25K.js','5cfc3f80cd3ac06dda57862e51b4fa053251b6b4175dd1fc74db7ef9a28bc40d'],
  ['265be8b7','PlanetPhysics-DUo6ZfWA.js','379e8ba1ea7742a97e6929eacf24f24f5c7d6f61afab2828e01bcfccdaa5a6a2'],
  ['265be8b7','glaze-fractures-Dis1LmWJ.webp','e87ab1f7cf7c946965f8723f752ae3593138b9ef7a55742cc8046cb5a3bbb9ad'],
  ['265be8b7','salt-hoppers-B5CtpafJ.webp','2436d3ed679c95f9299aacd9e6c83d23d4f5646ccec34841bf1a18a213aa854b'],
  ['265be8b7','frost-rifts-o2wiLWp6.webp','a4ea076646f71280d79444290d1ef341cfd44af423e839767541b8b75bcbdd31'],
  ['265be8b7','ember-basins-GZK_MODY.webp','be8701a91621d4a38761809fa8283d3b10f837cd75977d6d91df393782ea2ed6'],
  ['2f8b45a6','index-Cv085TUZ.js','45c7076c5ca27142800167b8159e516088da0d693a73b90a5bdf864da0768e42'],
  ['2f8b45a6','PlanetPhysics-BUCZC-5P.js','55a9ecf9a906385ed39817ccdd8dfd7414a4c0be1161aa40d4f73fbebcf2b738'],
  ['2f8b45a6','vendor-mmd-Bm4ni5rV.js','a3e8bd6472539eb4e8ad50270d44198ffbf3e89e716e2759ccf54cec916c0eb9'],
  ['2f8b45a6','vendor-three-g-xxlsXH.js','ac323f5c38df94692d8174701f6c95bc596e6c9ce54b244b89ad918359315222'],
  ['2f8b45a6','emulate-B58xIiMi.js','f2713f59c3176483d9ae84ed2f000f4e77047c7a98c542f92db9bfc1175d0915'],
  ['1b995ab7','index-CtM0UrOA.js','6abbed0653cd631f89bdb3ba1017253f1f02b80bdbaa94a2ed6de8f15374f59b'],
  ['1b995ab7','PlanetPhysics-DGDagXjQ.js','83725c723f71e752e4f2faebb4e6b4a086d3abde630011f334df1484a8bdb510'],
  ['1b995ab7','vendor-state-BVgK4CvW.js','829690a58632276e111f36ddc990b1e7804ef3dcaea5c721df817e4c0f254868'],
  ['1b995ab7','vendor-three-HgZdY9RH.js','ac112e801f1773a7fe0963c77685975ef463d155838fe0499bdc37b4cef6b20a'],
  ['1b995ab7','emulate-n8-l-uVH.js','2b30fd6fb648e3c913bb21605fb500e24772438c059afe2005be0a1d971f0051'],
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
