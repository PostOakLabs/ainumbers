// HAGATE-DECL-CROSSCHECK-1 gate — verify.html resolves the DECLARING gate from
// the locally-held chain shard, never from the bundle under test (SO #34).
// Run:  node chaingraph/verify-decl-crosscheck.test.mjs
// Exits non-zero on any failure.
//
// WHY: haLoadBundle used to read gate_policy/gate_threshold out of the bundle
// being verified and evaluate against those values — SO #34's named shape,
// "self-attested provenance validated by a self-consistent checker". A bundle
// declaring auto_pass over a step whose live chain shard declares dual_control
// rendered SATISFIED with zero approval records. The fix layers a declaration
// cross-check OUTSIDE the __haEvaluate twin (which must stay byte-identical to
// bundle-diff.html / verification-desk.html), with exactly three outcomes:
// match / DECLARATION_MISMATCH (evaluated against the SHARD) / NOT_EVALUABLE
// (never a pass — SO #34c).
//
// The pure cross-check functions live in verify.html between the
// __HA_DECL_CROSSCHECK-BEGIN/END markers and are extracted VERBATIM here, so
// the test exercises the exact bytes the page ships — not a re-implementation.

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const PAGE = resolve(HERE, 'verify.html');
const html = readFileSync(PAGE, 'utf8');

const BEGIN = '/* __HA_DECL_CROSSCHECK-BEGIN';
const END = '/* __HA_DECL_CROSSCHECK-END */';
const b = html.indexOf(BEGIN);
const e = html.indexOf(END);
if (b === -1 || e === -1 || e < b) {
  console.error('FAIL: __HA_DECL_CROSSCHECK block markers not found in chaingraph/verify.html — extraction went blind, refusing to pass.');
  process.exit(1);
}
const block = html.slice(b, e);

// The block is pure (no document access); instantiate it and export its functions.
const factory = new Function(block + '\nreturn { __haResolveDeclaredGate, __haDeclGateHashHex, __haDeclThresholdsEqual, __haDeclJcs, __haDeclDescribeGate };');
const { __haResolveDeclaredGate, __haDeclGateHashHex } = factory();

let failures = 0;
function ok(cond, label) {
  if (cond) { console.log('ok   -', label); } else { failures++; console.error('FAIL -', label); }
}

// ── Live shard fixture: mra-consent-order-closure-cycle, the odd
//    dual_control + {approver,1} instance the design SSOT §3 F2 names.
const shard = JSON.parse(readFileSync(join(HERE, 'graph', 'chains', 'mra-consent-order-closure-cycle.json'), 'utf8'));
const shardGate = shard.steps[0].gate;
const LOCAL = { chains: [shard] };

const toolId = shard.steps[0].tool_id;

// RED scenario (SO #34c): a DOCTORED bundle declaring auto_pass against the
// dual_control shard must resolve to DECLARATION_MISMATCH.
const doctored = { gate_policy: 'auto_pass', chain_declaration: { chain: shard.name, step_id: toolId } };
const m1 = __haResolveDeclaredGate({ bundleGate: doctored, toolId, localGraph: LOCAL });
ok(m1.state === 'mismatch', 'doctored auto_pass bundle vs dual_control shard ⇒ mismatch (the RED scenario)');
ok(m1.reason.indexOf('DECLARATION_MISMATCH') === 0, 'mismatch reason leads with DECLARATION_MISMATCH');
ok(m1.shardGate === shardGate, 'mismatch carries the SHARD gate (evaluation must use it, never the bundle\'s)');

// GREEN: matching declaration ⇒ match.
const honest = { gate_policy: shardGate.gate_policy, gate_threshold: shardGate.gate_threshold, chain_declaration: { chain: shard.name, step_id: toolId } };
const m2 = __haResolveDeclaredGate({ bundleGate: honest, toolId, localGraph: LOCAL });
ok(m2.state === 'match', 'honest bundle matching its shard ⇒ match');

