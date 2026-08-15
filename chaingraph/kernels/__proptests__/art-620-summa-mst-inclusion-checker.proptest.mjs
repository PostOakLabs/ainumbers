// art-620-summa-mst-inclusion-checker — class-B PROPERTY-TEST FLOOR (NODE-REG-UNBLOCK-1).
// kernel_digest_at_authoring: sha256:2dc3bf8bb1f5ae7c1d3c1023fdd8c19a1abd94fae7105f93541303cf0f9c77a6
// spec: workspace-root SUMMA-MST-BUILD-SPEC.md (kernel header cites §5a/§4/§3/§2)
// human_sign_off: PENDING
//
// WHY THIS FILE EXISTS: SUMMA-MST-K-1 shipped art-620's kernel and fixtures but no floor, so
// FV-COVERAGE-GATE-1 classified the node "missing" and NODE-REGISTRATION-GAP-1 had to hold its
// registration back behind a named PAGE_BLOCKED_WAIVER. This floor clears that blocker.
//
// SCOPE: floor tier only (FV-PBT-FLOOR-BUILD-SPEC.md, class B — bounded decision logic over a
// hash/sum chain with a declared MAX_PATH_DEPTH ceiling of 64 and a declared MAX_BALANCE domain
// bound). NOT a proof, NOT Dafny. Internal engineering QC only.
//
// float_sensitive: NO. Every balance and sum in this kernel is parsed to BigInt through a strict
// /^-?\d+$/ decimal-string gate and added with BigInt arithmetic; there is no division, no IEEE-754
// accumulation, and no threshold compare on a float anywhere in compute(). The only Number-typed
// quantity is path length, compared against an integer ceiling.
//
// ZERO external dependencies — Node built-ins only.
//
// ── THE INDEPENDENT ORACLE, stated plainly (STANDING-ORDERS.md #34) ──────────────────────────────
// The kernel hand-rolls SHA-256 in pure JS because the zkVM guest has no host crypto and no
// TextEncoder (GUEST-BUILTIN-GATE-1). A floor that re-used the kernel's own _sha256 to build its
// test trees would be the exact "self-consistent checker" shape #34 names: checker and checked
// sharing one implementation, agreeing with each other while both being wrong.
//
// So P2 below builds every test tree with **node:crypto's createHash('sha256')** — a genuinely
// independent SHA-256 implementation, and a Node built-in, so this adds no dependency. That makes P2
// a real differential test of the kernel's hand-rolled SHA-256 AND of its chain-walk algorithm at
// the same time. (Contrast art-595's floor, which declined to re-derive Keccak-f[1600] from spec
// text: there is no Keccak in node:crypto, so no independent oracle was available there. Here one
// is, so this floor uses it.)
//
// Checks: fixture-oracle gate (P0), totality over hostile inputs (P1), the node:crypto differential
// re-derivation just described (P2), the Maxwell "broken MST" hazard the kernel exists to defend
// against (P3, eprint 2022/043 §4.1 — an inflated leaf hidden by a negative sibling that cancels in
// the sum), single-mutation tamper detection (P4), determinism (P5), forced categorical boundary
// cases including the MAX_PATH_DEPTH and MAX_BALANCE edges (P6), and output-shape sanity (P7).
//
// Run: node chaingraph/kernels/__proptests__/art-620-summa-mst-inclusion-checker.proptest.mjs

import { createHash } from 'node:crypto';
import { compute } from '../art-620-summa-mst-inclusion-checker.kernel.mjs';
import { runFixtureOracle, findShapeViolations, summarize, mulberry32, pickNasty, nullProtoClone } from './_pbt-common.mjs';

const KERNEL_ID = 'art-620-summa-mst-inclusion-checker';

const MAX_PATH_DEPTH = 64;                          // kernel's declared ceiling
const DEFAULT_MAX_BALANCE = '1000000000000000000';  // kernel's declared domain bound

