// 804-ivms101-skeleton-validator — class-K property-test FLOOR.
// kernel_digest_at_authoring: sha256:28ae17659f4fe922f392a50158befd5621a497254936b4636fb75811abfdf94e
// spec: LANDSCAPE-IVMS101-VALIDATOR-1 (zero-PII skeleton contract, pinned IVMS 101.2023 rules)
// human_sign_off: PENDING
//
// Properties (FV-PBT-FLOOR-BUILD-SPEC.md):
//   P1+P2 NO-ECHO / REFUSAL-AT-PATH: for randomized payloads carrying injected free-text
//      junk strings (lengths 1..600 — far beyond the longest code-list value) in free-text
//      leaves, JSON.stringify(compute().output_payload) never contains the injected string,
//      and exactly one PII-REFUSAL violation fires at exactly that JSON path.
//   P3 EDITION FAIL-CLOSED: any declared edition other than the pinned "101.2023" yields a
//      single EDITION violation at path ivms101_edition and NO other rule ids.
//   P4 OUTPUT SHAPE + DETERMINISM: violations are {path, rule_id, section} string triples,
//      sorted by (path, rule_id); identical calls give identical payloads; valid flag is a
//      boolean equal to (violation_count === 0); 'SYNTHETIC' itself is never echoed.
//   P5 SYNTHETIC ACCEPTANCE: an all-placeholder clean payload validates valid=true.
//
// ZERO external dependencies — Node built-ins plus the in-repo _pbt-common.mjs helpers.
//
// Run: node chaingraph/kernels/__proptests__/804-ivms101-skeleton-validator.proptest.mjs

import { compute } from '../804-ivms101-skeleton-validator.kernel.mjs';
import { mulberry32, runFixtureOracle, summarize } from './_pbt-common.mjs';

const KERNEL_ID = '804-ivms101-skeleton-validator';

const JUNK_ALPHABET = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ .,;:-';
function junkString(rng, len) {
  let s = '';
  for (let i = 0; i < len; i++) s += JUNK_ALPHABET[Math.floor(rng() * JUNK_ALPHABET.length)];
  return s;
}

const FREE_TEXT_LEAVES = [
  'payload.originator[0].naturalPerson.name.nameIdentifier[0].primaryIdentifier',
  'payload.beneficiary[0].naturalPerson.name.nameIdentifier[0].secondaryIdentifier',
  'payload.originator[0].legalPerson.name.nameIdentifier[0].legalPersonName',
  'payload.beneficiary[0].legalPerson.geographicAddress[0].streetName',
  'payload.originator[0].naturalPerson.geographicAddress[0].townName',
  'payload.originatingVASP.legalPerson.name.nameIdentifier[0].legalPersonName',
];

function setAtPath(root, path, value) {
  const parts = path.replace(/\]/g, '').split(/[\[.]/);
  let node = root;
  for (let k = 0; k < parts.length - 1; k++) node = node[parts[k]];
  node[parts[parts.length - 1]] = value;
}

function pathExists(root, path) {
  const parts = path.replace(/\]/g, '').split(/[\[.]/);
  let node = root;
  for (const k of parts) {
    if (node === null || typeof node !== 'object' || !(k in node)) return false;
    node = node[k];
  }
  return true;
}

function pickLivePath(rng, pp) {
  for (let tries = 0; tries < 20; tries++) {
    const path = FREE_TEXT_LEAVES[Math.floor(rng() * FREE_TEXT_LEAVES.length)];
    if (pathExists(pp, path)) return path;
  }
  return 'payload.originator[0].legalPerson.name.nameIdentifier[0].legalPersonName';
}

function basePayload(rng) {
  const pid = rng() < 0.5 ? 'SYNTHETIC' : { len: 1 + Math.floor(rng() * 100) };
  return {
    ivms101_edition: '101.2023',
    payload: {
      originator: [
        rng() < 0.5
          ? { naturalPerson: { name: { nameIdentifier: [{ primaryIdentifier: pid, naturalPersonNameIdentifierType: 'LEGL' }] }, geographicAddress: [{ addressType: 'HOME', streetName: { len: 10 }, townName: { len: 6 }, country: 'DE' }] } }
          : { legalPerson: { name: { nameIdentifier: [{ legalPersonName: { len: 20 }, legalPersonNameIdentifierType: 'LEGL' }] }, geographicAddress: [{ addressType: 'BIZZ', streetName: { len: 10 }, townName: { len: 6 }, country: 'DE' }], nationalIdentification: { nationalIdentifier: { len: 20 }, nationalIdentifierType: 'LEIX' } } },
      ],
      beneficiary: [
        rng() < 0.5
          ? { naturalPerson: { name: { nameIdentifier: [{ primaryIdentifier: 'SYNTHETIC', secondaryIdentifier: { len: 4 }, naturalPersonNameIdentifierType: 'LEGL' }] }, geographicAddress: [{ addressType: 'GEOG', addressLine: [{ len: 15 }], townName: { len: 6 }, country: 'FR' }] } }
          : { legalPerson: { name: { nameIdentifier: [{ legalPersonName: 'SYNTHETIC', legalPersonNameIdentifierType: 'LEGL' }] }, geographicAddress: [{ addressType: 'GEOG', addressLine: [{ len: 15 }], townName: { len: 6 }, country: 'FR' }], nationalIdentification: { nationalIdentifier: { len: 12 }, nationalIdentifierType: 'TXID', registrationAuthority: 'RA000000' } } },
      ],
      originatingVASP: { legalPerson: { name: { nameIdentifier: [{ legalPersonName: { len: 18 }, legalPersonNameIdentifierType: 'LEGL' }] }, nationalIdentification: { nationalIdentifier: { len: 20 }, nationalIdentifierType: 'LEIX' } } },
      payloadMetadata: { payloadVersion: '101.2023' },
    },
  };
}

