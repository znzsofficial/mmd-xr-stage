// Record the old build before replacing it; restore its immutable URLs after building.
import assert from 'node:assert/strict';
import {hash, randomUUID} from 'node:crypto';
import {link, mkdir, open, readFile, readdir, rm, writeFile} from 'node:fs/promises';
import {dirname, join, resolve} from 'node:path';
import {fileURLToPath, pathToFileURL} from 'node:url';
import {parseArgs} from 'node:util';
import history from './legacy-scene/history.mjs';
import {inspectDist} from './release-artifact.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const manifests = join(root, 'scripts/legacy-scene');
const isBundled = path => path.startsWith('assets/') || path.startsWith('labs/cloth/assets/');
const isDigest = value => typeof value === 'string' && /^[a-f0-9]{64}$/.test(value);

function checkDeployment(id) {
  assert(typeof id === 'string' && /^[a-f0-9]{8}$/.test(id), `Expected a fixed 8-hex Pages deployment ID, got: ${id}`);
}

function checkPath(path) {
  // Only the two builds' content-addressed trees are ours. Fail on new naming
  // conventions instead of silently dropping an asset or restoring a stable URL.
  assert(typeof path === 'string' && isBundled(path) &&
    path.split('/').every(part => part && !/[\\:\u0000-\u001f]|[. ]$/.test(part)) &&
    /-[\w-]{8}\.[\w.]+$/.test(path) && !/\.html?$/i.test(path), `Expected an immutable build asset: ${path}`);
}

function checkSource({revision, dist}) {
  assert(typeof revision === 'string' && /^[a-f0-9]{40}$/.test(revision) &&
    Number.isSafeInteger(dist?.files) && dist.files > 0 && isDigest(dist.sha256), 'Invalid release revision or dist receipt');
}

async function readIfPresent(path) {
  try { return await readFile(path); }
  catch (error) { if (error.code !== 'ENOENT') throw error; }
}

async function loadRecords(directory) {
  const records = new Map();
  const sources = new Map();
  function register(record) {
    const {deployment, path, sha256} = record;
    checkDeployment(deployment);
    checkPath(path);
    assert(isDigest(sha256), `Invalid digest for ${path}`);
    assert(!records.has(path), `Duplicate legacy path: ${path}`);
    records.set(path, record);
  }
  history.forEach(register);
  for (const name of (await readdir(directory)).sort()) {
    if (!name.endsWith('.json')) continue;
    const deployment = name.slice(0, -5);
    checkDeployment(deployment);
    const source = JSON.parse(await readFile(join(directory, name), 'utf8'));
    checkSource(source);
    assert(source.assets && typeof source.assets === 'object' && !Array.isArray(source.assets), `Invalid assets in ${name}`);
    for (const [path, sha256] of Object.entries(source.assets)) register({path, sha256, deployment});
    sources.set(deployment, source);
  }
  return {records, sources};
}

// Publish only complete bytes, including if interrupted or another process wins.
async function writeNew(path, bytes) {
  const temp = `${path}.${randomUUID()}.tmp`;
  try {
    await writeFile(temp, bytes, {flag: 'wx'});
    await link(temp, path);
  } finally {
    await rm(temp, {force: true});
  }
}