// ── independent MST oracle (node:crypto, NOT the kernel's hand-rolled SHA-256) ───────────────────
// Layout per the kernel's own documented spec §2:
//   leaf   : hash = H(id + '|' + balance)                     sum = balance
//   middle : hash = H(sum + '|' + left.hash + '|' + right.hash) sum = left.sum + right.sum
function h(s) { return createHash('sha256').update(String(s), 'utf8').digest('hex'); }
function oracleLeafHash(id, balanceStr) { return h(id + '|' + balanceStr); }
function oracleMiddleHash(sumStr, hashLeft, hashRight) { return h(sumStr + '|' + hashLeft + '|' + hashRight); }

// Build a full binary tree over `leaves` (length must be a power of two) and return
// { root:{hash,sum}, proofFor(index) } — all hashing done by the independent oracle above.
function buildTree(leaves) {
  let level = leaves.map((l) => ({ hash: oracleLeafHash(l.id, l.balance.toString()), sum: l.balance }));
  const levels = [level];
  while (level.length > 1) {
    const next = [];
    for (let i = 0; i < level.length; i += 2) {
      const L = level[i], R = level[i + 1];
      const sum = L.sum + R.sum;
      next.push({ hash: oracleMiddleHash(sum.toString(), L.hash, R.hash), sum });
    }
    level = next;
    levels.push(level);
  }
  const root = level[0];
  function proofFor(index) {
    const path = [];
    let idx = index;
    for (let d = 0; d < levels.length - 1; d++) {
      const sibIdx = idx ^ 1;
      const sib = levels[d][sibIdx];
      // `side` states which side the SIBLING sits on.
      path.push({ side: sibIdx < idx ? 'left' : 'right', sibling_hash: sib.hash, sibling_sum: sib.sum.toString() });
      idx = idx >> 1;
    }
    return path;
  }
  return { root: { hash: root.hash, sum: root.sum.toString() }, proofFor };
}

function hexId(rng, bytes = 4) {
  let s = '';
  for (let i = 0; i < bytes * 2; i++) s += '0123456789abcdef'[Math.floor(rng() * 16)];
  return s;
}

// Build a random valid tree + a valid proof for one of its leaves.
function randomCase(rng, depth) {
  const n = 1 << depth;
  const leaves = [];
  for (let i = 0; i < n; i++) {
    leaves.push({ id: hexId(rng), balance: BigInt(Math.floor(rng() * 1e9)) });
  }
  const tree = buildTree(leaves);
  const index = Math.floor(rng() * n);
  return {
    pp: {
      root: tree.root,
      max_balance: DEFAULT_MAX_BALANCE,
      proof: { leaf: { id: leaves[index].id, balance: leaves[index].balance.toString() }, path: tree.proofFor(index) },
    },
    tree,
    index,
    leaves,
  };
}

// ── P1: TOTALITY — never throws, whatever hostile shape arrives ──────────────────────────────────
// DOMAIN, stated explicitly because P1b below depends on it: this kernel is reached over MCP/JSON,
// so its declared input domain is the JSON-representable values. `JSON.parse` never yields a
// null-prototype object (asserted in P1b), so P1 fuzzes the JSON-representable subset of the shared
// nasty generator and P1b probes the out-of-domain remainder separately and visibly. This is a
// STATED SCOPE, not a silent generator weakening: nothing the generator produces goes unexercised,
// and the out-of-domain result is printed rather than dropped.
function isNullProto(v) { return v !== null && typeof v === 'object' && Object.getPrototypeOf(v) === null; }
function pickNastyJsonish(rng) {
  for (let i = 0; i < 24; i++) { const v = pickNasty(rng); if (!isNullProto(v)) return v; }
  return null;
}

