import assert from 'node:assert/strict';
import {hash} from 'node:crypto';
import {mkdir, mkdtemp, readFile, readdir, rm, writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {dirname, join} from 'node:path';
import test from 'node:test';
import {identifyDist} from './release-artifact.mjs';
import history from './legacy-scene/history.mjs';
import {recordRelease, retainAsset} from './retain-legacy-scene.mjs';

const deployment = '1234abcd';
const revision = 'a'.repeat(40);
const main = 'assets/nested/decoder-Bq1zXxO_.wasm';
const lab = 'labs/cloth/assets/nested/decoder-Bq1zXxO_.wasm';
const worker = 'assets/unreferenced.worker-BtHx023a.js';
const digest = bytes => hash('sha256', bytes);

test('all historical sources, original paths and digests match the 5972872 hand-maintained list', () => {
  assert.equal(history.length, 309);
  assert.equal(digest(JSON.stringify(history)), 'fc180357407b703c53828f324292e50f45c94ae1c4fa1f4867e091332a56bb22');
});

async function put(path, content) {
  await mkdir(dirname(path), {recursive: true});
  await writeFile(path, content);
}

async function fixture(t) {
  const root = await mkdtemp(join(tmpdir(), 'legacy-release-'));
  t.after(() => rm(root, {recursive: true, force: true}));
  const dist = join(root, 'dist'), manifests = join(root, 'manifests'), receipt = join(root, 'stage-release.local');
  await mkdir(manifests);
  const write = (path, content) => put(join(dist, path), content);
  await write('index.html', '<html>prep</html>');
  await write('labs/cloth/index.html', '<html>lab</html>');
  await write('scenery/park.webp', 'unversioned public image');
  await write(main, 'main native');
  await write(lab, 'lab native');
  async function seal() {
    const stamp = {revision, dist: await identifyDist(dist), checks: {mode: 'full'}};
    await writeFile(receipt, JSON.stringify(stamp));
    return stamp;
  }
  const stamp = await seal();
  const record = (id = deployment) => recordRelease(id, dist, receipt, manifests);
  return {root, dist, manifests, receipt, write, stamp, seal, record};
}

test('record keeps original paths, includes indirect files and appends only new URLs', async t => {
  const {dist, manifests, stamp, write, seal, record} = await fixture(t);
  assert.deepEqual(await record(), {added: 2, covered: 0});
  const first = join(manifests, `${deployment}.json`);
  const original = await readFile(first, 'utf8');
  assert.deepEqual(JSON.parse(original), {revision, dist: stamp.dist, assets: {
    [main]: digest('main native'), [lab]: digest('lab native'),
  }});
  assert.deepEqual(await record(), {added: 0, covered: 2});
  assert.deepEqual(await identifyDist(dist), stamp.dist);
  await write(worker, 'not directly linked by either entry');
  await seal();
  await assert.rejects(record(), /already recorded with different contents/);
  const next = '2345bcde';
  assert.deepEqual(await record(next), {added: 1, covered: 2});
  assert.deepEqual(JSON.parse(await readFile(join(manifests, `${next}.json`))).assets, {
    [worker]: digest('not directly linked by either entry'),
  });
  assert.deepEqual(await record(next), {added: 0, covered: 3});
  assert.equal(await readFile(first, 'utf8'), original);
});

test('record rejects an alias, unsealed tree, changed immutable URL and unexpected stable bundle name', async t => {
  const {manifests, receipt, write, seal, record} = await fixture(t);
  await assert.rejects(record('main'), /deployment ID/);
  await write('scenery/park.webp', 'changed outside assets');
  await assert.rejects(record(), /receipt does not match/);
  assert.deepEqual(await readdir(manifests), []);
  await seal();
  await record();
  await write(lab, 'changed after release');
  await seal();
  await assert.rejects(record('abababab'), /Immutable path changed/);
  await write(lab, 'lab native');
  await write('assets/index.html', 'unexpected entry');
  await seal();
  await assert.rejects(record('abababab'), /Expected an immutable build asset/);
  await writeFile(receipt, '{}');
  await assert.rejects(record(), /Invalid release/);
  await rm(receipt);
  await assert.rejects(record(), {code: 'ENOENT'});
  assert.deepEqual(await readdir(manifests), [`${deployment}.json`]);
});

test('restore uses original cache paths, checks existing bytes and never overwrites a collision', async t => {
  const {root, dist: cacheDist} = await fixture(t);
  const distDir = join(root, 'candidate');
  const local = {distDir, cacheDist, fetchAsset: () => assert.fail('Unexpected fetch')};
  const entry = {deployment, path: lab, sha256: digest('lab native')};
  await Promise.all([retainAsset(entry, local), retainAsset(entry, local)]);
  assert.equal(await readFile(join(distDir, lab), 'utf8'), 'lab native');
  await put(join(distDir, lab), 'new build');
  await assert.rejects(retainAsset(entry, local), /Unexpected content/);
  assert.equal(await readFile(join(distDir, lab), 'utf8'), 'new build');
  await rm(join(distDir, lab));
  await put(join(cacheDist, lab), 'wrong cache bytes');
  await assert.rejects(retainAsset(entry, local), /Unexpected content/);
  await assert.rejects(readFile(join(distDir, lab)), {code: 'ENOENT'});
  await retainAsset({...entry, path: main, sha256: digest('main native')}, {
    distDir, cacheAssets: join(cacheDist, 'assets'), fetchAsset: local.fetchAsset,
  });
  assert.equal(await readFile(join(distDir, main), 'utf8'), 'main native');
});

test('missing lab asset fetches its own pinned URL; HTTP errors and 200 SPA fallback cannot install it', async t => {
  const {root, dist} = await fixture(t);
  const entry = {deployment, path: lab, sha256: digest('lab native')};
  const distDir = join(root, 'candidate');
  let response;
  const options = {distDir, cacheAssets: join(dist, 'assets'), fetchAsset: async url => {
    assert.equal(url, `https://${deployment}.mmd-xr-stage.pages.dev/${lab}`);
    return response;
  }};
  response = new Response('not found', {status: 404});
  await assert.rejects(retainAsset(entry, options), /HTTP 404/);
  response = new Response('<html>old index</html>');
  await assert.rejects(retainAsset(entry, options), /Unexpected content/);
  await assert.rejects(readFile(join(distDir, lab)), {code: 'ENOENT'});
  response = new Response('lab native');
  await retainAsset(entry, options);
  assert.equal(await readFile(join(distDir, lab), 'utf8'), 'lab native');
  for (const path of ['assets/../outside-AB123456.js', 'index.html', '/assets/entry-AB123456.js']) {
    await assert.rejects(retainAsset({...entry, path}, options), /Expected an immutable build asset/);
  }
});
