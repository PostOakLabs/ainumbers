// art-604-erc8004-registry-entry-verifier property-test floor (ADJACENT-HOOKS-ASSEMBLE-LAND-2).
// kernel_digest_at_authoring: sha256:e070d771eff503f44fbf430cb47475cbb4ff2b2db6cc3692e6d4f3b93370a8c3
// human_sign_off: PENDING
//
// Class-A floor per FV-PBT-FLOOR-BUILD-SPEC.md §3 -- cheap invariant subset over the DECLARED domain,
// not a totality proof. Shape: a pure, stateless field-by-field comparator between a caller-supplied
// claimed_entry and a caller-supplied onchain_record, plus an EIP-55 checksum check on address-shaped
// fields -- no network calls, no per-registry-type adapter, generic schema only. The fixture oracle
// (3 vectors) is the primary correctness anchor; properties below are structural invariants a
// consistency comparator must hold regardless of the exact field-matching arithmetic. float:no (all
// inputs are strings/objects). ZERO external dependencies. READ-ONLY w.r.t. the kernel it imports.
// compute() is synchronous.
//
// Run: node chaingraph/kernels/__proptests__/art-604-erc8004-registry-entry-verifier.proptest.mjs

import { compute, buildArtifact } from '../art-604-erc8004-registry-entry-verifier.kernel.mjs';
import { executionHash } from '../_hash.mjs';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const results = { fixture_oracle: null, properties: [] };

const BASE_PP = {
  registry_type: 'identity',
  chain_id: '1',
  registry_address: '0x5FbDB2315678afecb367f032d93F642f64180aa',
  claimed_entry: { agentId: '42', agentDomain: 'agent.example.com', agentAddress: '0x5B38Da6a701c568545dCfcB03FcB875f56beddC4' },
  onchain_record: { agentId: '42', agentDomain: 'agent.example.com', agentAddress: '0x5B38Da6a701c568545dCfcB03FcB875f56beddC4' },
};

// ---------- fixture-oracle gate (MANDATORY before any property is trusted) ----------
function runFixtureOracle() {
  const fixturesPath = path.join(__dirname, '..', 'fixtures', 'art-604-erc8004-registry-entry-verifier.fixtures.json');
  const fixtures = JSON.parse(readFileSync(fixturesPath, 'utf8'));
  const failures = [];
  for (const vec of fixtures.vectors) {
    const { output_payload } = compute(vec.policy_parameters);
    const a = JSON.stringify(output_payload);
    const b = JSON.stringify(vec.output_payload);
    if (a !== b) failures.push({ name: vec.name, expected: vec.output_payload, got: output_payload });
  }
  results.fixture_oracle = { total: fixtures.vectors.length, failures };
  return failures.length === 0;
}

// ---------- negative control: an oracle never seen rejecting a wrong spec is not known to work ----------
function negativeControl() {
  const { output_payload } = compute(BASE_PP);
  const mutated = { ...output_payload, overall_determination: output_payload.overall_determination === 'CONSISTENT' ? 'INCONSISTENT' : 'CONSISTENT' };
  const wouldPass = JSON.stringify(mutated) === JSON.stringify(output_payload);
  return { rejected_wrong_spec: !wouldPass };
}

// P1: determinism -- same input, called twice, byte-identical output.
function checkP1_determinism() {
  const a = compute(BASE_PP).output_payload;
  const b = compute(BASE_PP).output_payload;
  const violations = JSON.stringify(a) === JSON.stringify(b) ? 0 : 1;
  return { name: 'P1_determinism_repeat_call', trials: 1, violations };
}

// P2: missing registry_type/claimed_entry/onchain_record forces INDETERMINATE, with an empty
// field_comparison and address_checksum_findings.
function checkP2_missingRequiredForcesIndeterminate() {
  let violations = 0, checked = 0;
  const cases = [{}, { registry_type: 'identity' }, { claimed_entry: {}, onchain_record: {} }];
  for (const pp of cases) {
    const { output_payload } = compute(pp);
    checked++;
    if (output_payload.overall_determination !== 'INDETERMINATE') violations++;
    if (!Array.isArray(output_payload.field_comparison) || output_payload.field_comparison.length !== 0) violations++;
  }
  return { name: 'P2_missing_required_forces_indeterminate', trials: checked, violations };
}

// P3: a field present in both records but differing in value flips overall_determination to
// INCONSISTENT and records that field with match:false.
function checkP3_valueMismatchForcesInconsistent() {
  let violations = 0, checked = 0;
  const mismatched = { ...BASE_PP, onchain_record: { ...BASE_PP.onchain_record, agentId: '99' } };
  const { output_payload } = compute(mismatched);
  checked++; if (output_payload.overall_determination !== 'INCONSISTENT') violations++;
  const agentIdRow = output_payload.field_comparison.find((f) => f.field === 'agentId');
  checked++; if (!agentIdRow || agentIdRow.match !== false) violations++;
  return { name: 'P3_value_mismatch_forces_inconsistent', trials: checked, violations };
}

