// replay-lib.test.mjs: gates R1 (corpus result sets, node plus a second engine) and R4 (honest unresolved),
// each with a red control. R3 (identity over every golden vector) is replay-lib.identity.test.mjs.
//
//   node chaingraph/replay-lib.test.mjs               run R1 and R4 with their red controls
//   node chaingraph/replay-lib.test.mjs --emit        child mode: print the corpus results as JSON (used for the second engine)
import { readFileSync, readdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { executionHash, jcsStringify } from './kernels/_hash.mjs';
import { replayReceipt, replayFile, nodeKernelLoader, parseReceipt, STATES, MAX_POINTERS, diffPointers } from './replay-lib.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const KDIR = resolve(HERE, 'kernels');
const CORPUS = resolve(KDIR, '__replay__', 'corpus');
const load = nodeKernelLoader(KDIR);

const corpusFiles = () => readdirSync(CORPUS).filter((f) => f.endsWith('.receipt.json')).sort();
const readJson = (p) => JSON.parse(readFileSync(p, 'utf8'));

/** Replay the whole corpus in modes A, B and C. Returns the same shape as expected.json. */
export async function runCorpus(loadKernel = load) {
  const exp = readJson(resolve(CORPUS, 'expected.json'));
  const got = { modeA: {}, modeB: {}, modeC: { edits: exp.modeC.edits, results: {} } };
  for (const f of corpusFiles()) {
    const rec = readJson(resolve(CORPUS, f));
    const a = await replayReceipt(rec, { mode: 'A', loadKernel });
    const b = await replayReceipt(rec, { mode: 'B', loadKernel });
    const c = await replayReceipt(rec, { mode: 'C', loadKernel, edits: exp.modeC.edits[rec.tool_id] });
    got.modeA[f] = { state: a.state, pointers: a.pointers };
    got.modeB[f] = { state: b.state };
    got.modeC.results[f] = { state: c.state, pointers: c.pointers };
  }
  return got;
}

const failures = [];
const check = (cond, msg) => { if (!cond) failures.push(msg); };

/** R1 comparison of a result set against the pinned one. Returns a list of mismatch messages. */
export function compareToExpected(got, exp) {
  const bad = [];
  const eq = (a, b) => jcsStringify(a) === jcsStringify(b);
  if (!eq(Object.keys(got.modeA).sort(), Object.keys(exp.modeA).sort())) bad.push('mode A file set differs from expected.json');
  for (const f of Object.keys(exp.modeA)) {
    if (!eq(got.modeA[f], exp.modeA[f])) bad.push(`mode A ${f}: got ${JSON.stringify(got.modeA[f])} expected ${JSON.stringify(exp.modeA[f])}`);
    if (!eq(got.modeB[f], exp.modeB[f])) bad.push(`mode B ${f}: got ${JSON.stringify(got.modeB[f])} expected ${JSON.stringify(exp.modeB[f])}`);
    if (!eq(got.modeC.results[f], exp.modeC.results[f])) bad.push(`mode C ${f}: got ${JSON.stringify(got.modeC.results[f])} expected ${JSON.stringify(exp.modeC.results[f])}`);
  }
  return bad;
}

async function emit() {
  console.log(JSON.stringify(await runCorpus()));
}

function secondEngine() {
  for (const bin of ['bun']) {
    const r = spawnSync(bin, ['--version'], { encoding: 'utf8' });
    if (r.status === 0) return bin;
  }
  return null;
}

async function main() {
  const exp = readJson(resolve(CORPUS, 'expected.json'));
  const files = corpusFiles();

  // ---- corpus shape: twenty receipts, five nodes
  check(files.length === 20, `corpus must hold 20 receipts, found ${files.length}`);
  const nodes = new Set(files.map((f) => readJson(resolve(CORPUS, f)).tool_id));
  check(nodes.size === 5, `corpus must span 5 nodes, found ${nodes.size}`);

  // ---- R1: the pinned result sets, on this engine
  const got = await runCorpus();
  for (const m of compareToExpected(got, exp)) failures.push(`R1 ${m}`);
  // Independent of the pinned file: every "genuine" receipt must replay SAME in mode A with equal hashes.
  for (const f of files.filter((x) => x.includes('.genuine-'))) {
    const r = await replayReceipt(readJson(resolve(CORPUS, f)), { mode: 'A', loadKernel: load });
    check(r.state === STATES.SAME && r.old_execution_hash === r.new_execution_hash, `R1 genuine ${f} is ${r.state}, not SAME with equal hashes`);
  }
  // Every stale receipt must be a valid receipt (its own hash holds) that mode A reports as changed.
  for (const f of files.filter((x) => x.includes('.stale-'))) {
    const r = await replayReceipt(readJson(resolve(CORPUS, f)), { mode: 'A', loadKernel: load });
    check(r.state === STATES.CHANGED_VERDICT || r.state === STATES.CHANGED_VALUE, `R1 stale ${f} is ${r.state}, expected a CHANGED state`);
  }
  // Every state class is exercised by the pinned sets.
  const seen = new Set([...Object.values(exp.modeA), ...Object.values(exp.modeB), ...Object.values(exp.modeC.results)].map((x) => x.state));
  for (const s of [STATES.SAME, STATES.CHANGED_VERDICT, STATES.CHANGED_VALUE, STATES.UNRESOLVED]) check(seen.has(s), `R1 pinned sets never exercise ${s}`);

  // ---- R1 second engine (the same corpus replayed in a child process under another JS engine)
  const eng = secondEngine();
  let engines = 'node';
  if (eng) {
    const r = spawnSync(eng, [fileURLToPath(import.meta.url), '--emit'], { encoding: 'utf8', maxBuffer: 1 << 26 });
    if (r.status !== 0) failures.push(`R1 second engine (${eng}) exited ${r.status}: ${(r.stderr || '').slice(0, 300)}`);
    else {
      let other = null;
      try { other = JSON.parse(r.stdout.trim().split('\n').pop()); } catch { failures.push(`R1 second engine (${eng}) printed no JSON`); }
      if (other) for (const m of compareToExpected(other, exp)) failures.push(`R1 [${eng}] ${m}`);
      engines = `node, ${eng}`;
    }
  } else {
    console.log('R1 second engine: bun not installed here; skipped (advisory). CI engine parity covers the kernels themselves.');
  }

  // ---- R1 red control: a loader whose kernels lie must produce mismatches against the pinned sets
  const liar = async (id) => { const real = await load(id); return real && { compute: () => ({ output_payload: { verdict: 'FAIL', injected: true } }), meta: real.meta }; };
  const liarGot = await runCorpus(liar);
  check(compareToExpected(liarGot, exp).length > 0, 'R1 CONTROL: a lying kernel matched the pinned result sets; the gate cannot go red');

  // ---- R4: honest unresolved. Planted inputs each give their documented state and never SAME.
  const base = readJson(resolve(CORPUS, files[0]));
  const forged = async (patch) => { const r = { ...base, ...patch }; r.execution_hash = await executionHash(r.policy_parameters, r.output_payload); return r; };
  const r4 = async (replay) => {
    const out = {};
    out.unknownNode = await replay('unknown-node.json', JSON.stringify(await forged({ tool_id: 'art-99999-no-such-node' })), { mode: 'A', loadKernel: load });
    out.malformedJson = await replay('malformed.json', '{"tool_id": ', { mode: 'A', loadKernel: load });
    out.notAnObject = await replay('array.json', '[1,2,3]', { mode: 'A', loadKernel: load });
    out.missingField = await replay('missing.json', JSON.stringify({ tool_id: base.tool_id, policy_parameters: base.policy_parameters }), { mode: 'A', loadKernel: load });
    out.tamperedPayload = await replay('tampered-payload.json', JSON.stringify({ ...base, output_payload: { ...base.output_payload, injected: 1 } }), { mode: 'A', loadKernel: load });
    out.tamperedParams = await replay('tampered-params.json', JSON.stringify({ ...base, policy_parameters: { ...base.policy_parameters, injected: 1 } }), { mode: 'A', loadKernel: load });
    out.tamperedHash = await replay('tampered-hash.json', JSON.stringify({ ...base, execution_hash: 'a'.repeat(64) }), { mode: 'A', loadKernel: load });
    out.traversalId = await replay('traversal.json', JSON.stringify({ ...base, tool_id: '../../etc/passwd' }), { mode: 'A', loadKernel: load });
    out.modeBHardCoded = await replay('mode-b.json', JSON.stringify(base), { mode: 'B', loadKernel: load });
    out.modeBTampered = await replay('mode-b-tampered.json', JSON.stringify({ ...base, execution_hash: 'b'.repeat(64) }), { mode: 'B', loadKernel: load });
    return out;
  };
  const wantR4 = {
    unknownNode: STATES.UNRESOLVED,
    malformedJson: STATES.TAMPERED_OR_MALFORMED,
    notAnObject: STATES.TAMPERED_OR_MALFORMED,
    missingField: STATES.TAMPERED_OR_MALFORMED,
    tamperedPayload: STATES.TAMPERED_OR_MALFORMED,
    tamperedParams: STATES.TAMPERED_OR_MALFORMED,
    tamperedHash: STATES.TAMPERED_OR_MALFORMED,
    traversalId: STATES.TAMPERED_OR_MALFORMED,
    modeBHardCoded: STATES.UNRESOLVED,
    modeBTampered: STATES.TAMPERED_OR_MALFORMED,
  };
  const r4Check = (res) => {
    const bad = [];
    for (const [k, want] of Object.entries(wantR4)) {
      const got = res[k];
      if (!got) bad.push(`${k}: no result`);
      else if (got.state === STATES.SAME) bad.push(`${k}: reported SAME`);
      else if (got.state !== want) bad.push(`${k}: got ${got.state}, documented ${want}`);
    }
    return bad;
  };
  const real = await r4(replayFile);
  for (const m of r4Check(real)) failures.push(`R4 ${m}`);
  check(/not on this site/.test(real.unknownNode.reason || ''), 'R4 unknown node must say the node is not on this site');
  check(/vintage/.test(real.modeBHardCoded.reason || ''), 'R4 mode B must give a reason');
  // R4 red control: a replay that says SAME for everything must be caught.
  const alwaysSame = async (name, input, opts) => ({ file: name, state: STATES.SAME, mode: opts.mode });
  check(r4Check(await r4(alwaysSame)).length === Object.keys(wantR4).length, 'R4 CONTROL: an always-SAME replay was not caught on every planted input');

  // ---- parse and diff unit checks
  check(parseReceipt(JSON.stringify({ artifact: base })).ok, 'parseReceipt must accept the artifact wrapper form');
  const many = diffPointers({ a: Array.from({ length: 50 }, (_, i) => i) }, { a: Array.from({ length: 50 }, (_, i) => i + 1) });
  check(many.length === 50, 'diffPointers must find all 50 differing members');
  const wide = await replayReceipt(await (async () => {
    const pp = readJson(resolve(CORPUS, files[0])).policy_parameters; return { ...base, policy_parameters: pp };
  })(), { mode: 'A', loadKernel: load });
  check(wide.pointers.length <= MAX_POINTERS, 'pointer list is capped');

  if (failures.length) {
    console.error(`replay-lib tests RED (${failures.length}):\n  ${failures.slice(0, 40).join('\n  ')}`);
    process.exit(1);
  }
  console.log(`replay-lib tests OK: R1 ${files.length} receipts x 3 modes on ${engines}, red control caught; R4 ${Object.keys(wantR4).length} planted inputs, none SAME, red control caught`);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  if (process.argv.includes('--emit')) await emit(); else await main();
}