// Threshold divergence alone is still a mismatch.
const thrDoctored = { gate_policy: shardGate.gate_policy, gate_threshold: { role: 'approver', threshold: 2 }, chain_declaration: { chain: shard.name, step_id: toolId } };
const m3 = __haResolveDeclaredGate({ bundleGate: thrDoctored, toolId, localGraph: LOCAL });
ok(m3.state === 'mismatch', 'same policy but threshold doctored 1→2 ⇒ mismatch');

// NOT_EVALUABLE — the three offline-unresolvable causes, each NEVER a pass.
const r1 = __haResolveDeclaredGate({ bundleGate: { gate_policy: 'auto_pass' }, toolId, localGraph: LOCAL });
ok(r1.state === 'not_evaluable', 'no chain_declaration ⇒ not_evaluable (never satisfied)');
const r2 = __haResolveDeclaredGate({ bundleGate: doctored, toolId, localGraph: null });
ok(r2.state === 'not_evaluable', 'no local graph ⇒ not_evaluable');
const r3 = __haResolveDeclaredGate({ bundleGate: doctored, toolId, localGraph: { chains: [{ name: 'some-other-chain', steps: [] }] } });
ok(r3.state === 'not_evaluable', 'unknown chain ⇒ not_evaluable');
ok(r1.satisfied === undefined && r2.satisfied === undefined && r3.satisfied === undefined, 'not_evaluable never carries a satisfied flag');

// step_id defaults to the artifact's tool_id.
const m4 = __haResolveDeclaredGate({ bundleGate: { gate_policy: shardGate.gate_policy, gate_threshold: shardGate.gate_threshold, chain_declaration: { chain: shard.name } }, toolId, localGraph: LOCAL });
ok(m4.state === 'match', 'step_id omitted ⇒ defaults to tool_id and resolves');

// gate_sha256 is recomputable and stable over the JCS canonicalization.
(async () => {
  const hex = await __haDeclGateHashHex(shardGate);
  ok(/^[0-9a-f]{64}$/.test(hex), 'declaring-gate hash is sha256 hex over JCS(gate)');
  const hex2 = await __haDeclGateHashHex(JSON.parse(JSON.stringify({ gate_threshold: shardGate.gate_threshold, rules: shardGate.rules, default: shardGate.default, input: shardGate.input, gate_policy: shardGate.gate_policy })));
  ok(hex === hex2, 'declaring-gate hash is key-order independent (JCS)');
  const mutated = JSON.parse(JSON.stringify(shardGate)); mutated.gate_policy = 'auto_pass';
  ok(await __haDeclGateHashHex(mutated) !== hex, 'mutated declaring gate hashes differently (mutation-sensitive)');

  // Twin-integrity guard: the cross-check must be layered OUTSIDE the
  // __haEvaluate twin, which this row must NOT modify. Assert that the
  // shipped block is UNCHANGED from the pre-row worktree state (git HEAD of
  // the branch base) — i.e. this change's diff does not intersect it.
  // GIT-ENV-LEAK-SWEEP-1 / SO #57: every git child goes through the shared
  // scrubbed-env wrapper, never a bare execFileSync('git', …).
  const { gitSync } = await import('../../scripts/_git-env-lib.mjs');
  const base = gitSync(['merge-base', 'HEAD', 'origin/main'], { cwd: HERE }).trim();
  const baseHtml = gitSync(['show', `${base}:chaingraph/verify.html`], { cwd: HERE, maxBuffer: 32 * 1024 * 1024 });
  const sig = 'function __haEvaluate({ gatePolicy, threshold, role, subjectHash, records, nowISO }) {';
  function twinBlock(src) { const i = src.indexOf(sig); const j = src.indexOf('\n}', i); return src.slice(i, j); }
  ok(twinBlock(baseHtml) === twinBlock(html), '__haEvaluate twin block byte-identical to the pre-change branch base (cross-check layered outside it)');

  if (failures) { console.error(`\n${failures} failure(s)`); process.exit(1); }
  console.log('\nall declaration cross-check vectors green');
})().catch((err) => { console.error('FAIL -', err); process.exit(1); });