// P4: output shape -- overall_determination is always one of the three known verdicts, and
// field_comparison / address_checksum_findings / findings / not_proven are always arrays.
function checkP4_outputShapeInvariant() {
  let violations = 0, checked = 0;
  const VERDICTS = new Set(['CONSISTENT', 'INCONSISTENT', 'INDETERMINATE']);
  const inputs = [{}, BASE_PP, { ...BASE_PP, registry_type: 'reputation' }, { ...BASE_PP, claimed_entry: { foo: 'bar' }, onchain_record: { foo: 'baz' } }];
  for (const pp of inputs) {
    const { output_payload } = compute(pp);
    checked++;
    if (!VERDICTS.has(output_payload.overall_determination)) violations++;
    if (!Array.isArray(output_payload.field_comparison)) violations++;
    if (!Array.isArray(output_payload.address_checksum_findings)) violations++;
    if (!Array.isArray(output_payload.findings)) violations++;
    if (!Array.isArray(output_payload.not_proven)) violations++;
  }
  return { name: 'P4_output_shape_invariant', trials: checked, violations };
}

// ---------- P5: every required field of every positive vector, mutated to delete / null / "" / "   ", never stays positive ----------
function checkP5_requiredFieldNeverPositive() {
  const fixturesPath = path.join(__dirname, '..', 'fixtures', 'art-604-erc8004-registry-entry-verifier.fixtures.json');
  const fixtures = JSON.parse(readFileSync(fixturesPath, 'utf8'));
  const required = ['chain_id', 'claimed_entry', 'onchain_record', 'registry_address', 'registry_type'];
  let violations = 0, checked = 0, positives = 0;
  for (const vec of fixtures.vectors) {
    if (compute(vec.policy_parameters).output_payload.overall_determination !== 'CONSISTENT') continue;
    positives++;
    for (const f of required) {
      for (const mode of ['delete', 'null', 'empty', 'blank']) {
        const pp = JSON.parse(JSON.stringify(vec.policy_parameters));
        if (mode === 'delete') delete pp[f];
        else pp[f] = mode === 'null' ? null : mode === 'empty' ? '' : '   ';
        checked++;
        if (compute(pp).output_payload.overall_determination === 'CONSISTENT') violations++;
      }
    }
  }
  if (positives === 0) violations++;
  return { name: 'P5_required_field_blank_never_positive', trials: checked, positives, violations };
}

// ---------- P6: buildArtifact_never_throws — one fixture per unhashable class ----------
async function checkP6_buildArtifactNeverThrows() {
  let deep = {}; let cur = deep;
  for (let i = 0; i < 511; i++) { cur.n = {}; cur = cur.n; }
  const classes = [
    ['junk_1e300', { chain_id: 1e300 }],
    ['nan', { chain_id: NaN }],
    ['neg_infinity', { chain_id: -Infinity }],
    ['depth_511', { chain_id: deep }],
    ['over_1e6_values', { chain_id: new Array(1000001).fill(0) }],
  ];
  let violations = 0; const rows = [];
  for (const [label, pp] of classes) {
    try {
      const a = await buildArtifact(pp);
      const ok = a.execution_hash === null && a.hash_refusal && typeof a.hash_refusal.reason === 'string';
      if (!ok) violations++;
      rows.push({ label, refused: !!ok });
    } catch (e) { violations++; rows.push({ label, threw: String(e && e.message).slice(0, 80) }); }
  }
  return { name: 'buildArtifact_never_throws', trials: classes.length, violations, rows };
}

// ---------- P7..P11: spec-anchored boundary assertions (FLOOR-CURE-P3, 2026-11-24) ----------
// Every expectation below is derived from the kernel's documented rules (input-validation
// reasons, _valuesMatch semantics, EIP-55 reference vectors from the EIP text, the verdict
// aggregation table, the hash-refusal limits mirrored from _hash.mjs), not from snapshotting
// current output. EIP-55 vectors are the four checksummed examples published in EIP-55 itself.
const EIP55_VALID = [
  '0x5aAeb6053F3E94C9b9A09f33669435E7Ef1BeAed',
  '0xfB6916095ca1df60bB79Ce92cE3Ea74c37c5d359',
  '0xdbF03B407c01E7cD3CBea99509d93f8DDDC8C6FB',
  '0xD1220A0cf47c7B9Be7A2E6BA89F429762e7b9aDb',
];
const EIP55_ALLCAPS = ['0x52908400098527886E0F7030069857D2E4169EE7', '0x8617E340B3D01FA5F11F306F4090FD50E238070D'];
const EIP55_ALLLOWER = ['0xde709f2102306220921060314715629080e2fb77', '0x27b1fdb04752bbc536007a920d24acb045561c26'];
const HDR = { registry_type: 'identity', chain_id: '1', registry_address: '0x5FbDB2315678afecb367f032d93F642f64180aa' };
const run = (claimed, onchain, extra = {}) => compute({ ...HDR, claimed_entry: claimed, onchain_record: onchain, ...extra });
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const flipCase = (addr, idx) => { const c = addr[idx]; return addr.slice(0, idx) + (c === c.toUpperCase() ? c.toLowerCase() : c.toUpperCase()) + addr.slice(idx + 1); };