function checkP1_totality() {
  const rng = mulberry32(620001);
  let checked = 0, violations = 0;
  const shapes = [
    undefined, null, {}, { proof: null }, { proof: {} }, { proof: { leaf: null, path: null } },
    { root: null, proof: { leaf: {}, path: [] } },
    { root: {}, proof: { leaf: { id: 'aa', balance: '1' }, path: {} } },
    { root: { hash: 'zz', sum: 'x' }, proof: { leaf: { id: 'aa', balance: '1' }, path: [null] } },
    { max_balance: 5, proof: { leaf: { id: 'aa', balance: '1' }, path: [] } },
  ];
  for (const pp of shapes) {
    checked++;
    try {
      const r = compute(pp);
      if (!r || !r.output_payload || typeof r.output_payload.verdict !== 'string') violations++;
      else if (findShapeViolations(r.output_payload).length) violations++;
    } catch (e) { violations++; }
  }
  // fuzz with the shared nasty-value generator in every slot that reaches a parser
  for (let i = 0; i < 300; i++) {
    const pp = {
      root: { hash: pickNastyJsonish(rng), sum: pickNastyJsonish(rng) },
      max_balance: pickNastyJsonish(rng),
      proof: {
        leaf: { id: pickNastyJsonish(rng), balance: pickNastyJsonish(rng) },
        path: [{ side: pickNastyJsonish(rng), sibling_hash: pickNastyJsonish(rng), sibling_sum: pickNastyJsonish(rng) }],
      },
    };
    checked++;
    try {
      const r = compute(pp);
      if (r.output_payload.verdict !== 'NOT_VERIFIED') violations++;   // nothing hostile may verify
      if (findShapeViolations(r.output_payload).length) violations++;
    } catch (e) { violations++; }
  }
  return { name: 'P1_totality_never_throws_hostile_input', checked, violations };
}

// ── P1b: OUT-OF-DOMAIN BOUNDARY PROBE — OBSERVED AND PRINTED, NOT ASSERTED ───────────────────────
// ⚠ FINDING, recorded here so it is never quietly lost (STANDING-ORDERS.md #25: a finding is a claim
// needing adjudication, not a fact with a fix attached — NODE-REG-UNBLOCK-1's fence forbids kernel
// logic edits, so this floor REPORTS and does not repair).
//
// compute() THROWS "Cannot convert object to primitive value" when a NULL-PROTOTYPE object arrives in
// root.hash, root.sum or proof.leaf.balance. Cause, located precisely: _stripHexPrefix() does
// String(h ?? '') and finalize() does String(rootIn.sum) / String(leafIn.balance); a null-prototype
// object has no toString, so the coercion throws. leaf.id does NOT throw (it is guarded by _isHex's
// typeof check), and _parseDecimalBigInt is likewise guarded by its own typeof gate — so the gap is
// specifically the three unguarded String() coercions, not a general shape failure.
//
// REACHABILITY: not reachable from the kernel's declared input path. JSON.parse always returns
// objects backed by Object.prototype (asserted below, not assumed), so no MCP/JSON caller can deliver
// this shape. That is why P1 above scopes to the JSON-representable subset and this probe reports
// rather than fails: failing it would red a gate over an input the kernel cannot actually receive,
// and dropping it silently would hide a real robustness gap. Neither is acceptable; printing it is.
function probeP1b_nullProtoBoundary() {
  const np = Object.create(null);
  const base = { root: { hash: 'ab', sum: '0' }, proof: { leaf: { id: 'aa', balance: '0' }, path: [] } };
  const slots = [
    ['root.hash', (p) => { p.root.hash = np; }],
    ['root.sum', (p) => { p.root.sum = np; }],
    ['proof.leaf.balance', (p) => { p.proof.leaf.balance = np; }],
    ['proof.leaf.id', (p) => { p.proof.leaf.id = np; }],
    ['whole pp (nullProtoClone)', (p) => { Object.assign(p, nullProtoClone(base)); }],
  ];
  const observed = [];
  for (const [slot, mutate] of slots) {
    const pp = JSON.parse(JSON.stringify(base));
    mutate(pp);
    try { compute(pp); observed.push(`${slot}: returns normally`); }
    catch (e) { observed.push(`${slot}: THROWS ${e.message}`); }
  }
  const jsonProtoIsOrdinary = Object.getPrototypeOf(JSON.parse('{"a":1}')) === Object.prototype;
  console.log(`[${KERNEL_ID}] P1b out-of-domain probe (OBSERVED, NOT ASSERTED — see the finding note above this function):`);
  for (const line of observed) console.log(`    ${line}`);
  console.log(`    JSON.parse yields Object.prototype-backed objects: ${jsonProtoIsOrdinary} => the throwing shape is unreachable from the MCP/JSON input path.`);
  return { name: 'P1b_null_proto_boundary_observed_not_asserted', checked: slots.length, violations: 0 };
}

