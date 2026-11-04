// 827-agent-cred-class-matrix -- class-K property-test FLOOR.
// kernel_digest_at_authoring: sha256:28e5aab0501cdbf4be1cae2a91e14f7a405052416989327de0c9ec2fae107efe
// spec: AGENT-CRED-CLASS-MATRIX-1 (agent credential class matrix; consumes the art-133 rail
// verdict and chains scope/expiry/replay cells to the sibling verdicts; local facts for the two
// uncovered classes). human_sign_off: PENDING
//
// ZERO external dependencies -- Node built-ins plus the in-repo _pbt-common.mjs helpers only.
//
// Run: node chaingraph/kernels/__proptests__/827-agent-cred-class-matrix.proptest.mjs

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join, dirname } from 'node:path';
import { compute, CLASSES, COLUMNS, CHAIN_SOURCES, LOCAL_FACT_ENUMS, REVOCATION_MECHANISMS, LEARN_FIELDS, FLAGS } from '../827-agent-cred-class-matrix.kernel.mjs';
import { runFixtureOracle, summarize, mulberry32, pick, deepEqual, findShapeViolations } from './_pbt-common.mjs';

const KERNEL_ID = '827-agent-cred-class-matrix';
const HERE = dirname(fileURLToPath(import.meta.url));
const SPT = 'acp-checkout-shared-payment-token-linter';
const VIC = 'visa-vic-agent-token-scope-builder';
const MC = 'mastercard-agentic-token-builder';

// Deterministic seed, committed (no Date.now()/Math.random() anywhere in this file).
const SEED = 0x00827;

// ---------- reference inputs ----------
function baseFull() {
  return {
    rail_verdict: {
      any_accepted: true,
      rails: {
        mastercard_agent_pay: { accepted: false, gaps: ['testnet-only-integration'] },
        visa_tap: { accepted: true, gaps: [] },
        web_bot_auth: { accepted: false, gaps: [] },
      },
    },
    classes: {
      shared_payment_token: { chain_sources: { scope: SPT, expiry: SPT, replay_protection: SPT } },
      network_agent_token: { chain_sources: { scope: VIC, expiry: MC, replay_protection: MC } },
      x402_permit: { chain_sources: { scope: 'art-385-agent-token-scope-checker', expiry: 'art-703-mandate-authorization-gate', replay_protection: 'art-699-x402-permit2-evidence-recomputer' } },
      api_key_card_proxy: { local_facts: { scope: 'container_scoped_token_use', expiry: 'unpinned_in_cited_sources', replay_protection: 'fail_closed_single_forward' } },
      wallet_session_key: { local_facts: { scope: 'counterparty_and_chain_scoped_grant', expiry: 'expiry_rule_unix_timestamp', replay_protection: 'unpinned_in_cited_sources' } },
    },
    revocation: {
      shared_payment_token: { mechanism: 'declared_not_revocable', time_bound: true },
      network_agent_token: { mechanism: 'authoritative_party_revoke_call', time_bound: true },
      x402_permit: { mechanism: 'authoritative_party_revoke_call', time_bound: true },
      api_key_card_proxy: { mechanism: 'authoritative_party_revoke_call', time_bound: false },
      wallet_session_key: { mechanism: 'authoritative_party_revoke_call', time_bound: true },
    },
    learn: {
      shared_payment_token: { opaque_credential: false, learns_identity: false, learns_action: true, publicly_visible: false, credential_persisted_or_logged: false },
      network_agent_token: { opaque_credential: false, learns_identity: false, learns_action: true, publicly_visible: false, credential_persisted_or_logged: false },
      x402_permit: { opaque_credential: false, learns_identity: true, learns_action: true, publicly_visible: true, credential_persisted_or_logged: false },
      api_key_card_proxy: { opaque_credential: false, learns_identity: false, learns_action: true, publicly_visible: true, credential_persisted_or_logged: false },
      wallet_session_key: { opaque_credential: true, learns_identity: false, learns_action: true, publicly_visible: false, credential_persisted_or_logged: false },
    },
  };
}