function checkP7_inputValidationReasons() {
  let violations = 0, checked = 0;
  const ok = (cond) => { checked++; if (!cond) violations++; };
  const RT = 'registry_type is required and must be one of: identity, reputation, validation';
  const CE = 'claimed_entry is required and must be a non-empty object';
  const OR = 'onchain_record is required and must be a non-empty object (independently read by the caller from the registry contract -- this tool never fetches it)';
  const CH = 'chain_id is required (missing, null, blank or whitespace-only)';
  const RA = 'registry_address is required (missing, null, blank or whitespace-only)';
  const good = { agentId: '1' };
  /** @type {Array<[any, string[]]>} */
  const cases = [
    [{ ...HDR, registry_type: 5, claimed_entry: good, onchain_record: good }, [RT]],
    [{ ...HDR, registry_type: 'bogus', claimed_entry: good, onchain_record: good }, [RT]],
    [{ ...HDR, registry_type: ['identity'], claimed_entry: good, onchain_record: good }, [RT]],
    [{ ...HDR, claimed_entry: [good], onchain_record: good }, [CE]],
    [{ ...HDR, claimed_entry: 'x', onchain_record: good }, [CE]],
    [{ ...HDR, claimed_entry: null, onchain_record: good }, [CE]],
    [{ ...HDR, claimed_entry: {}, onchain_record: good }, [CE]],
    [{ ...HDR, claimed_entry: good, onchain_record: [good] }, [OR]],
    [{ ...HDR, claimed_entry: good, onchain_record: 'x' }, [OR]],
    [{ ...HDR, claimed_entry: good, onchain_record: null }, [OR]],
    [{ ...HDR, claimed_entry: good, onchain_record: {} }, [OR]],
    [{ ...HDR, chain_id: undefined, claimed_entry: good, onchain_record: good }, [CH]],
    [{ ...HDR, chain_id: null, claimed_entry: good, onchain_record: good }, [CH]],
    [{ ...HDR, chain_id: '', claimed_entry: good, onchain_record: good }, [CH]],
    [{ ...HDR, chain_id: ' \t ', claimed_entry: good, onchain_record: good }, [CH]],
    [{ ...HDR, registry_address: undefined, claimed_entry: good, onchain_record: good }, [RA]],
    [{ ...HDR, registry_address: null, claimed_entry: good, onchain_record: good }, [RA]],
    [{ ...HDR, registry_address: '', claimed_entry: good, onchain_record: good }, [RA]],
    [{ ...HDR, registry_address: ' \n ', claimed_entry: good, onchain_record: good }, [RA]],
    [{ claimed_entry: good, onchain_record: good }, [RT, CH, RA]],
    [{ ...HDR, registry_type: 'x', claimed_entry: {}, onchain_record: {}, chain_id: '', registry_address: '' }, [RT, CE, OR, CH, RA]],
  ];
  for (const [pp, reasons] of cases) {
    const r = compute(pp);
    const o = r.output_payload;
    ok(o.overall_determination === 'INDETERMINATE');
    ok(o.findings.length === 1 && o.findings[0].check === 'input_validation' && o.findings[0].verdict === 'INDETERMINATE');
    ok(o.findings[0].detail === reasons.join('; '));
    ok(same(r.compliance_flags, ['ERC8004_INDETERMINATE', 'ERC8004_MALFORMED_INPUT']));
    ok(same(o.field_comparison, []) && same(o.address_checksum_findings, []));
  }
  // pp itself not an object -> every required field missing, never a throw.
  for (const pp of [null, undefined, 'str', 5, true, []]) {
    let o; try { o = compute(pp).output_payload; } catch (e) { o = null; }
    ok(o !== null && o.overall_determination === 'INDETERMINATE' && o.findings[0].detail === [RT, CE, OR, CH, RA].join('; '));
    ok(o !== null && o.registry_type === null && o.chain_id === null && o.registry_address === null);
  }
  // Echo rules: registry_type trimmed + lowercased; chain_id String()-ed untrimmed (0 is filled);
  // registry_address echoed trimmed only when a non-blank string.
  const full = { agentId: '1', agentAddress: EIP55_VALID[0] };
  let o = run(full, full, { registry_type: ' REPUTATION ' }).output_payload;
  ok(o.registry_type === 'reputation' && o.overall_determination === 'CONSISTENT');
  for (const t of ['identity', 'validation']) ok(run(good, good, { registry_type: t }).output_payload.registry_type === t);
  o = run(full, full, { chain_id: 0 }).output_payload;
  ok(o.chain_id === '0' && o.overall_determination === 'CONSISTENT');
  o = run(good, good, { chain_id: 8453 }).output_payload;
  ok(o.chain_id === '8453');
  o = run(good, good, { chain_id: ' 1 ' }).output_payload;
  ok(o.chain_id === ' 1 ');
  o = run(good, good, { registry_address: '  0xAbC  ' }).output_payload;
  ok(o.registry_address === '0xAbC');
  o = run(full, full, { registry_address: 12345 }).output_payload;
  ok(o.registry_address === null && o.overall_determination === 'CONSISTENT');
  o = compute({ ...HDR, chain_id: ' ', claimed_entry: good, onchain_record: good }).output_payload;
  ok(o.chain_id === null && o.registry_address === HDR.registry_address);
  return { name: 'P7_input_validation_reasons_and_echo', trials: checked, violations };
}