// ── P2: DIFFERENTIAL RE-DERIVATION against node:crypto ───────────────────────────────────────────
// A valid proof over an independently-built tree must VERIFY, and the kernel's computed_root must
// equal the root the independent oracle computed. This is what actually tests the kernel's
// hand-rolled SHA-256 — if it diverged from real SHA-256 by one bit, every case here would fail.
function checkP2_differentialAgainstNodeCrypto() {
  const rng = mulberry32(620002);
  let checked = 0, violations = 0;
  for (let i = 0; i < 200; i++) {
    const depth = 1 + Math.floor(rng() * 5); // 2..32 leaves
    const c = randomCase(rng, depth);
    checked++;
    const r = compute(c.pp);
    const op = r.output_payload;
    if (op.verdict !== 'VERIFIED') { violations++; continue; }
    if (!op.computed_root || op.computed_root.hash !== c.tree.root.hash) violations++;
    else if (op.computed_root.sum !== c.tree.root.sum) violations++;
    else if (op.path_length !== c.pp.proof.path.length) violations++;
    else if (r.compliance_flags.SUMMA_MST_INCLUSION_VERIFIED !== true) violations++;
  }
  return { name: 'P2_differential_vs_node_crypto_sha256', checked, violations };
}

// ── P3: THE MAXWELL BROKEN-MST HAZARD (eprint 2022/043 §4.1) ─────────────────────────────────────
// The attack the kernel exists to stop: inflate a leaf and hide it behind a NEGATIVE sibling sum
// that cancels in the total, so the root sum still looks right. The kernel must reject on the
// negative value BEFORE any addition, naming the path index — never "verify" it.
function checkP3_brokenMstHazard() {
  const rng = mulberry32(620003);
  let checked = 0, violations = 0;

  // (a) THE ATTACK ITSELF: inflate the leaf by X and hide it behind a sibling of exactly -X, so the
  // combined sum at that level is unchanged and the published root still balances. A checker that
  // only walked the sums would be fooled; this kernel must reject on the negative BEFORE adding, and
  // name the path index it found it at.
  for (let i = 0; i < 200; i++) {
    const c = randomCase(rng, 1 + Math.floor(rng() * 4));
    const k = Math.floor(rng() * c.pp.proof.path.length);
    const pp = structuredClone(c.pp);
    const sib = BigInt(pp.proof.path[k].sibling_sum);
    // choose the inflation so the substituted sibling sum is STRICTLY negative by construction
    const inflate = sib + BigInt(1 + Math.floor(rng() * 1e6));
    pp.proof.leaf.balance = (BigInt(pp.proof.leaf.balance) + inflate).toString();
    pp.proof.path[k].sibling_sum = (sib - inflate).toString();   // == -(1..1e6), always < 0
    checked++;
    const r = compute(pp);
    if (r.output_payload.verdict !== 'NOT_VERIFIED') violations++;
    else if (r.output_payload.reason !== `negative_balance_at_path_index_${k + 1}`) violations++;
  }

  // (b) negative LEAF balance
  for (let i = 0; i < 100; i++) {
    const c = randomCase(rng, 1 + Math.floor(rng() * 3));
    const pp = structuredClone(c.pp);
    pp.proof.leaf.balance = '-' + (1 + Math.floor(rng() * 1e6));
    checked++;
    const r = compute(pp);
    if (r.output_payload.verdict !== 'NOT_VERIFIED') violations++;
    else if (r.output_payload.reason !== 'negative_balance_at_path_index_0') violations++;
  }

  // (c) a balance past the declared MAX_BALANCE domain bound (overflow-shaped input)
  for (let i = 0; i < 100; i++) {
    const c = randomCase(rng, 1 + Math.floor(rng() * 3));
    const pp = structuredClone(c.pp);
    const max = BigInt(pp.max_balance);
    if (rng() < 0.5) pp.proof.leaf.balance = (max + 1n).toString();
    else pp.proof.path[Math.floor(rng() * pp.proof.path.length)].sibling_sum = (max + 1n).toString();
    checked++;
    const r = compute(pp);
    if (r.output_payload.verdict !== 'NOT_VERIFIED') violations++;
    else if (!/^balance_exceeds_max_balance_at_path_index_\d+$/.test(r.output_payload.reason)) violations++;
  }

  return { name: 'P3_maxwell_broken_mst_hazard_rejected', checked, violations };
}