// Fuzzed-but-structured pp variants: every class slot picks a declared shape
// (chained / local / missing / malformed / unknown) and the revocation + learn maps pick
// valid or invalid entries. Covers every refusal branch stochastically, deterministically.
function fuzzPP(rng) {
  const chainIds = [SPT, VIC, MC, 'art-385-agent-token-scope-checker', 'art-703-mandate-authorization-gate', 'art-699-x402-permit2-evidence-recomputer'];
  const localVals = ['container_scoped_token_use', 'tenant_wide_proxy_invoke', 'counterparty_and_chain_scoped_grant', 'expiry_rule_unix_timestamp', 'fail_closed_single_forward', 'unpinned_in_cited_sources', 'static_session_key'];
  const mechs = [...REVOCATION_MECHANISMS, 'entrypoint_revoke'];
  const pp = {};
  const roll = () => Math.floor(rng() * 6);
  if (roll() !== 0) {
    pp.rail_verdict = { any_accepted: rng() < 0.5, rails: {} };
    for (const rail of ['mastercard_agent_pay', 'visa_tap', 'web_bot_auth']) {
      if (roll() === 0) continue;
      pp.rail_verdict.rails[rail] = roll() === 0 ? 'garbage' : { accepted: rng() < 0.5, gaps: rng() < 0.5 ? [] : ['gap-x'] };
    }
  }
  pp.classes = {};
  for (const cls of CLASSES) {
    const mode = Math.floor(rng() * 6); // 0 absent, 1-2 chained, 3 local, 4 malformed, 5 unknown value
    if (mode === 0) continue;
    if (mode === 4) { pp.classes[cls] = {}; continue; }
    if (mode === 5) {
      const key = cls === 'shared_payment_token' ? 'hsm_key_handle' : cls;
      pp.classes[key] = { chain_sources: { scope: pick(rng, chainIds), expiry: pick(rng, chainIds), replay_protection: pick(rng, chainIds) } };
      continue;
    }
    if (cls === 'shared_payment_token' || cls === 'network_agent_token' || cls === 'x402_permit' || mode === 1) {
      pp.classes[cls] = { chain_sources: { scope: pick(rng, chainIds), expiry: pick(rng, chainIds), replay_protection: pick(rng, chainIds) } };
    } else {
      pp.classes[cls] = { local_facts: { scope: pick(rng, localVals), expiry: pick(rng, localVals), replay_protection: pick(rng, localVals) } };
    }
  }
  pp.revocation = {};
  pp.learn = {};
  for (const cls of CLASSES) {
    if (!(cls in pp.classes)) continue;
    if (roll() !== 0) pp.revocation[cls] = { mechanism: pick(rng, mechs), time_bound: rng() < 0.5 };
    if (roll() !== 0) {
      const facts = {};
      for (const f of LEARN_FIELDS) if (rng() < 0.9) facts[f] = rng() < 0.5;
      pp.learn[cls] = facts;
    }
  }
  return pp;
}

// ---------- properties ----------
function checkDeterminism(corpus) {
  let violations = 0;
  for (const pp of corpus) {
    const a = JSON.stringify(compute(pp));
    const b = JSON.stringify(compute(JSON.parse(JSON.stringify(pp))));
    if (a !== b) violations += 1;
  }
  return { name: 'determinism-structured-fuzz', checked: corpus.length, violations };
}

function checkMatrixShape(corpus) {
  let violations = 0;
  for (const pp of corpus) {
    const { output_payload } = compute(pp);
    const m = output_payload.matrix;
    if (!Array.isArray(m) || m.length !== 5) { violations += 1; continue; }
    for (let i = 0; i < 5; i += 1) {
      if (m[i].credential_class !== CLASSES[i]) violations += 1;
      const keys = Object.keys(m[i].cells).sort().join(',');
      if (keys !== 'expiry,learn,replay_protection,revocability,scope') violations += 1;
    }
    if (typeof output_payload.rail_acceptance_summary !== 'object' || output_payload.rail_acceptance_summary === null) violations += 1;
    if (!Array.isArray(output_payload.manual_review_required)) violations += 1;
  }
  return { name: 'matrix-shape-5x5', checked: corpus.length, violations };
}