function checkP8_valueMatchSemantics() {
  let violations = 0, checked = 0;
  const m = (a, b) => run({ f: a }, { f: b }).output_payload.field_comparison[0].match;
  const ok = (cond) => { checked++; if (!cond) violations++; };
  const A = EIP55_VALID[0];
  const lowerA = A.toLowerCase();
  // trimmed string equality, strict inequality otherwise
  ok(m('x', 'x') === true); ok(m('  x ', 'x') === true); ok(m('x', ' x\n') === true);
  ok(m('x', 'y') === false); ok(m('x', 'X') === false); ok(m('ab', 'a b') === false);
  // loose, type-blind comparison of transcribed JSON
  ok(m(0, '0') === true); ok(m(42, 42) === true); ok(m(42, 43) === false); ok(m(true, 'true') === true);
  // null handling
  ok(m(null, null) === true); ok(m(null, 'x') === false); ok(m('x', null) === false); ok(m(null, '') === false); ok(m(null, 0) === false);
  // address-shaped values: case-insensitive, prefix-insensitive
  ok(m(A, lowerA) === true); ok(m(A, A.toUpperCase().replace('0X', '0x')) === true);
  ok(m(A, lowerA.slice(2)) === true); ok(m(A.slice(2), lowerA) === true); ok(m(A.slice(2), A.slice(2).toUpperCase()) === true);
  ok(m(' ' + A + ' ', lowerA) === true);
  ok(m(A, EIP55_VALID[1]) === false); ok(m(A, A.slice(0, 41) + (A[41] === '0' ? '1' : '0')) === false);
  ok(m(lowerA, flipLast(lowerA)) === false);
  // other 0x hex values: case-insensitive; the prefix must be lowercase 0x and both sides hex
  ok(m('0xAB', '0xab') === true); ok(m('0xABCDEF', '0xabcdef') === true); ok(m('0xAB', '0xac') === false);
  ok(m('0xAB', '0xabg') === false); ok(m('0xabg', '0xABG') === false);
  ok(m('0XAB', '0xab') === false); ok(m('0xAB', '0XAB') === false);
  ok(m('0x', '0x') === true); ok(m('0xAB', 'AB') === false); ok(m('0xAB', 'ab') === false);
  ok(m('ABCDEF', 'abcdef') === false); ok(m('ABCDEF', 'ABCDEF') === true);
  ok(m('0xAB ', '0xab') === true); ok(m('0xAB', '0xabab') === false);
  // 39- and 41-digit hex strings are not addresses; only the generic 0x-hex rule applies
  const h39 = 'a'.repeat(39), h41 = 'a'.repeat(41);
  ok(m('0x' + h39, '0x' + h39.toUpperCase()) === true); ok(m('0x' + h41, '0x' + h41.toUpperCase()) === true);
  ok(m(h39, h39.toUpperCase()) === false); ok(m(h41, h41.toUpperCase()) === false);
  ok(m(h39 + 'a', (h39 + 'a').toUpperCase()) === true);
  // an address-shaped value never matches a non-address value of the same letters
  ok(m(A, 'not an address') === false); ok(m('not an address', lowerA) === false);
  // 40 hex plus a stray char is not an address; must compare as hex/string, never case-folded without 0x
  ok(m(h41.slice(0, 40) + 'z', (h41.slice(0, 40) + 'z').toUpperCase()) === false);
  ok(m('z' + h41.slice(0, 40), ('z' + h41.slice(0, 40)).toUpperCase()) === false);
  ok(m(h41.slice(0, 40) + '\nz', h41.toUpperCase().slice(0, 40) + '\nz') === false);
  // presence: absent on either side -> match null and the claimed/onchain echo null
  let fc = run({ a: '1', onlyC: '2' }, { a: '1', onlyO: '3' }).output_payload.field_comparison;
  ok(same(fc.map((f) => f.field), ['a', 'onlyC', 'onlyO']));
  ok(fc[0].match === true && fc[1].match === null && fc[2].match === null);
  ok(fc[1].present_in_claimed === true && fc[1].present_in_onchain === false && fc[1].claimed === '2' && fc[1].onchain === null);
  ok(fc[2].present_in_claimed === false && fc[2].present_in_onchain === true && fc[2].claimed === null && fc[2].onchain === '3');
  ok(fc[0].present_in_claimed === true && fc[0].present_in_onchain === true && fc[0].claimed === '1' && fc[0].onchain === '1');
  // an explicitly-undefined value on either side is "nothing to compare" (null), never a string match
  ok(m(undefined, undefined) === null); ok(m(undefined, 'x') === null); ok(m('x', undefined) === null); ok(m(undefined, null) === null); ok(m(null, undefined) === null);
  // null never equals the string "null" (nor any stringification), in either direction
  ok(m(null, 'null') === false); ok(m('null', null) === false); ok(m(null, 'NULL') === false); ok(m(null, ' null ') === false);
  // an address is not equal to a non-address that merely folds to the same digits: "0X" is not the address prefix
  ok(m(A, '0X' + lowerA.slice(2)) === false); ok(m('0X' + lowerA.slice(2), A) === false);
  ok(m(A, '0X' + A.slice(2)) === false); ok(m('0X' + A.slice(2), A.toLowerCase()) === false);
  // keys inherited from Object.prototype are not "present"
  fc = run({ constructor: 'x', toString: 'y' }, { valueOf: 'z', constructor: 'x' }).output_payload.field_comparison;
  ok(same(fc.map((f) => f.field), ['constructor', 'toString', 'valueOf']));
  ok(fc[0].present_in_claimed && fc[0].present_in_onchain && fc[0].match === true);
  ok(fc[1].present_in_claimed && !fc[1].present_in_onchain && fc[2].present_in_onchain && !fc[2].present_in_claimed);
  // explicit-null value is present (match true when both null), distinct from absent (match null)
  fc = run({ n: null, p: null }, { n: null }).output_payload.field_comparison;
  ok(fc[0].match === true && fc[0].present_in_claimed && fc[0].present_in_onchain && fc[1].match === null && fc[1].present_in_claimed && !fc[1].present_in_onchain);
  // opaque_identifier: /agent[_-]?id/i anywhere in the key, case-insensitive
  fc = run({ agent_id: '1', 'agent-id': '1', agentId: '1', AGENTID: '1', xAgent_IDx: '1', agentXid: '1', agent: '1', id: '1', 'agent id': '1' }, { agent_id: '1', 'agent-id': '1', agentId: '1', AGENTID: '1', xAgent_IDx: '1', agentXid: '1', agent: '1', id: '1', 'agent id': '1' }).output_payload.field_comparison;
  const opaque = Object.fromEntries(fc.map((f) => [f.field, f.opaque_identifier]));
  ok(opaque.agent_id === true && opaque['agent-id'] === true && opaque.agentId === true && opaque.AGENTID === true && opaque.xAgent_IDx === true);
  ok(opaque.agentXid === false && opaque.agent === false && opaque.id === false && opaque['agent id'] === false);
  return { name: 'P8_value_match_semantics', trials: checked, violations };
}
function flipLast(s) { const last = s[s.length - 1]; return s.slice(0, -1) + (last === '0' ? '1' : '0'); }

