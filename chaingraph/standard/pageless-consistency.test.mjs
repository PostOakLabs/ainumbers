#!/usr/bin/env node
/**
 * pageless-consistency.test.mjs — controls for OCG Standard §NODEPAGE-1.
 *
 * SO #40(b): a new gate proves RED before GREEN. These controls run both directions on
 * every clause of §NODEPAGE-1, and the false-declaration control uses art-662's REAL
 * pre-fix shard (byte-exact, extracted from commit 2d52eb95) rather than a hand-written
 * imitation of it.
 *
 * SO #34: the checker is verified BY MUTATION, never by reading it. Control 6 flips the
 * one input each verdict is supposed to depend on and asserts the verdict flips with it,
 * so a checker that always returned PASS (or always FAIL) cannot survive this file.
 *
 * Controls:
 *   1  pageless + NO page owned                       => PASS
 *   2  pageless + a resolving page (art-662 pre-fix)  => HARD FAIL (false-declaration)
 *   3  a normal page-bearing node with no pageless    => unchanged (N-A, page resolves,
 *                                                        and the whole-estate sweep is green)
 *   4  a catalog carrying a pageless node             => SCHEMA-VALID, and INVALID under the
 *                                                        same schema with the property removed
 *   5  a malformed pageless value (SO #34c)           => its own distinct FAIL, never a skip-pass
 *   6  mutation sensitivity                            => each verdict flips when its one
 *                                                        deciding input flips
 *
 * Usage: node chaingraph/standard/pageless-consistency.test.mjs
 */
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync, existsSync, mkdtempSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { REPO_ROOT, resolveOwnPage, checkPageless } from './check-pageless-consistency.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const FIXTURES = resolve(HERE, 'fixtures', 'pageless');
const SCHEMA_PATH = resolve(HERE, 'openchain-graph-v0.4.schema.json');
const VALIDATOR = resolve(HERE, 'schema-validate.mjs');

let pass = 0;
const failures = [];

function ok(label, cond, detail = '') {
  if (cond) { pass++; console.log(`✓ ${label}`); }
  else { failures.push(`${label}${detail ? ` — ${detail}` : ''}`); console.error(`✗ ${label}${detail ? ` — ${detail}` : ''}`); }
}

const readFixture = (name) => JSON.parse(readFileSync(join(FIXTURES, name), 'utf8'));

// ── Control 1 — pageless + NO page owned => PASS ────────────────────────────────────
const legal = readFixture('legal-pageless.shard.json');
const v1 = checkPageless(REPO_ROOT, legal.tool_id, legal);
ok('C1 GREEN · pageless with no page owned PASSES', v1.status === 'PASS', `got ${v1.status}: ${v1.detail}`);
ok('C1 GREEN · no page resolves for the legal fixture',
  resolveOwnPage(REPO_ROOT, legal.tool_id, legal) === null,
  'resolveOwnPage found a page for a node the fixture says owns none');

// ── Control 2 — art-662's real pre-fix shard => HARD FAIL ───────────────────────────
const preFix = readFixture('art-662-pre-fix.shard.json');
const PRE_FIX_PAGE = 'tools/662-odnsf-fee-recompute.html';
ok(`C2 precondition · ${PRE_FIX_PAGE} exists in the tree`,
  existsSync(resolve(REPO_ROOT, PRE_FIX_PAGE)),
  'the fixture models a FALSE declaration, which requires the page it points at to exist');
const v2 = checkPageless(REPO_ROOT, preFix.tool_id, preFix);
ok('C2 RED · art-662 pre-fix shard HARD FAILS', v2.status === 'FAIL', `got ${v2.status}`);
ok('C2 RED · the failure is classified false-declaration', v2.reason === 'false-declaration', `got reason ${v2.reason}`);
ok('C2 RED · the failure names the page that contradicts the waiver',
  v2.detail.includes(PRE_FIX_PAGE), `detail did not name ${PRE_FIX_PAGE}: ${v2.detail}`);
ok('C2 RED · the shard really did declare pageless',
  typeof preFix.pageless === 'string' && preFix.pageless.length > 0,
  'fixture drift: the pinned pre-fix shard no longer carries the key the control exists to catch');

// ── Control 3 — a normal page-bearing node with no pageless is unchanged ────────────
const NODES_DIR = resolve(REPO_ROOT, 'chaingraph', 'graph', 'nodes');
let pageBearing = null;
for (const f of readdirSync(NODES_DIR).filter((n) => n.endsWith('.json')).sort()) {
  let shard; try { shard = JSON.parse(readFileSync(join(NODES_DIR, f), 'utf8')); } catch { continue; }
  if ('pageless' in shard) continue;
  const id = f.slice(0, -5);
  if (resolveOwnPage(REPO_ROOT, id, shard)) { pageBearing = { id, shard }; break; }
}
ok('C3 · found a real page-bearing node with no pageless in the estate', pageBearing !== null);
if (pageBearing) {
  const v3 = checkPageless(REPO_ROOT, pageBearing.id, pageBearing.shard);
  ok(`C3 · ${pageBearing.id} is N-A (untouched by §NODEPAGE-1)`, v3.status === 'N-A', `got ${v3.status}`);
}
const sweep = run('node', [resolve(HERE, 'check-pageless-consistency.mjs'), '--quiet'], REPO_ROOT);
ok('C3 · whole-estate sweep is GREEN (no existing node is newly failed)', sweep.code === 0,
  `exit ${sweep.code}: ${sweep.out.slice(-400)}`);

