#!/usr/bin/env node
/**
 * scripts/gen-hub-for-hubs-page.test.mjs — HUB-FOR-HUBS-PR-ADVISORY-1.
 *
 * Proves the cluster coverage check in gen-hub-for-hubs-page.mjs judges the FRESH
 * in-memory registry (buildRegistry), not the committed data/infra-registry.json,
 * which is a main-owned derived artifact a PR cannot carry.
 *
 * Controls:
 *   1. a new guide that is on disk and in a cluster passes, even though the
 *      committed registry file has no row for it (the PR case: before the fix
 *      this threw "cluster coverage broken ... not a guide-category registry row")
 *   2. a cluster path that is NOT a published page (absent from the fresh walk)
 *      still throws, in every context (no event split exists)
 *   3. a published guide that sits in no cluster still throws (a new hub page can
 *      never ship unlisted)
 *   4. a path in two clusters still throws
 *   5. the fresh walk of this tree passes cluster coverage
 *
 * Usage: node scripts/gen-hub-for-hubs-page.test.mjs
 */
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { validateClusters } from './gen-hub-for-hubs-page.mjs';
import { buildRegistry } from './gen-infra-registry.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(HERE, '..');
const failures = [];
const ok = (name, cond, detail = '') => {
  if (cond) console.log(`  ✓ ${name}`);
  else { console.error(`  ✗ ${name} ${detail}`); failures.push(name); }
};
const throwsWith = (fn, re) => {
  try { fn(); return false; } catch (e) { return re.test(String(e.message)); }
};
const noShim = () => false;
const row = (path) => ({ category: 'guide', path });

// 1. fresh walk has the row; the committed file (not consulted) does not matter
ok('new guide on disk and in a cluster passes',
  !throwsWith(() => validateClusters([row('guides/new-guide.html')], [{ label: 'A', paths: ['guides/new-guide.html'] }], noShim), /./));

// 2. a path that is not a published guide row still throws
ok('cluster path absent from the fresh walk throws',
  throwsWith(() => validateClusters([row('guides/real.html')], [{ label: 'A', paths: ['guides/real.html', 'guides/nope.html'] }], noShim),
    /names guides\/nope\.html, which is not a guide-category registry row/));

// 3. a published guide in no cluster still throws
ok('published guide in no cluster throws',
  throwsWith(() => validateClusters([row('guides/a.html'), row('guides/b.html')], [{ label: 'A', paths: ['guides/a.html'] }], noShim),
    /guide rows not in any cluster.*guides\/b\.html/));

// 4. duplicate cluster membership still throws
ok('path in two clusters throws',
  throwsWith(() => validateClusters([row('guides/a.html')], [{ label: 'A', paths: ['guides/a.html'] }, { label: 'B', paths: ['guides/a.html'] }], noShim),
    /sits in both "A" and "B"/));

// 5. the real tree: the generator builds from the fresh walk without throwing
// (informational only: on a PR tree the committed registry and page are
// legitimately stale until main regenerates, so equality is NOT asserted here;
// `node scripts/gen-hub-for-hubs-page.mjs --check` is the freshness gate).
const fresh = buildRegistry(REPO);
ok('the fresh walk of this tree passes cluster coverage',
  !throwsWith(() => validateClusters(fresh), /./));

if (failures.length) {
  console.error(`✗ gen-hub-for-hubs-page.test FAILED: ${failures.length} control(s) red.`);
  process.exit(1);
}
console.log('✅ gen-hub-for-hubs-page.test PASSED — coverage judged on the fresh registry; unlisted and dangling paths still throw.');