function checkP9_eip55Checksum() {
  let violations = 0, checked = 0;
  const ok = (cond) => { checked++; if (!cond) violations++; };
  const chk = (v, key = 'agentAddress') => run({ [key]: v }, { [key]: v }).output_payload;
  // every published EIP-55 example is VALID; flipping the case of any single letter makes it INVALID
  for (const a of EIP55_VALID) {
    let o = chk(a);
    const f = o.address_checksum_findings[0];
    ok(o.address_checksum_findings.length === 1 && f.field === 'agentAddress' && f.value === a && f.checksum_verdict === 'VALID' && f.expected_checksum === a);
    ok(f.detail === 'Mixed-case address matches its EIP-55 checksum encoding.');
    ok(o.overall_determination === 'CONSISTENT');
    ok(o.findings[1].check === 'address_checksum_validity' && o.findings[1].verdict === 'CONSISTENT' && o.findings[1].detail === 'agentAddress:VALID');
    // no 0x prefix, still valid
    o = chk(a.slice(2));
    ok(o.address_checksum_findings[0].checksum_verdict === 'VALID' && o.address_checksum_findings[0].value === a.slice(2) && o.address_checksum_findings[0].expected_checksum === a);
    // surrounding whitespace is trimmed from the reported value
    o = chk('  ' + a + '\t');
    ok(o.address_checksum_findings[0].value === a && o.address_checksum_findings[0].checksum_verdict === 'VALID');
    // single-letter case flips (first letter position and every 5th position keeps cost low)
    for (let i = 2; i < 42; i += 3) {
      if (!/[a-fA-F]/.test(a[i])) continue;
      const bad = flipCase(a, i);
      const fb = chk(bad);
      const g = fb.address_checksum_findings[0];
      ok(g.checksum_verdict === 'INVALID' && g.expected_checksum === a && g.value === bad);
      ok(g.detail === 'Mixed-case address does NOT match its EIP-55 checksum encoding -- possible transcription error.');
      ok(fb.overall_determination === 'INCONSISTENT' && fb.findings[1].verdict === 'INCONSISTENT' && fb.findings[1].detail === 'agentAddress:INVALID');
      ok(same(compute({ ...HDR, claimed_entry: { agentAddress: bad }, onchain_record: { agentAddress: bad } }).compliance_flags, ['ERC8004_ENTRY_CONSISTENT', 'ERC8004_CHECKSUM_INVALID']));
    }
  }
  // all-upper / all-lower / digits-only: checksum cannot be judged -> NOT_APPLICABLE, no expected_checksum
  const NA_DETAIL = 'Value is all-lowercase or all-uppercase hex -- EIP-55 checksum cannot be judged (mixed-case is required to carry checksum information).';
  for (const a of [...EIP55_ALLCAPS, ...EIP55_ALLLOWER, '0x' + '1234567890'.repeat(4), '0x' + 'A1B2C3D4E5'.repeat(4), '0x' + 'a1b2c3d4e5'.repeat(4)]) {
    for (const v of [a, a.slice(2)]) {
      const o = chk(v);
      const f = o.address_checksum_findings[0];
      ok(f.checksum_verdict === 'NOT_APPLICABLE' && f.detail === NA_DETAIL && f.value === v && !('expected_checksum' in f));
      ok(o.findings[1].verdict === 'INDETERMINATE' && o.findings[1].detail === 'agentAddress:NOT_APPLICABLE');
      ok(o.overall_determination === 'INDETERMINATE');
    }
  }
  // 0x-prefix: lowercase 0x only; uppercase 0X makes it a non-address (no finding)
  ok(chk('0X' + EIP55_VALID[0].slice(2)).address_checksum_findings.length === 0);
  // address-shaped detection: exactly 40 hex digits, anchored
  for (const v of [EIP55_VALID[0] + 'a', EIP55_VALID[0].slice(0, 41), 'z' + EIP55_VALID[0].slice(2), EIP55_VALID[0].slice(2) + '\nzz', 'x' + EIP55_VALID[0], '0xx' + EIP55_VALID[0].slice(2)]) {
    ok(chk(v, 'agentAddress').address_checksum_findings.length === 0);
    ok(chk(v, 'misc').address_checksum_findings.length === 0);
  }
  // key rule: key matches /address/i OR value address-shaped; but a finding needs an address-shaped string value
  ok(chk(EIP55_VALID[1], 'plainKey').address_checksum_findings.length === 1);
  ok(chk(EIP55_VALID[1], 'ADDRESS').address_checksum_findings.length === 1);
  ok(chk('nope', 'someAddress').address_checksum_findings.length === 0);
  ok(chk(12345, 'someAddress').address_checksum_findings.length === 0);
  ok(chk(null, 'someAddress').address_checksum_findings.length === 0);
  ok(chk('', 'someAddress').address_checksum_findings.length === 0);
  ok(chk(['0x' + 'a'.repeat(40)], 'someAddress').address_checksum_findings.length === 0);
  ok(chk('plain text', 'note').address_checksum_findings.length === 0);
  // checksum findings come from onchain_record only: a claimed-only address is never checked
  let o = run({ agentId: '1', agentAddress: EIP55_VALID[0] }, { agentId: '1' }).output_payload;
  ok(o.address_checksum_findings.length === 0 && o.findings[1].verdict === 'INDETERMINATE' && o.findings[1].detail === 'No address-shaped field found in onchain_record to check.');
  // mixed-case address with prefix-less compare (hex40 reconstruction): lowercase 'a'-'f' inside valid addr
  // aggregation table over several address fields
  const V = EIP55_VALID;
  const badIdx = V[0].search(/[a-fA-F]/);
  const bad = flipCase(V[0], badIdx);
  const mk = (onchain) => compute({ ...HDR, claimed_entry: { k: 'v' }, onchain_record: { k: 'v', ...onchain } });
  let r = mk({ a1: V[1], a2: V[2] }); // VALID + VALID
  ok(r.output_payload.findings[1].verdict === 'CONSISTENT' && r.output_payload.findings[1].detail === 'a1:VALID, a2:VALID');
  ok(same(r.compliance_flags, ['ERC8004_ENTRY_CONSISTENT', 'ERC8004_CHECKSUM_VALID']) && r.output_payload.overall_determination === 'CONSISTENT');
  r = mk({ a1: V[1], a2: EIP55_ALLLOWER[0] }); // VALID + NOT_APPLICABLE
  ok(r.output_payload.findings[1].verdict === 'CONSISTENT' && r.output_payload.findings[1].detail === 'a1:VALID, a2:NOT_APPLICABLE');
  ok(r.output_payload.overall_determination === 'CONSISTENT');
  r = mk({ a1: V[1], a2: bad }); // VALID + INVALID
  ok(r.output_payload.findings[1].verdict === 'INCONSISTENT' && r.output_payload.findings[1].detail === 'a1:VALID, a2:INVALID');
  ok(same(r.compliance_flags, ['ERC8004_ENTRY_CONSISTENT', 'ERC8004_CHECKSUM_INVALID']) && r.output_payload.overall_determination === 'INCONSISTENT');
  r = mk({ a1: EIP55_ALLLOWER[0], a2: EIP55_ALLCAPS[0] }); // NA + NA
  ok(r.output_payload.findings[1].verdict === 'INDETERMINATE');
  ok(same(r.compliance_flags, ['ERC8004_ENTRY_CONSISTENT', 'ERC8004_CHECKSUM_NOT_APPLICABLE']) && r.output_payload.overall_determination === 'INDETERMINATE');
  r = mk({ a1: EIP55_ALLLOWER[0], a2: bad }); // NA + INVALID
  ok(r.output_payload.findings[1].verdict === 'INCONSISTENT' && r.output_payload.overall_determination === 'INCONSISTENT');
  r = mk({}); // none
  ok(r.output_payload.findings[1].verdict === 'INDETERMINATE' && same(r.compliance_flags, ['ERC8004_ENTRY_CONSISTENT', 'ERC8004_CHECKSUM_NOT_APPLICABLE']));
  return { name: 'P9_eip55_checksum_reference_vectors', trials: checked, violations };
}