// ── P4: SINGLE-MUTATION TAMPER DETECTION ─────────────────────────────────────────────────────────
// Every one-field mutation of an otherwise-valid proof must flip VERIFIED to NOT_VERIFIED. This is
// the metamorphic half: the kernel must not be indifferent to any input it hashes over.
function checkP4_tamperBreaksVerification() {
  const rng = mulberry32(620004);
  let checked = 0, violations = 0;
  for (let i = 0; i < 120; i++) {
    const c = randomCase(rng, 2 + Math.floor(rng() * 3));
    const base = compute(c.pp);
    if (base.output_payload.verdict !== 'VERIFIED') { checked++; violations++; continue; }

    const k = Math.floor(rng() * c.pp.proof.path.length);
    const mutations = [
      (pp) => { pp.proof.leaf.balance = (BigInt(pp.proof.leaf.balance) + 1n).toString(); },
      (pp) => { pp.proof.leaf.id = pp.proof.leaf.id.slice(0, -1) + (pp.proof.leaf.id.endsWith('a') ? 'b' : 'a'); },
      (pp) => { pp.proof.path[k].sibling_sum = (BigInt(pp.proof.path[k].sibling_sum) + 1n).toString(); },
      (pp) => { const s = pp.proof.path[k].sibling_hash; pp.proof.path[k].sibling_hash = s.slice(0, -1) + (s.endsWith('a') ? 'b' : 'a'); },
      (pp) => { pp.proof.path[k].side = pp.proof.path[k].side === 'left' ? 'right' : 'left'; },
      (pp) => { const s = pp.root.hash; pp.root.hash = s.slice(0, -1) + (s.endsWith('a') ? 'b' : 'a'); },
      (pp) => { pp.root.sum = (BigInt(pp.root.sum) + 1n).toString(); },
      (pp) => { pp.proof.path.pop(); },
    ];
    for (const mutate of mutations) {
      const pp = structuredClone(c.pp);
      mutate(pp);
      checked++;
      const r = compute(pp);
      if (r.output_payload.verdict !== 'NOT_VERIFIED') violations++;
      else if (r.compliance_flags.SUMMA_MST_INCLUSION_NOT_VERIFIED !== true) violations++;
    }
  }
  return { name: 'P4_single_mutation_breaks_verification', checked, violations };
}

// ── P5: DETERMINISM ──────────────────────────────────────────────────────────────────────────────
function checkP5_determinism() {
  const rng = mulberry32(620005);
  let checked = 0, violations = 0;
  for (let i = 0; i < 150; i++) {
    const c = randomCase(rng, 1 + Math.floor(rng() * 4));
    const pp = i % 3 === 0 ? (() => { const p = structuredClone(c.pp); p.proof.leaf.balance = '-1'; return p; })() : c.pp;
    checked++;
    const a = compute(structuredClone(pp));
    const b = compute(structuredClone(pp));
    if (JSON.stringify(a) !== JSON.stringify(b)) violations++;
  }
  return { name: 'P5_determinism_on_recompute', checked, violations };
}