// P1 + P2.
function checkP1P2_noEchoRefusalByPath() {
  let checked = 0, violations = 0;
  const rng = mulberry32(804001);
  for (let i = 0; i < 300; i++) {
    const pp = basePayload(rng);
    const path = pickLivePath(rng, pp);
    const junk = junkString(rng, 1 + Math.floor(rng() * 600));
    setAtPath(pp, path, junk);

    const out = JSON.stringify(compute(pp).output_payload);
    checked++;
    if (out.includes(junk)) { violations++; continue; }
    const res = compute(pp).output_payload;
    const refusals = res.violations.filter((v) => v.rule_id === 'PII-REFUSAL');
    const atPath = refusals.filter((v) => v.path === path);
    if (refusals.length !== 1 || atPath.length !== 1) violations++;
  }
  return { name: 'P1_P2_no_echo_and_refusal_by_path', checked, violations };
}

// P3.
function checkP3_editionFailClosed() {
  let checked = 0, violations = 0;
  const rng = mulberry32(804002);
  for (const ed of ['101', '101.2024', '2023', '', '101.2023 ', null]) {
    const pp = /** @type {any} */ (basePayload(rng));
    pp.ivms101_edition = ed;
    const path = pickLivePath(rng, pp);
    setAtPath(pp, path, junkString(rng, 50 + Math.floor(rng() * 100)));
    const op = compute(pp).output_payload;
    checked++;
    if (op.valid !== false || op.violation_count !== 1 || op.violations.length !== 1) violations++;
    else if (op.violations[0].rule_id !== 'EDITION' || op.violations[0].path !== 'ivms101_edition') violations++;
  }
  return { name: 'P3_edition_fail_closed', checked, violations };
}

// P4.
function checkP4_shapeDeterminism() {
  let checked = 0, violations = 0;
  const rng = mulberry32(804003);
  for (let i = 0; i < 300; i++) {
    const pp = /** @type {any} */ (basePayload(rng));
    if (rng() < 0.5) pp.payload.beneficiary[0] = { naturalPerson: { name: { nameIdentifier: [{ primaryIdentifier: 'SYNTHETIC', naturalPersonNameIdentifierType: 'NOPE' }] } } };
    const { output_payload: a } = compute(pp);
    const { output_payload: b } = compute(pp);
    checked++;
    if (JSON.stringify(a) !== JSON.stringify(b)) { violations++; continue; }
    if (typeof a.valid !== 'boolean' || a.valid !== (a.violation_count === 0)) violations++;
    if (a.violation_count !== a.violations.length) violations++;
    for (let k = 1; k < a.violations.length; k++) {
      const p = a.violations[k - 1], q = a.violations[k];
      if (!(p.path < q.path || (p.path === q.path && p.rule_id <= q.rule_id))) violations++;
    }
    for (const v of a.violations) {
      const keys = Object.keys(v);
      if (keys.length !== 3 || keys.some((k) => typeof v[k] !== 'string')) violations++;
    }
    if (JSON.stringify(a).includes('SYNTHETIC') && a.violations.length === 0) violations++;
  }
  return { name: 'P4_shape_determinism_sorted', checked, violations };
}

// P5.
function checkP5_syntheticClean() {
  const pp = {
    ivms101_edition: '101.2023',
    payload: {
      originator: [
        {
          legalPerson: {
            name: { nameIdentifier: [{ legalPersonName: 'SYNTHETIC', legalPersonNameIdentifierType: 'LEGL' }] },
            geographicAddress: [{ addressType: 'BIZZ', streetName: 'SYNTHETIC', buildingName: 'SYNTHETIC', buildingNumber: 'SYNTHETIC', townName: 'SYNTHETIC', country: 'DE' }],
            nationalIdentification: { nationalIdentifier: 'SYNTHETIC', nationalIdentifierType: 'LEIX' },
          },
          accountNumber: ['SYNTHETIC', 'SYNTHETIC'],
        },
      ],
      beneficiary: [
        {
          naturalPerson: {
            name: { nameIdentifier: [{ primaryIdentifier: 'SYNTHETIC', secondaryIdentifier: 'SYNTHETIC', naturalPersonNameIdentifierType: 'LEGL' }] },
            geographicAddress: [{ addressType: 'HOME', addressLine: ['SYNTHETIC'], townName: 'SYNTHETIC', country: 'FR' }],
            dateAndPlaceOfBirth: { dateOfBirth: '1975-01-01', placeOfBirth: 'SYNTHETIC' },
          },
        },
      ],
      payloadMetadata: { payloadVersion: '101.2023', transliterationMethod: ['cyrl'] },
    },
  };
  const op = compute(pp).output_payload;
  return { name: 'P5_synthetic_payload_clean', checked: 1, violations: op.valid === true ? 0 : 1 };
}

// ---------- run ----------
let oracle;
try {
  oracle = runFixtureOracle(KERNEL_ID, compute);
} catch (e) {
  oracle = { total: 1, failures: [{ name: 'fixture-oracle-load', expected: '(compute() implemented)', got: String((e && e.message) || e) }] };
}
const properties = [
  checkP1P2_noEchoRefusalByPath(),
  checkP3_editionFailClosed(),
  checkP4_shapeDeterminism(),
  checkP5_syntheticClean(),
];
console.log(`[${KERNEL_ID}] class-K floor property test — zero-PII skeleton contract.`);
const ok = summarize(KERNEL_ID, oracle, properties);
process.exit(ok ? 0 : 1);