function checkP10_verdictAggregation() {
  let violations = 0, checked = 0;
  const ok = (cond) => { checked++; if (!cond) violations++; };
  const V = EIP55_VALID[0], BAD = flipCase(V, V.search(/[a-fA-F]/));
  // entry-check detail strings (exact) and flags
  let r = run({ a: '1', b: '2', c: '3' }, { a: '1', b: '2', c: '3' });
  ok(r.output_payload.findings[0].detail === '3 field(s) compared, all match between claimed_entry and onchain_record.' && r.output_payload.findings[0].verdict === 'CONSISTENT');
  r = run({ a: '1', b: '2', c: '3' }, { a: '1', b: 'X', c: 'Y', d: '4' });
  ok(r.output_payload.findings[0].verdict === 'INCONSISTENT' && r.output_payload.findings[0].detail === '2 of 3 compared field(s) do NOT match: b, c.');
  ok(same(r.compliance_flags, ['ERC8004_ENTRY_INCONSISTENT', 'ERC8004_CHECKSUM_NOT_APPLICABLE']));
  r = run({ a: '1' }, { b: '1' });
  ok(r.output_payload.findings[0].verdict === 'INDETERMINATE' && r.output_payload.findings[0].detail === 'No field is present in both claimed_entry and onchain_record -- nothing was comparable.');
  ok(same(r.compliance_flags, ['ERC8004_ENTRY_INDETERMINATE', 'ERC8004_CHECKSUM_NOT_APPLICABLE']) && r.output_payload.overall_determination === 'INDETERMINATE');
  // one comparable field is enough; a single mismatch alone is INCONSISTENT; absent fields never count as mismatches
  r = run({ a: '1', only: 'z' }, { a: '1' });
  ok(r.output_payload.findings[0].detail === '1 field(s) compared, all match between claimed_entry and onchain_record.' && r.output_payload.overall_determination === 'INDETERMINATE');
  r = run({ a: '1' }, { a: '2' });
  ok(r.output_payload.findings[0].detail === '1 of 1 compared field(s) do NOT match: a.' && r.output_payload.overall_determination === 'INCONSISTENT');
  // entry x checksum aggregation table: INCONSISTENT > INDETERMINATE > CONSISTENT
  const E = { C: [{ f: '1' }, { f: '1' }], X: [{ f: '1' }, { f: '2' }], I: [{ f: '1' }, { g: '1' }] };
  const K = { C: { addr: V }, X: { addr: BAD }, I: {} };
  const FLAGS = {
    C: 'ERC8004_ENTRY_CONSISTENT', X: 'ERC8004_ENTRY_INCONSISTENT', I: 'ERC8004_ENTRY_INDETERMINATE',
  };
  const CFLAGS = { C: 'ERC8004_CHECKSUM_VALID', X: 'ERC8004_CHECKSUM_INVALID', I: 'ERC8004_CHECKSUM_NOT_APPLICABLE' };
  const VERD = { C: 'CONSISTENT', X: 'INCONSISTENT', I: 'INDETERMINATE' };
  const rank = (a, b) => (a === 'X' || b === 'X') ? 'INCONSISTENT' : (a === 'I' || b === 'I') ? 'INDETERMINATE' : 'CONSISTENT';
  for (const e of 'CXI') {
    for (const k of 'CXI') {
      const [cl, oc] = E[e];
      const res = compute({ ...HDR, claimed_entry: cl, onchain_record: { ...oc, ...K[k] } });
      const o = res.output_payload;
      ok(o.findings[0].verdict === VERD[e] && o.findings[1].verdict === VERD[k]);
      ok(o.overall_determination === rank(e, k));
      ok(same(res.compliance_flags, [FLAGS[e], CFLAGS[k]]));
      ok(o.findings.length === 2 && o.findings[0].check === 'entry_field_consistency' && o.findings[1].check === 'address_checksum_validity');
    }
  }
  // checksum validity is independent of match: a checksum-invalid but content-matching address, and vice versa
  r = run({ agentAddress: BAD }, { agentAddress: BAD });
  ok(r.output_payload.findings[0].verdict === 'CONSISTENT' && r.output_payload.findings[1].verdict === 'INCONSISTENT');
  r = run({ agentAddress: EIP55_VALID[1] }, { agentAddress: V });
  ok(r.output_payload.findings[0].verdict === 'INCONSISTENT' && r.output_payload.findings[1].verdict === 'CONSISTENT');
  // static fences always present
  ok(typeof r.output_payload.scope_note === 'string' && r.output_payload.scope_note.startsWith('Checks whether a caller-supplied claimed registry entry'));
  ok(r.output_payload.not_proven.length === 4 && r.output_payload.not_proven[0].item === 'Current on-chain state' && r.output_payload.not_proven[3].item === 'Registry contract correctness');
  ok(r.output_payload.agent_id_handling.startsWith('agent_id (any key matching /agent[_-]?id/i) is compared as an opaque literal string only'));
  return { name: 'P10_verdict_aggregation_table', trials: checked, violations };
}

