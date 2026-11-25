import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,rename,rm,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {identifyDist} from './release-artifact.mjs';

test('promotion fingerprints old-tab files as well as the two entry pages, including a rename with identical bytes',async t=>{
  const root=await mkdtemp(join(tmpdir(),'stage-artifact-'));t.after(()=>rm(root,{force:true,recursive:true}));
  await mkdir(join(root,'labs/cloth'),{recursive:true});await writeFile(join(root,'index.html'),'prep');
  await assert.rejects(identifyDist(root),/missing labs\/cloth/);
  await writeFile(join(root,'labs/cloth/index.html'),'lab');const entries=await identifyDist(root);
  await writeFile(join(root,'old.js'),'legacy');const prepared=await identifyDist(root);assert.notDeepEqual(prepared,entries);
  await rename(join(root,'old.js'),join(root,'other.js'));assert.notEqual((await identifyDist(root)).sha256,prepared.sha256);
  await rename(join(root,'other.js'),join(root,'old.js'));await writeFile(join(root,'old.js'),'edited');assert.notEqual((await identifyDist(root)).sha256,prepared.sha256);
});
