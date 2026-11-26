#!/usr/bin/env node
/**
 * Self-test for scripts/check-kernel-errata.mjs and scripts/gen-kernel-erratum.mjs:
 * every gate has a planted red and a green control, run against the three real entries.
 *   node scripts/check-kernel-errata.selftest.mjs
 */
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { REPO_ROOT, SOURCES_DIR, PREDICATES_DIR, lintPredicate } from './lib/kernel-errata.mjs';
import { validateSchema, checkK1, checkK3, checkK5 } from './check-kernel-errata.mjs';
import { buildEntry } from './gen-kernel-erratum.mjs';

let fails = 0;
const expect = (name, cond) => { console.log(`${cond ? 'PASS' : 'FAIL'} ${name}`); if (!cond) fails++; };

const schema = JSON.parse(readFileSync(join(REPO_ROOT, 'chaingraph/errata/kernel-erratum.schema.json'), 'utf8'));
const files = readdirSync(join(REPO_ROOT, SOURCES_DIR)).filter((f) => f.endsWith('.json')).sort();
const records = files.map((f) => ({ file: f, entry: JSON.parse(readFileSync(join(REPO_ROOT, SOURCES_DIR, f), 'utf8')) }));
const clone = (r) => ({ file: r.file, entry: structuredClone(r.entry) });
const art807 = records.find((r) => r.entry.node_id === 'art-807');
expect('three real entries present', records.length >= 3);

// ── K1 ────────────────────────────────────────────────────────────────────────────────
expect('K1 green: every real entry passes', (await checkK1(REPO_ROOT, records, schema)).length === 0);
{
  const r = clone(art807); r.entry.witness.affected.new_execution_hash = r.entry.witness.affected.old_execution_hash;
  expect('K1 red: an affected witness whose hashes are equal', (await checkK1(REPO_ROOT, [r], schema)).length > 0);
}
{
  const r = clone(art807); const w = r.entry.witness; [w.affected, w.unaffected] = [w.unaffected, w.affected];
  expect('K1 red: affected and unaffected vectors swapped', (await checkK1(REPO_ROOT, [r], schema)).length > 0);
}
{
  const r = clone(art807); r.entry.witness.unaffected.policy_parameters_hash = '0'.repeat(64);
  expect('K1 red: policy_parameters_hash does not recompute', (await checkK1(REPO_ROOT, [r], schema)).length > 0);
}
{
  const r = clone(art807); r.entry.kernel_digest_fixed = 'sha256:' + '1'.repeat(64);
  expect('K1 red: fixed digest does not match the blob', (await checkK1(REPO_ROOT, [r], schema)).length > 0);
}
{
  const r = clone(art807); r.entry.affected_predicate.sha256 = 'a'.repeat(64);
  expect('K1 red: predicate sha256 does not match the file', (await checkK1(REPO_ROOT, [r], schema)).length > 0);
}
{
  const r = clone(art807); r.entry.class = 'not-a-class'; r.entry.extra = 1;
  expect('K1 red: schema rejects an unknown class and an extra member', validateSchema(schema, r.entry).length >= 2);
}

// ── K3 ────────────────────────────────────────────────────────────────────────────────
const predicates = new Map(readdirSync(join(REPO_ROOT, PREDICATES_DIR)).filter((f) => f.endsWith('.mjs')).map((f) => [f, readFileSync(join(REPO_ROOT, PREDICATES_DIR, f), 'utf8')]));
expect('K3 green: every real predicate is pure', checkK3(predicates).length === 0);
const wrap = (body, head = '') => `${head}export function affected(pp) {\n${body}\n}\n`;
for (const [name, src] of [
  ['Date', wrap('return Date.now() > 0;')],
  ['Math.random', wrap('return Math.random() > 0.5;')],
  ['fetch', wrap('return fetch("x") !== null;')],
  ['process', wrap('return process.env.X === "1";')],
  ['foreign import', wrap('return true;', 'import { readFileSync } from "node:fs";\n')],
  ['dynamic property access without Object.hasOwn', wrap('const k = "a"; return pp[k] === 1;')],
  ['no affected export', 'export const x = 1;\n'],
]) expect(`K3 red: ${name}`, lintPredicate(src).length > 0);
expect('K3 green: canonicalizer import and guarded dynamic access', lintPredicate(wrap('const k = "a"; return Object.hasOwn(pp, k) && pp[k] === 1;', 'import { jcsStringify } from "../../kernels/_hash.mjs";\n')).length === 0);
expect('K3 green: a forbidden word inside a comment is ignored', lintPredicate(wrap('// Date and process are discussed here\nreturn pp === null;')).length === 0);