// ── Control 4 — assembly of a pageless node yields a SCHEMA-VALID catalog ───────────
const TMP = mkdtempSync(join(tmpdir(), 'pageless-ctl-'));
const EMPTY_FIXTURES = mkdtempSync(join(tmpdir(), 'pageless-nofix-'));
const catalogFixture = join(FIXTURES, 'catalog-with-pageless.chaingraph.json');

const green = runValidator(SCHEMA_PATH, catalogFixture);
ok('C4 GREEN · a chaingraph.json carrying a pageless node validates against the v0.4 schema',
  green.code === 0, `exit ${green.code}: ${green.out.slice(-600)}`);

// RED half by MUTATION: the same schema with the new property removed is the pre-change
// schema, and the same document must then be rejected by additionalProperties:false.
const mutated = JSON.parse(readFileSync(SCHEMA_PATH, 'utf8'));
ok('C4 precondition · the schema declares pageless on $defs/node',
  Object.prototype.hasOwnProperty.call(mutated.$defs.node.properties, 'pageless'));
delete mutated.$defs.node.properties.pageless;
const MUTATED_SCHEMA = join(TMP, 'schema-without-pageless.json');
writeFileSync(MUTATED_SCHEMA, JSON.stringify(mutated, null, 2));
const red = runValidator(MUTATED_SCHEMA, catalogFixture);
ok('C4 RED · the same catalog is INVALID under the schema with pageless removed', red.code !== 0,
  `expected a non-zero exit, got ${red.code}`);
ok('C4 RED · the rejection names pageless', /pageless/.test(red.out), `stderr did not name pageless: ${red.out.slice(-600)}`);

// The live catalog must still validate under the amended schema (ADDITIVE-ONLY proof).
const liveCatalog = resolve(REPO_ROOT, 'chaingraph', 'chaingraph.json');
if (existsSync(liveCatalog)) {
  const live = runValidator(SCHEMA_PATH, liveCatalog);
  ok('C4 ADDITIVE · the live chaingraph.json still validates under the amended schema', live.code === 0,
    `exit ${live.code}: ${live.out.slice(-600)}`);
}

// ── Control 5 — malformed declaration is its own FAIL state (SO #34c) ───────────────
for (const [label, value] of [['boolean true', true], ['empty string', ''], ['whitespace', '   '], ['null', null]]) {
  const bad = { ...legal, pageless: value };
  const v = checkPageless(REPO_ROOT, bad.tool_id, bad);
  ok(`C5 · pageless as ${label} FAILS as malformed-declaration`,
    v.status === 'FAIL' && v.reason === 'malformed-declaration', `got ${v.status}/${v.reason}`);
}

// ── Control 6 — mutation sensitivity: each verdict tracks its one deciding input ────
const preFixWithoutKey = { ...preFix };
delete preFixWithoutKey.pageless;
ok('C6 mutation · dropping pageless from the pre-fix shard flips FAIL -> N-A',
  checkPageless(REPO_ROOT, preFix.tool_id, preFixWithoutKey).status === 'N-A');

const legalPointedAtAPage = { ...legal, url: `https://ainumbers.co/${PRE_FIX_PAGE}` };
const v6 = checkPageless(REPO_ROOT, legal.tool_id, legalPointedAtAPage);
ok('C6 mutation · pointing the legal fixture at a real page flips PASS -> FAIL',
  v6.status === 'FAIL' && v6.reason === 'false-declaration', `got ${v6.status}/${v6.reason}`);

const legalAtACanonicalPagePath = { ...legal };
const anyNodePage = readdirSync(resolve(REPO_ROOT, 'chaingraph'))
  .filter((f) => /^art-.+\.html$/.test(f)).sort()[0];
ok('C6 precondition · at least one canonical chaingraph/art-*.html node page exists', !!anyNodePage);
if (anyNodePage) {
  const idOfThatPage = anyNodePage.replace(/\.html$/, '');
  const v6b = checkPageless(REPO_ROOT, idOfThatPage, legalAtACanonicalPagePath);
  ok('C6 mutation · the canonical chaingraph/<id>.html path alone also flips PASS -> FAIL',
    v6b.status === 'FAIL' && v6b.reason === 'false-declaration', `got ${v6b.status}/${v6b.reason}`);
}

// ── helpers ─────────────────────────────────────────────────────────────────────────
function run(cmd, args, cwd, env = {}) {
  try {
    const out = execFileSync(cmd, args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], env: { ...process.env, ...env } });
    return { code: 0, out };
  } catch (e) {
    return { code: e.status ?? 1, out: `${e.stdout || ''}${e.stderr || ''}` };
  }
}

function runValidator(schemaPath, catalogPath) {
  return run('node', [VALIDATOR], REPO_ROOT, {
    SCHEMA: schemaPath, CHAINGRAPH: catalogPath, FIXTURES_DIR: EMPTY_FIXTURES,
  });
}

console.log(`\npageless-consistency.test: ${pass} passed, ${failures.length} failed.`);
if (failures.length) {
  console.error('\nFAILED:');
  for (const f of failures) console.error(`  - ${f}`);
  process.exit(1);
}
console.log('✓ §NODEPAGE-1 controls green (RED and GREEN halves both exercised).');
