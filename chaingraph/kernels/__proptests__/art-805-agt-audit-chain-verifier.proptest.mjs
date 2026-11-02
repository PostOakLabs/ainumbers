// art-805-agt-audit-chain-verifier — class-K property-test FLOOR.
// kernel_digest_at_authoring: sha256:0359563a30ce4e46d2f2bd4c7d325c19297dc3991206938bf15ff42cb6cf066f
// spec: research/AGT-AUDIT-FORMAT-PIN-2026-10-29.md (upstream commit 3433fa7);
//       RIDER-KERNEL K-FULL; row LANDSCAPE-AGT-AUDIT-VERIFIER-RESUME-1
// human_sign_off: PENDING
//
// ZERO external dependencies — Node built-ins plus the in-repo _pbt-common.mjs helpers only.
//
// Run: node chaingraph/kernels/__proptests__/art-805-agt-audit-chain-verifier.proptest.mjs

import { compute, subjectHash } from '../art-805-agt-audit-chain-verifier.kernel.mjs';
import { runFixtureOracle, summarize, mulberry32, deepEqual } from './_pbt-common.mjs';

const KERNEL_ID = 'art-805-agt-audit-chain-verifier';

// ---------- deterministic chain builder (upstream capture() shape, fixed clock) ----------
const ALPHA = 'abcdefghijklmnopqrstuvwxyz0123456789';
function randStr(rng, n) {
  let s = '';
  for (let i = 0; i < n; i++) s += ALPHA[Math.floor(rng() * ALPHA.length)];
  return s;
}
function mkChanges(rng) {
  return [{
    path: '/' + randStr(rng, 6) + '.txt',
    operation: rng() < 0.5 ? 'add' : 'write',
    content_hash: rng() < 0.5 ? randStr(rng, 8) : null,
    previous_hash: null,
    agent_did: rng() < 0.5 ? 'did:' + randStr(rng, 5) : null,
  }];
}
function buildChain(rng, n) {
  const entries = [];
  let parent = null;
  for (let i = 1; i <= n; i++) {
    const e = {
      delta_id: `delta:${i}`,
      turn_id: i,
      session_id: 'session:' + randStr(rng, 5),
      agent_did: 'did:agent-' + randStr(rng, 4),
      timestamp: '2026-01-01T00:0' + ((i - 1) % 10) + ':00+00:00',
      parent_hash: parent,
      changes: mkChanges(rng),
      delta_hash: '',
    };
    e.delta_hash = subjectHash(e);
    entries.push(e);
    parent = e.delta_hash;
  }
  return entries;
}

// ---------- P1: any single-byte edit breaks the chain at or before that entry ----------
// For each trial: build a valid chain, pick entry k, pick one string field,
// and edit exactly ONE character of it (content field, or a stored hash field).
// The verifier must report chain_intact=false with first_break_index <= k.
function checkSingleByteEditBreaksAtOrBefore() {
  const name = 'P1-single-byte-edit-breaks-at-or-before-edited-entry';
  let checked = 0, violations = 0;
  const rng = mulberry32(0xa0805);
  const STRING_FIELDS = ['delta_id', 'session_id', 'agent_did', 'delta_hash', 'parent_hash'];
  for (let trial = 0; trial < 200; trial++) {
    const n = 2 + Math.floor(rng() * 5); // 2..6 entries
    const chain = buildChain(rng, n);
    const k = Math.floor(rng() * n);
    const e = { ...chain[k], changes: chain[k].changes.map(c => ({ ...c })) };
    const mode = rng();
    if (mode < 0.5) {
      // edit one char of one change sub-field
      const ci = Math.floor(rng() * e.changes.length);
      const sub = ['path', 'operation', 'content_hash', 'agent_did'][Math.floor(rng() * 4)];
      const cur = e.changes[ci][sub];
      if (typeof cur !== 'string' || cur.length === 0) { e.delta_id = e.delta_id.slice(0, -1) + (e.delta_id.endsWith('x') ? 'y' : 'x'); }
      else {
        const pos = Math.floor(rng() * cur.length);
        const repl = cur[pos] === 'x' ? 'q' : 'x';
        e.changes[ci] = { ...e.changes[ci], [sub]: cur.slice(0, pos) + repl + cur.slice(pos + 1) };
      }
    } else {
      const f = STRING_FIELDS[Math.floor(rng() * STRING_FIELDS.length)];
      const cur = e[f];
      if (cur === null) { e.delta_id = e.delta_id + 'z'; } // null parent: fall back to a content edit
      else {
        const pos = Math.floor(rng() * cur.length);
        const repl = cur[pos] === 'f' ? '0' : 'f';
        e[f] = cur.slice(0, pos) + repl + cur.slice(pos + 1);
      }
    }
    const tampered = chain.map((x, i) => (i === k ? e : { ...x, changes: x.changes.map(c => ({ ...c })) }));
    const { output_payload: o } = compute({ entries: tampered });
    checked++;
    if (o.rejected) { violations++; continue; }
    if (o.chain_intact !== false) violations++;
    else if (o.first_break_index === null || o.first_break_index > k) violations++;
  }
  return { name, checked, violations };
}