// ── P6: FORCED CATEGORICAL BOUNDARY CASES ────────────────────────────────────────────────────────
// The declared edges, each stated as an expectation rather than swept for: depth-0 chain, the
// MAX_PATH_DEPTH ceiling on both sides, the MAX_BALANCE bound on both sides, and every malformed
// -input branch the kernel names.
function checkP6_boundaryCases() {
  const rng = mulberry32(620006);
  let checked = 0, violations = 0;

  function expect(pp, want, reasonRe, label) {
    checked++;
    let r;
    try { r = compute(pp); } catch (e) { violations++; return; }
    if (r.output_payload.verdict !== want) { violations++; return; }
    if (reasonRe && !reasonRe.test(String(r.output_payload.reason))) violations++;
    if (findShapeViolations(r.output_payload).length) violations++;
  }

  // depth-0: a single-leaf tree, empty path — root IS the leaf
  {
    const id = 'aa11', bal = '12345';
    const rootHash = oracleLeafHash(id, bal);
    expect({ root: { hash: rootHash, sum: bal }, proof: { leaf: { id, balance: bal }, path: [] } }, 'VERIFIED', null, 'depth0');
    expect({ root: { hash: rootHash, sum: '12346' }, proof: { leaf: { id, balance: bal }, path: [] } }, 'NOT_VERIFIED', /^sum_mismatch$/, 'depth0-sum');
  }

  // MAX_BALANCE boundary: exactly at the bound is IN domain, one over is out
  {
    const max = BigInt(DEFAULT_MAX_BALANCE);
    const id = 'bb22';
    const atBound = max.toString();
    expect({ root: { hash: oracleLeafHash(id, atBound), sum: atBound }, proof: { leaf: { id, balance: atBound }, path: [] } }, 'VERIFIED', null, 'max-exact');
    const over = (max + 1n).toString();
    expect({ root: { hash: oracleLeafHash(id, over), sum: over }, proof: { leaf: { id, balance: over }, path: [] } }, 'NOT_VERIFIED', /^balance_exceeds_max_balance_at_path_index_0$/, 'max-over');
  }

  // MAX_PATH_DEPTH boundary: 64 steps is accepted for parsing, 65 is rejected outright
  {
    const mkPath = (n) => Array.from({ length: n }, () => ({ side: 'right', sibling_hash: 'ab', sibling_sum: '0' }));
    expect({ root: { hash: 'ab', sum: '0' }, proof: { leaf: { id: 'cc33', balance: '0' }, path: mkPath(MAX_PATH_DEPTH + 1) } }, 'NOT_VERIFIED', /exceeds the 64-level bound/, 'depth-over');
    // at the ceiling it must NOT be rejected for depth — it proceeds and fails on the hash instead
    expect({ root: { hash: 'ab', sum: '0' }, proof: { leaf: { id: 'cc33', balance: '0' }, path: mkPath(MAX_PATH_DEPTH) } }, 'NOT_VERIFIED', /^hash_mismatch$/, 'depth-at');
  }

  // malformed-input branches, each named by the kernel
  expect({ root: { hash: 'ab', sum: '0' }, max_balance: 'not-a-number', proof: { leaf: { id: 'aa', balance: '0' }, path: [] } }, 'NOT_VERIFIED', /max_balance/, 'bad-max');
  expect({ root: { hash: 'ab', sum: '0' }, max_balance: '-1', proof: { leaf: { id: 'aa', balance: '0' }, path: [] } }, 'NOT_VERIFIED', /max_balance/, 'neg-max');
  expect({ root: { hash: 'ab', sum: '0' }, proof: { leaf: { id: 'not hex!', balance: '0' }, path: [] } }, 'NOT_VERIFIED', /leaf\.id/, 'bad-id');
  expect({ root: { hash: 'ab', sum: '0' }, proof: { leaf: { id: 'a'.repeat(129), balance: '0' }, path: [] } }, 'NOT_VERIFIED', /leaf\.id/, 'long-id');
  expect({ root: { hash: 'ab', sum: '0' }, proof: { leaf: { id: 'aa', balance: '1.5' }, path: [] } }, 'NOT_VERIFIED', /leaf\.balance/, 'float-balance');
  expect({ root: { hash: '', sum: '0' }, proof: { leaf: { id: 'aa', balance: '0' }, path: [] } }, 'NOT_VERIFIED', /root\.hash/, 'empty-root-hash');
  expect({ root: { hash: 'ab', sum: 'x' }, proof: { leaf: { id: 'aa', balance: '0' }, path: [] } }, 'NOT_VERIFIED', /root\.hash|root\.sum/, 'bad-root-sum');
  expect({ root: { hash: 'ab', sum: '0' }, proof: { leaf: { id: 'aa', balance: '0' }, path: [{ side: 'up', sibling_hash: 'ab', sibling_sum: '0' }] } }, 'NOT_VERIFIED', /valid side/, 'bad-side');
  expect({ root: { hash: 'ab', sum: '0' }, proof: { leaf: { id: 'aa', balance: '0' }, path: [{ side: 'left', sibling_hash: 'nothex!', sibling_sum: '0' }] } }, 'NOT_VERIFIED', /sibling_hash/, 'bad-sib-hash');
  expect({ root: { hash: 'ab', sum: '0' }, proof: { leaf: { id: 'aa', balance: '0' }, path: [{ side: 'left', sibling_hash: 'ab', sibling_sum: '1.5' }] } }, 'NOT_VERIFIED', /sibling_sum/, 'bad-sib-sum');

  // sha256:/0x prefixes on the declared root must be tolerated, not treated as a mismatch
  {
    const c = randomCase(rng, 2);
    const pp = structuredClone(c.pp);
    pp.root.hash = 'sha256:' + pp.root.hash;
    expect(pp, 'VERIFIED', null, 'sha256-prefix');
    const pp2 = structuredClone(c.pp);
    pp2.root.hash = '0x' + pp2.root.hash.toUpperCase();
    expect(pp2, 'VERIFIED', null, '0x-prefix-uppercase');
  }

  return { name: 'P6_forced_categorical_boundary_cases', checked, violations };
}