function checkClosedVocabulary(corpus) {
  let violations = 0;
  for (const pp of corpus) {
    const { output_payload } = compute(pp);
    for (const row of output_payload.matrix) {
      const cls = row.credential_class;
      for (const col of COLUMNS) {
        const cell = row.cells[col];
        if (cell.kind === 'chained') {
          if (!(CHAIN_SOURCES[cls] && CHAIN_SOURCES[cls][col] && CHAIN_SOURCES[cls][col].includes(cell.source))) violations += 1;
        } else if (cell.kind === 'local_fact' && typeof cell.value === 'string') {
          if (!(LOCAL_FACT_ENUMS[cls] && LOCAL_FACT_ENUMS[cls][col] && LOCAL_FACT_ENUMS[cls][col].includes(cell.value))) violations += 1;
        } else if (cell.kind === 'refused' && !Object.values(FLAGS).includes(cell.reason)) {
          violations += 1;
        }
      }
      const rv = row.cells.revocability;
      if (rv.kind === 'local_fact' && !REVOCATION_MECHANISMS.includes(rv.mechanism)) violations += 1;
      if (rv.kind === 'refused' && !Object.values(FLAGS).includes(rv.reason)) violations += 1;
      const ln = row.cells.learn;
      if (ln.kind === 'local_fact') {
        if (Object.keys(ln.facts).sort().join(',') !== [...LEARN_FIELDS].sort().join(',')) violations += 1;
        for (const f of LEARN_FIELDS) if (typeof ln.facts[f] !== 'boolean') violations += 1;
      }
      if (ln.kind === 'refused' && !Object.values(FLAGS).includes(ln.reason)) violations += 1;
    }
  }
  return { name: 'closed-vocabulary-emissions', checked: corpus.length, violations };
}

function checkFlagMirror(corpus) {
  let violations = 0;
  for (const pp of corpus) {
    const { output_payload, compliance_flags } = compute(pp);
    if (compliance_flags.length > 0 && output_payload.manual_review_required.length === 0) violations += 1;
    if (compliance_flags.length === 0 && output_payload.manual_review_required.length !== 0) violations += 1;
  }
  return { name: 'flag-mirror-doctrine', checked: corpus.length, violations };
}

function checkRefusalReachability() {
  const file = JSON.parse(readFileSync(join(HERE, '..', 'fixtures', '827-agent-cred-class-matrix.reachability.json'), 'utf8'));
  let checked = 0;
  let violations = 0;
  for (const vec of file.vectors) {
    checked += 1;
    const { output_payload, compliance_flags } = compute(vec.policy_parameters);
    for (const f of vec.observed_flags) if (!compliance_flags.includes(f)) violations += 1;
    if (compliance_flags.length > 0 && output_payload.manual_review_required.length === 0) violations += 1;
  }
  return { name: 'refusal-reachability', checked, violations };
}

function checkNoShapeViolations(corpus) {
  let violations = 0;
  for (const pp of corpus) {
    const { output_payload } = compute(pp);
    if (findShapeViolations(output_payload).length > 0) violations += 1;
  }
  return { name: 'no-nan-or-undefined', checked: corpus.length, violations };
}

function checkEmptyInputIsSafe() {
  let violations = 0;
  const { output_payload, compliance_flags } = compute({});
  if (output_payload.matrix.length !== 5) violations += 1;
  if (!compliance_flags.includes('RAIL_VERDICT_INVALID')) violations += 1;
  if (output_payload.manual_review_required.length === 0) violations += 1;
  return { name: 'empty-input-degrades-without-throwing', checked: 1, violations };
}

// ---------- run ----------
let oracle;
try {
  oracle = runFixtureOracle(KERNEL_ID, compute);
} catch (e) {
  oracle = { total: 1, failures: [{ name: 'fixture-oracle-load', expected: '(golden vectors match compute())', got: String((e && e.message) || e) }] };
}

const rng = mulberry32(SEED);
const corpus = [baseFull(), {}];
for (let i = 0; i < 300; i += 1) corpus.push(fuzzPP(rng));

const properties = [
  checkDeterminism(corpus),
  checkMatrixShape(corpus),
  checkClosedVocabulary(corpus),
  checkFlagMirror(corpus),
  checkRefusalReachability(),
  checkNoShapeViolations(corpus),
  checkEmptyInputIsSafe(),
];
console.log(`[${KERNEL_ID}] class-K floor property test -- agent credential class matrix`);
const ok = summarize(KERNEL_ID, oracle, properties);
process.exit(ok ? 0 : 1);
