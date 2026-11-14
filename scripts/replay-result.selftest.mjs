// replay-result.selftest.mjs: red and green controls for scripts/replay-result.mjs.
// Builds a tiny synthetic corpus in a temp dir, so it never depends on the real fixtures.
// Run: node scripts/replay-result.selftest.mjs

import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { replayCorpus, serializeResult } from './replay-result.mjs';
import { executionHash } from '../chaingraph/kernels/_hash.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const RULES = resolve(HERE, '..', 'data', 'replay-exclusion-rules.json');

let failed = 0;
const check = (name, ok, detail = '') => {
  console.log(`${ok ? 'PASS' : 'FAIL'} ${name}${ok ? '' : ' :: ' + detail}`);
  if (!ok) failed++;
};

async function fixtureDoc(toolId, specs) {
  const vectors = [];
  for (const [name, pp, op] of specs) vectors.push({ name, policy_parameters: pp, output_payload: op, golden_hash: await executionHash(pp, op) });
  return { tool_id: toolId, note: 'golden_hash pinned (see vectors).', vectors };
}

async function buildCorpus(root, { crlf = false } = {}) {
  const k = join(root, 'chaingraph', 'kernels');
  mkdirSync(join(k, 'fixtures'), { recursive: true });
  const nl = crlf ? '\r\n' : '\n';
  const put = (p, text) => writeFileSync(p, crlf ? text.replace(/\n/g, '\r\n') : text);
  for (const [id, body] of [['901-alpha', 'export const a = 1;\n'], ['902-beta', 'export const b = 2;\n'], ['903-gamma', "export const c = 'ocg-private-input@1';\n"]]) {
    put(join(k, `${id}.kernel.mjs`), body);
    const doc = await fixtureDoc(id, [['v1', { x: 1 }, { y: 2 }], ['v2', { x: 3 }, { y: 4 }]]);
    put(join(k, 'fixtures', `${id}.fixtures.json`), JSON.stringify(doc, null, 2) + '\n');
  }
  return k;
}

const run = async (k) => replayCorpus({ kernelsDir: k, rulesPath: RULES });
const tmp = mkdtempSync(join(tmpdir(), 'replay-selftest-'));
try {
  const a = join(tmp, 'a');
  const ka = await buildCorpus(a);

  // 1. Two runs are byte-identical.
  const r1 = serializeResult((await run(ka)).result);
  const r2 = serializeResult((await run(ka)).result);
  check('two runs give byte-identical results', r1 === r2);
  check('result is LF only, no timestamps or paths', !r1.includes('\r') && !/20\d\d-\d\d-\d\dT/.test(r1) && !r1.includes(tmp.replace(/\\/g, '\\\\')));

  // 2. A changed fixture changes exactly one leaf and the root.
  const base = (await run(ka)).result;
  const f = join(ka, 'fixtures', '902-beta.fixtures.json');
  const doc = JSON.parse(readFileSync(f, 'utf8'));
  doc.vectors[0].output_payload = { y: 99 };
  doc.vectors[0].golden_hash = await executionHash(doc.vectors[0].policy_parameters, doc.vectors[0].output_payload);
  writeFileSync(f, JSON.stringify(doc, null, 2) + '\n');
  const changed = (await run(ka)).result;
  const diffLeaves = Object.keys(base.modules).filter((m) => base.modules[m] !== changed.modules[m]);
  check('a changed fixture changes exactly one leaf', diffLeaves.length === 1, `changed ${diffLeaves.length}`);
  check('a changed fixture changes the root', base.root !== changed.root);
  check('a changed fixture changes the corpus digest', base.corpus_digest !== changed.corpus_digest);

  // 3. An excluded module is absent and counted.
  const green = (await run(ka));
  check('excluded module is counted', green.result.excluded_count === 1 && green.counts.excluded === 1);
  check('excluded module is absent from modules', Object.keys(green.result.modules).length === 2);

  // 4. CRLF input files do not change the output bytes.
  const kc = await buildCorpus(join(tmp, 'crlf'), { crlf: true });
  const ka2 = await buildCorpus(join(tmp, 'a2'));
  check('CRLF input files give identical bytes', serializeResult((await run(kc)).result) === serializeResult((await run(ka2)).result));

  // 5. A commit touching no compute module and no fixture leaves corpus_digest unchanged.
  const before = (await run(ka2)).result.corpus_digest;
  writeFileSync(join(ka2, 'README.md'), 'unrelated change\n');
  writeFileSync(join(ka2, '_helper.mjs'), 'export const h = 1;\n');
  check('unrelated files leave corpus_digest unchanged', (await run(ka2)).result.corpus_digest === before);

  // 6. Red control: a drifted golden is recorded, not dropped, not fatal, and moves the bytes.
  const f2 = join(ka2, 'fixtures', '901-alpha.fixtures.json');
  const d2 = JSON.parse(readFileSync(f2, 'utf8'));
  d2.vectors[1].golden_hash = 'f'.repeat(64);
  writeFileSync(f2, JSON.stringify(d2, null, 2) + '\n');
  const drift = await run(ka2);
  const ids = Object.values(drift.result.mismatches).flat();
  check('a drifted vector is recorded under its module', ids.length === 1 && ids[0] === '901-alpha/v2', JSON.stringify(ids));
  check('a drifted vector still has its module leaf', Object.keys(drift.result.modules).length === 2);

  // 7. Red control for the rules digest: editing the exclusion rules moves corpus_digest.
  const altRules = join(tmp, 'rules.json');
  writeFileSync(altRules, JSON.stringify({ rules: [] }));
  const noRules = await replayCorpus({ kernelsDir: ka2, rulesPath: altRules });
  check('changing the exclusion rules changes corpus_digest', noRules.result.corpus_digest !== drift.result.corpus_digest);
  check('with no rules nothing is excluded', noRules.result.excluded_count === 0);
} finally {
  rmSync(tmp, { recursive: true, force: true });
}

if (failed) { console.error(`\n${failed} control(s) failed`); process.exit(1); }
console.log('\nreplay-result selftest: all controls pass');