// ── K5 ────────────────────────────────────────────────────────────────────────────────
const cur = new Map(); for (const r of records) cur.set(`${SOURCES_DIR}/${r.file}`, JSON.stringify(r.entry));
expect('K5 green: unchanged against itself', checkK5(cur, new Map(cur), records).length === 0);
expect('K5 green: a new entry beside the base', checkK5(cur, new Map([...cur].slice(0, 1)), records).length === 0);
{
  const edited = new Map(cur); const k = [...cur.keys()][0]; edited.set(k, cur.get(k) + ' ');
  expect('K5 red: an existing record edited', checkK5(edited, new Map(cur), records).length > 0);
}
{
  const dropped = new Map(cur); dropped.delete([...cur.keys()][0]);
  expect('K5 red: an existing record deleted', checkK5(dropped, new Map(cur), records).length > 0);
}
{
  const dup = [...records, { file: 'KE-2026-9999.json', entry: { ...records[0].entry } }];
  expect('K5 red: an id reused by a second file', checkK5(cur, null, dup).length > 0);
}
{
  const c = clone(records[0]); c.entry.id = 'KE-2026-9998'; c.file = 'KE-2026-9998.json'; c.entry.corrects = 'KE-2026-4242';
  expect('K5 red: corrects names an entry that does not exist', checkK5(cur, null, [...records, c]).length > 0);
  c.entry.corrects = records[0].entry.id;
  expect('K5 green: a correction names an existing entry', checkK5(cur, null, [...records, c]).length === 0);
}

// ── writer: a predicate that misses a divergent input is refused, and leaves nothing behind ──
{
  const tool = 'art-593-webbotauth-nonce-replay-check';
  const id = 'KE-9999-0001';
  const narrow = 'export function affected(policy_parameters) {\n  return false;\n}\n';
  let msg = '';
  try {
    await buildEntry({ root: REPO_ROOT, toolId: tool, oldRef: '2c54b26ea5^', newRef: '2c54b26ea5', id, cls: 'other', summary: 'Planted control for the writer.', predicateSrc: narrow, publishedAt: '2026-11-14' });
  } catch (e) { msg = e.message; }
  expect('writer red: a too-narrow predicate is refused', /too narrow/.test(msg));
  expect('writer red: the refused predicate leaves no file', !existsSync(join(REPO_ROOT, PREDICATES_DIR, `${id}.mjs`)));
  let lintMsg = '';
  try {
    await buildEntry({ root: REPO_ROOT, toolId: tool, oldRef: '2c54b26ea5^', newRef: '2c54b26ea5', id, cls: 'other', summary: 'Planted control for the writer.', predicateSrc: wrap('return Date.now() > 0;'), publishedAt: '2026-11-14' });
  } catch (e) { lintMsg = e.message; }
  expect('writer red: an impure hand-written predicate is refused (K3)', /K3/.test(lintMsg));
  const mech = await buildEntry({ root: REPO_ROOT, toolId: 'art-807-erc3643-transfer-decision', oldRef: '59a5e7cbc7^', newRef: '59a5e7cbc7', id: 'KE-9999-0002', cls: 'fail-open-missing-input', summary: 'Planted control for the writer.', publishedAt: '2026-11-14' });
  const { rmSync } = await import('node:fs');
  if (mech.created) rmSync(join(REPO_ROOT, mech.entry.affected_predicate.path));
  expect('writer green: the mechanical proposal for art-807 is exact (0 narrow, 0 wide)', mech.stats.too_narrow === 0 && mech.stats.too_wide === 0 && mech.stats.divergent > 0);
}

console.log(fails ? `${fails} FAILED` : 'ALL PASS');
process.exit(fails ? 1 : 0);