export async function recordRelease(deployment, distDir, receiptPath, directory = manifests) {
  checkDeployment(deployment);
  const receipt = JSON.parse(await readFile(receiptPath, 'utf8'));
  checkSource(receipt);
  const {dist, hashes} = await inspectDist(distDir);
  assert.deepEqual(dist, receipt.dist, `Release receipt does not match ${distDir}`);

  // Two different deployments may contribute the same URL. Serialize the
  // read/diff/append; a simultaneous build only sees complete manifest files.
  const lockPath = join(directory, '.record.lock');
  const lock = await open(lockPath, 'wx').catch(error => {
    if (error.code === 'EEXIST') throw Error(`Recording already locked: ${lockPath}`);
    throw error;
  });
  try {
    const {records, sources} = await loadRecords(directory);
    const recorded = sources.get(deployment);
    const assets = {};
    let covered = 0;
    for (const [path, sha256] of hashes) {
      if (!isBundled(path)) continue;
      checkPath(path);
      const previous = records.get(path);
      if (previous) assert.equal(sha256, previous.sha256, `Immutable path changed: ${path}`);
      if (!previous || (recorded && Object.hasOwn(recorded.assets, path))) assets[path] = sha256;
      else covered++;
    }
    const added = Object.keys(assets).length;
    assert(covered + added > 0, 'No build assets in sealed release');
    const source = {revision: receipt.revision, dist, assets};
    if (recorded) {
      assert.deepEqual(source, recorded, `Deployment ${deployment} already recorded with different contents`);
      return {added: 0, covered: covered + added};
    }
    if (added) await writeNew(join(directory, `${deployment}.json`), JSON.stringify(source, null, 2) + '\n');
    return {added, covered};
  } finally {
    await lock.close();
    await rm(lockPath);
  }
}

export async function retainAsset({path, sha256, deployment}, {distDir, cacheDist, cacheAssets, fetchAsset = fetch}) {
  checkPath(path);
  checkDeployment(deployment);
  const destination = join(distDir, path);
  const verify = (bytes, source) => assert.equal(hash('sha256', bytes), sha256, `Unexpected content for ${path} in ${source}`);
  const existing = await readIfPresent(destination);
  if (existing) return verify(existing, distDir);
  let bytes;
  if (cacheDist) bytes = await readIfPresent(join(cacheDist, path));
  // The older cache variable refers to the top-level assets/ only. Never
  // satisfy a lab URL with its basename from another directory.
  if (!bytes && cacheAssets && path.startsWith('assets/')) bytes = await readIfPresent(join(cacheAssets, path.slice(7)));
  if (!bytes) {
    const urlPath = path.split('/').map(encodeURIComponent).join('/');
    const response = await fetchAsset(`https://${deployment}.mmd-xr-stage.pages.dev/${urlPath}`, {signal: AbortSignal.timeout(45000)});
    if (!response.ok) throw Error(`${deployment}/${path}: HTTP ${response.status}`);
    bytes = Buffer.from(await response.arrayBuffer());
  }
  verify(bytes, 'cache or fixed deployment');
  await mkdir(dirname(destination), {recursive: true});
  try { await writeNew(destination, bytes); }
  catch (error) {
    if (error.code !== 'EEXIST') throw error;
    verify(await readFile(destination), distDir);
  }
}

async function retainLegacy(options) {
  const {records} = await loadRecords(manifests);
  const pending = records.values();
  let failure;
  async function worker() {
    for (const record of pending) {
      if (failure) return;
      try { await retainAsset(record, options); }
      catch (error) { failure ??= error; return; }
    }
  }
  await Promise.all(Array.from({length: 6}, worker));
  if (failure) throw failure;
  return records.size;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const {values, positionals} = parseArgs({allowPositionals: true, options: {
    dist: {type: 'string'}, receipt: {type: 'string'},
  }});
  const distDir = resolve(values.dist ?? join(root, 'dist'));
  if (positionals[0] === 'record' && positionals.length === 2) {
    const receipt = values.receipt ?? join(dirname(distDir), 'stage-release.local');
    const {added, covered} = await recordRelease(positionals[1], distDir, receipt);
    console.log(`Verified sealed release for ${positionals[1]}: ${added} new immutable paths, ${covered} already recorded.`);
  } else if (!positionals.length && !values.receipt) {
    const count = await retainLegacy({distDir, cacheDist: process.env.STAGE_LEGACY_DIST, cacheAssets: process.env.STAGE_LEGACY_ASSETS});
    console.log('Verified legacy XR entry files:', count);
  } else {
    throw Error('Usage: retain-legacy-scene.mjs record <deployment-id> [--dist DIR] [--receipt FILE] | retain-legacy-scene.mjs [--dist DIR]');
  }
}