async function checkP11_hashRefusalBoundaries() {
  let violations = 0, checked = 0;
  const ok = (cond) => { checked++; if (!cond) violations++; };
  const nest = (n) => { const root = {}; let cur = root; for (let i = 1; i < n; i++) { cur.n = {}; cur = cur.n; } return root; };
  const base = { ...HDR, claimed_entry: { a: '1' }, onchain_record: { a: '1' } };
  const refuse = async (extra) => buildArtifact({ ...base, ...extra }, /** @type {any} */ ({ now: '2026-01-01T00:00:00Z' }));
  const LIM = 'REFUSED_INPUT_HASH_LIMIT', NUM = 'REFUSED_INPUT_UNSAFE_NUMBER';
  const cases = [
    [{ chain_id: NaN }, NUM, 'pp.chain_id: non_finite'],
    [{ chain_id: Infinity }, NUM, 'pp.chain_id: non_finite'],
    [{ chain_id: -Infinity }, NUM, 'pp.chain_id: non_finite'],
    [{ chain_id: 2 ** 53 }, NUM, 'pp.chain_id: unsafe_integer'],
    [{ chain_id: -(2 ** 53) }, NUM, 'pp.chain_id: unsafe_integer'],
    [{ chain_id: 1e300 }, NUM, 'pp.chain_id: unsafe_integer'],
    [{ claimed_entry: { z: 1, a: NaN } }, NUM, 'pp.claimed_entry.a: non_finite'],
    [{ claimed_entry: { b: Infinity, a: NaN } }, NUM, 'pp.claimed_entry.a: non_finite'],
    [{ claimed_entry: { list: [1, [2, NaN]] } }, NUM, 'pp.claimed_entry.list[1][1]: non_finite'],
    [{ claimed_entry: { list: [1, 2 ** 60] } }, NUM, 'pp.claimed_entry.list[1]: unsafe_integer'],
    [{ onchain_record: { o: { p: [Infinity] } } }, NUM, 'pp.onchain_record.o.p[0]: non_finite'],
    [{ chain_id: new Array(1000000).fill(0) }, LIM, 'pp.chain_id[999998]: too_many_values'],
    [{ chain_id: nest(512) }, LIM, null],
    [{ chain_id: [nest(511)] }, LIM, null],
  ];
  for (const [extra, reason, detail] of cases) {
    const a = await refuse(extra);
    ok(a.execution_hash === null && a.hash_refusal.reason === reason);
    if (detail !== null) ok(a.hash_refusal.detail === detail);
    else ok(a.hash_refusal.detail.endsWith(': too_deep') && a.hash_refusal.detail.startsWith('pp.chain_id'));
    ok(a.policy_parameters === null && same(a.compliance_flags, ['INPUT_REFUSED']));
    ok(same(a.output_payload, { overall_determination: 'INDETERMINATE', refusal: reason }));
    ok(a.generated_at === '2026-01-01T00:00:00Z' && a.tool_id === 'art-604-erc8004-registry-entry-verifier' && a.tool_version === '1.0.0');
    ok(a.chaingraph_version === '0.4.0' && a.compute_mode === 'server' && a.mandate_type === 'compliance_control');
    ok(same(a.chain, { parent_hashes: [], parent_tool_ids: [], chain_depth: 0 }));
    ok(a.audit_signature.payload === '' && same(a.audit_signature.signatures, []));
  }
  // depth boundary: a kernel-side depth of 511 hashes fine (the hash preimage adds one wrapper level), 513 is refused
  const okDeep = await refuse({ chain_id: nest(510) });
  ok(okDeep.execution_hash === null ? false : typeof okDeep.execution_hash === 'string');
  // null / undefined leaves are walked as non-containers: no throw, no refusal, a hash is produced
  for (const extra of [{ chain_id: null }, { registry_address: null }, { claimed_entry: { a: '1', n: null }, onchain_record: { a: '1', n: null } }, { claimed_entry: { a: '1', l: [null, 'x'] }, onchain_record: { a: '1' } }]) {
    let a = null, threw = false;
    try { a = await refuse(extra); } catch (e) { threw = true; }
    ok(!threw && a.execution_hash !== null && typeof a.execution_hash === 'string' && !('hash_refusal' in a));
  }
  // safe path: a clean call returns hash, deferred proof, parent chain echo, no refusal
  const pp = { ...base };
  const good = await buildArtifact(pp, /** @type {any} */ ({ now: '2026-02-02T00:00:00Z', parent_hashes: ['h1'], parent_tool_ids: ['t1'], chain_depth: 2 }));
  const expected = await executionHash(pp, compute(pp).output_payload);
  ok(good.execution_hash === expected && typeof good.execution_hash === 'string' && !('hash_refusal' in good));
  ok(good.compute_proof_ready === 'deferred' && good.generated_at === '2026-02-02T00:00:00Z' && same(good.policy_parameters, pp));
  ok(same(good.chain, { parent_hashes: ['h1'], parent_tool_ids: ['t1'], chain_depth: 2 }) && same(good.compliance_flags, compute(pp).compliance_flags));
  const noNow = await buildArtifact(pp);
  ok(noNow.generated_at === null && same(noNow.chain, { parent_hashes: [], parent_tool_ids: [], chain_depth: 0 }));
  // a safe integer and a plain float are not refused
  ok((await refuse({ chain_id: 2 ** 53 - 1 })).execution_hash !== null);
  ok((await refuse({ chain_id: -(2 ** 53 - 1) })).execution_hash !== null);
  ok((await refuse({ claimed_entry: { r: 1.5 }, onchain_record: { r: 1.5 } })).execution_hash !== null);
  return { name: 'P11_hash_refusal_boundaries_and_artifact_shape', trials: checked, violations };
}