// ── P7: OUTPUT SHAPE ─────────────────────────────────────────────────────────────────────────────
// No NaN / undefined / Infinity anywhere in output_payload, and the verify-only notes the kernel
// promises are always present (they are the honesty surface: this tool never claims solvency).
function checkP7_outputShape() {
  const rng = mulberry32(620007);
  let checked = 0, violations = 0;
  for (let i = 0; i < 200; i++) {
    const c = randomCase(rng, 1 + Math.floor(rng() * 4));
    const pp = structuredClone(c.pp);
    if (i % 4 === 1) pp.proof.leaf.balance = '-5';
    if (i % 4 === 2) pp.root.sum = '999999';
    if (i % 4 === 3) pp.proof.path = [];
    checked++;
    const r = compute(pp);
    const op = r.output_payload;
    if (findShapeViolations(op).length) violations++;
    else if (typeof op.residual_limitation_note !== 'string' || op.residual_limitation_note.length === 0) violations++;
    else if (typeof op.verify_only_note !== 'string' || op.verify_only_note.length === 0) violations++;
    else if (r.compliance_flags.SUMMA_MST_VERIFY_ONLY !== true) violations++;
    else if (op.max_balance_used !== pp.max_balance) violations++;
  }
  return { name: 'P7_output_shape_and_verify_only_notes', checked, violations };
}

// ---------- run ----------
const oracle = runFixtureOracle(KERNEL_ID, compute);
const properties = [
  checkP1_totality(),
  probeP1b_nullProtoBoundary(),
  checkP2_differentialAgainstNodeCrypto(),
  checkP3_brokenMstHazard(),
  checkP4_tamperBreaksVerification(),
  checkP5_determinism(),
  checkP6_boundaryCases(),
  checkP7_outputShape(),
];
console.log(`[${KERNEL_ID}] class-B property floor — P2 differentials the kernel's hand-rolled SHA-256 against node:crypto`);
const ok = summarize(KERNEL_ID, oracle, properties);
process.exit(ok ? 0 : 1);