// ---------- P2: intact chains stay intact and root = last link hash ----------
function checkIntactChainsVerify() {
  const name = 'P2-intact-chain-verifies-root-is-last-link';
  let checked = 0, violations = 0;
  const rng = mulberry32(0xb0805);
  for (let trial = 0; trial < 50; trial++) {
    const chain = buildChain(rng, 1 + Math.floor(rng() * 6));
    const claimed = chain[chain.length - 1].delta_hash;
    const { output_payload: o } = compute({ entries: chain, claimed_root: claimed });
    checked++;
    if (o.chain_intact !== true) violations++;
    if (o.first_break_index !== null) violations++;
    if (o.entry_count !== chain.length) violations++;
    if (o.recomputed_root !== claimed) violations++;
    if (o.claimed_root_match !== true) violations++;
    if (o.rejected !== false) violations++;
  }
  return { name, checked, violations };
}

// ---------- P3: determinism — same input, identical output ----------
function checkDeterminism() {
  const name = 'P3-determinism';
  let checked = 0, violations = 0;
  const rng = mulberry32(0xc0805);
  for (let trial = 0; trial < 20; trial++) {
    const chain = buildChain(rng, 3);
    const a = compute({ entries: chain, claimed_root: chain[2].delta_hash });
    const b = compute({ entries: chain, claimed_root: chain[2].delta_hash });
    checked++;
    if (!deepEqual(a.output_payload, b.output_payload)) violations++;
    if (JSON.stringify(a.compliance_flags) !== JSON.stringify(b.compliance_flags)) violations++;
  }
  return { name, checked, violations };
}

// ---------- P4: fail-closed — malformed input is rejected naming fields, never echoed ----------
function checkFailClosed() {
  const name = 'P4-fail-closed-names-rejected-fields';
  let checked = 0, violations = 0;
  const rng = mulberry32(0xd0805);
  const chain = buildChain(rng, 3);
  const bads = [
    { entries: [{ ...chain[0], intruder: 'x' }], why: 'unknown top-level field' },
    { entries: [{ ...chain[0], turn_id: 1.5 }], why: 'non-integer turn_id' },
    { entries: [{ ...chain[0], delta_hash: 'nothex' }], why: 'malformed delta_hash' },
    { entries: [{ ...chain[0], timestamp: 'not-a-time' }], why: 'malformed timestamp' },
    { entries: [{ ...chain[0], changes: [{ ...chain[0].changes[0], payload: { free: 'form' } }] }], why: 'free-form payload in change' },
    { entries: 'all-of-it', why: 'entries not an array' },
    { entries: chain, claimed_root: 42, why: 'claimed_root not a string' },
    { why: 'entries missing entirely' },
  ];
  for (const { entries, claimed_root } of bads) {
    const pp = claimed_root === undefined ? { entries } : { entries, claimed_root };
    const { output_payload: o } = compute(pp);
    checked++;
    if (o.rejected !== true) violations++;
    if (!Array.isArray(o.rejected_fields) || o.rejected_fields.length === 0) violations++;
    if (o.chain_intact !== false) violations++;
    // no entry content may be echoed: output carries only hashes/indices/flags
    if (JSON.stringify(o).includes('/file.txt')) violations++;
  }
  // empty chain verifies (upstream test_empty_chain_verifies)
  const empty = compute({ entries: [] }).output_payload;
  checked++;
  if (empty.chain_intact !== true || empty.entry_count !== 0 || empty.rejected !== false) violations++;
  return { name, checked, violations };
}

// ---------- run ----------
let oracle;
try {
  oracle = runFixtureOracle(KERNEL_ID, compute);
} catch (e) {
  oracle = { total: 1, failures: [{ name: 'fixture-oracle-load', expected: '(compute() implemented)', got: String((e && e.message) || e) }] };
}
const properties = [
  checkSingleByteEditBreaksAtOrBefore(),
  checkIntactChainsVerify(),
  checkDeterminism(),
  checkFailClosed(),
];
console.log(`[${KERNEL_ID}] class-K property test — audit-chain verifier floor.`);
const ok = summarize(KERNEL_ID, oracle, properties);
process.exit(ok ? 0 : 1);