// ---------- run ----------
const oracleOk = runFixtureOracle();
if (!oracleOk) {
  console.error('FIXTURE ORACLE FAILED -- spec/harness not trusted. Failures:', JSON.stringify(results.fixture_oracle.failures, null, 2));
  process.exit(1);
}

const negControl = negativeControl();
if (!negControl.rejected_wrong_spec) {
  console.error('NEGATIVE CONTROL FAILED -- comparator never observed rejecting a wrong output.');
  process.exit(1);
}

results.properties.push(checkP1_determinism());
results.properties.push(checkP2_missingRequiredForcesIndeterminate());
results.properties.push(checkP3_valueMismatchForcesInconsistent());
results.properties.push(checkP4_outputShapeInvariant());
results.properties.push(checkP5_requiredFieldNeverPositive());
results.properties.push(await checkP6_buildArtifactNeverThrows());
results.properties.push(checkP7_inputValidationReasons());
results.properties.push(checkP8_valueMatchSemantics());
results.properties.push(checkP9_eip55Checksum());
results.properties.push(checkP10_verdictAggregation());
results.properties.push(await checkP11_hashRefusalBoundaries());

const anyPropertyViolation = results.properties.some((p) => p.violations > 0);

console.log(JSON.stringify({
  kernel_id: 'art-604-erc8004-registry-entry-verifier',
  fixture_oracle_passed: oracleOk,
  fixture_oracle_total: results.fixture_oracle.total,
  negative_control: negControl,
  properties: results.properties,
  any_property_violation: anyPropertyViolation,
}, null, 2));

process.exit(anyPropertyViolation ? 1 : 0);
