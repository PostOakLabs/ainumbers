// 804-ivms101-skeleton-validator — class-K property-test FLOOR.
// kernel_digest_at_authoring: sha256:d0833bb58aac0609a743fac39fc17b82272ba45f853123873717db1f0068c6e0
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
//   P6 EXACT-VIOLATIONS TABLE (mutation-floor hardening): deterministic one-branch-per-row
//      cases — code-list accept/reject per slot with pinned sections, MAXLEN boundaries per
//      datatype, CARD shapes, skeleton-leaf contract, date/RA formats, PERSON-EXCL and the
//      C1/C2/C4-C9/C11/C12 constraints — each row deep-equals the full sorted violations
//      array (independent hand-authored oracle, not generated from compute()).
//   P7 FULL-PAYLOAD PINS: whole output_payload (rules_checked, edition, errors included)
//      deep-equals hand-pinned objects for clean / PII / edition / missing-edition inputs.
//   P8 COMPLIANCE-FLAGS PINS: exact flag arrays for the same four input classes, including
//      the EDITION short-circuit (no PII-REFUSAL can fire once the edition gate returns).
//   P9 FLAG-MIRROR CORRELATION (AUTHORING-STANDARD section 2.2): on randomized inputs the
//      "errors" mirror member is present, tracks violations pairwise as rule_id@path, and
//      is truthy exactly when the conditional flags are present.
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

// ---------- P6: exact-violations table (mutation-floor hardening) ----------
// One branch per row; expectations are hand-authored from the pinned IVMS 101.2023 rule
// map (never generated from compute()). V(path, rule, section) keeps rows compact; the
// expected array is sorted with the same (path, rule_id) comparator the kernel uses, so
// any ordering drift is a diff, not a coincidence.
function V(path, rule_id, section) { return { path, rule_id, section }; }
function vsort(arr) {
  return arr.slice().sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : a.rule_id < b.rule_id ? -1 : a.rule_id > b.rule_id ? 1 : 0));
}
const OK_ED = '101.2023';
function addrLine(type, extra) { return Object.assign({ addressType: type, streetName: { len: 10 }, townName: { len: 6 }, country: 'DE' }, extra || {}); }
function npEntry(type, pid) { return { primaryIdentifier: pid === undefined ? 'SYNTHETIC' : pid, naturalPersonNameIdentifierType: type }; }
function npLocalEntry(type) { return { primaryIdentifier: { len: 5 }, nameIdentifierType: type }; }
function lpEntry(type, name) { return { legalPersonName: name === undefined ? { len: 20 } : name, legalPersonNameIdentifierType: type }; }
function lpLocalEntry(type) { return { legalPersonName: { len: 20 }, legalPersonNameIdentifierType: type }; }
// Originator/beneficiary natural person, name-only unless addr/cust/natid/dob given.
function npPerson(o) {
  return { naturalPerson: Object.assign({ name: { nameIdentifier: [npEntry('LEGL')] } }, o || {}) };
}
function lpPerson(o) {
  return { legalPerson: Object.assign({ name: { nameIdentifier: [lpEntry('LEGL')] } }, o || {}) };
}
function ppOf(payload, edition) { return { ivms101_edition: edition === undefined ? OK_ED : edition, payload }; }
function withBen(person, originator) {
  return ppOf({ originator: originator || [npPerson({ geographicAddress: [addrLine('HOME')] })], beneficiary: [person], payloadMetadata: { payloadVersion: OK_ED } });
}

const P6_CASES = [];
function case6(name, pp, expect) { P6_CASES.push({ name, pp, expect: vsort(expect.map((e) => V(...e))) }); }

// -- edition fail-closed --
case6('edition-wrong', ppOf({ originator: [npPerson({ geographicAddress: [addrLine('HOME')] })], beneficiary: [npPerson()], payloadMetadata: { payloadVersion: OK_ED } }, '101.2024'),
  [['ivms101_edition', 'EDITION', '5.3.18']]);
case6('edition-null', ppOf({ originator: [npPerson({ geographicAddress: [addrLine('HOME')] })], beneficiary: [npPerson()], payloadMetadata: { payloadVersion: OK_ED } }, null),
  [['ivms101_edition', 'EDITION', '5.3.18']]);

// -- payload shape guards --
case6('payload-missing', { ivms101_edition: OK_ED }, [['payload', 'CARD', '6']]);
case6('payload-string', ppOf('x'), [['payload', 'CARD', '6']]);
case6('payload-array', ppOf([]), [['payload', 'CARD', '6']]);
case6('originator-empty-array', ppOf({ originator: [], beneficiary: [npPerson()], payloadMetadata: { payloadVersion: OK_ED } }), [['payload.originator', 'CARD', '6']]);
case6('beneficiary-missing', ppOf({ originator: [npPerson({ geographicAddress: [addrLine('HOME')] })], payloadMetadata: { payloadVersion: OK_ED } }), [['payload.beneficiary', 'REQUIRED', '6']]);
case6('metadata-missing', ppOf({ originator: [npPerson({ geographicAddress: [addrLine('HOME')] })], beneficiary: [npPerson()] }), [['payload.payloadMetadata', 'REQUIRED', '6']]);
case6('payloadVersion-missing', ppOf({ originator: [npPerson({ geographicAddress: [addrLine('HOME')] })], beneficiary: [npPerson()], payloadMetadata: {} }), [['payload.payloadMetadata.payloadVersion', 'REQUIRED', '6']]);

// -- code lists: every accepted enumeration value (one row per list kills list-entry mutants) --
case6('np-name-types-all', withBen(npPerson({ name: { nameIdentifier: ['ALIA', 'BIRT', 'MAID', 'LEGL', 'MISC'].map((t) => npEntry(t)) } })), []);
case6('np-local-name-types-all', withBen(npPerson({ name: { nameIdentifier: [npEntry('LEGL')], localNameIdentifier: ['ALIA', 'BIRT', 'MAID', 'LEGL', 'MISC'].map((t) => npLocalEntry(t)) } })), []);
case6('lp-name-types-all', withBen(lpPerson({ name: { nameIdentifier: ['LEGL', 'SHRT', 'TRAD'].map((t) => lpEntry(t)) } })), []);
case6('lp-local-name-types-all', withBen(lpPerson({ name: { nameIdentifier: [lpEntry('LEGL')], localNameIdentifier: ['LEGL', 'SHRT', 'TRAD'].map((t) => lpLocalEntry(t)) } })), []);
case6('address-types-all', withBen(npPerson({ geographicAddress: [addrLine('HOME'), addrLine('BIZZ'), addrLine('GEOG')] })), []);
case6('natid-types-all-np', ppOf({
  originator: [npPerson({ geographicAddress: [addrLine('HOME')] })],
  beneficiary: ['RAID', 'CCPT', 'DRLC', 'FIIN', 'SOCS', 'IDCD', 'LEIX', 'TXID', 'ARNU', 'MISC'].map((t) => npPerson({ nationalIdentification: { nationalIdentifier: { len: 20 }, nationalIdentifierType: t } })),
  payloadMetadata: { payloadVersion: OK_ED },
}), []);
case6('transliteration-all', ppOf({
  originator: [npPerson({ geographicAddress: [addrLine('HOME')] })],
  beneficiary: [npPerson()],
  payloadMetadata: { transliterationMethod: ['arab', 'aran', 'armn', 'cyrl', 'deva', 'geor', 'grek', 'hani', 'hebr', 'kana', 'kore', 'thai', 'othr'], payloadVersion: '101' },
}), []);
case6('country-format-accept', withBen(npPerson({ geographicAddress: [addrLine('GEOG', { country: 'ZZ' })], countryOfResidence: 'FR' })), []);

// -- code lists: one rejection per slot, pinned section --
case6('np-name-type-bad', withBen(npPerson({ name: { nameIdentifier: [npEntry('LEGL'), npEntry('XX')] } })),
  [['payload.beneficiary[0].naturalPerson.name.nameIdentifier[1].naturalPersonNameIdentifierType', 'CODE', '5.3.9']]);
case6('np-local-name-type-bad', withBen(npPerson({ name: { nameIdentifier: [npEntry('LEGL')], localNameIdentifier: [npLocalEntry('XX')] } })),
  [['payload.beneficiary[0].naturalPerson.name.localNameIdentifier[0].nameIdentifierType', 'CODE', '5.3.9']]);
case6('lp-name-type-bad', withBen(lpPerson({ name: { nameIdentifier: [lpEntry('LEGL'), lpEntry('XX')] } })),
  [['payload.beneficiary[0].legalPerson.name.nameIdentifier[1].legalPersonNameIdentifierType', 'CODE', '5.3.10']]);
case6('lp-local-name-type-bad', withBen(lpPerson({ name: { nameIdentifier: [lpEntry('LEGL')], localNameIdentifier: [lpLocalEntry('XX')] } })),
  [['payload.beneficiary[0].legalPerson.name.localNameIdentifier[0].legalPersonNameIdentifierType', 'CODE', '5.3.10']]);
case6('address-type-bad', withBen(npPerson({ geographicAddress: [addrLine('XX')] })),
  [['payload.beneficiary[0].naturalPerson.geographicAddress[0].addressType', 'CODE', '5.3.12']]);
case6('country-lowercase', withBen(npPerson({ geographicAddress: [addrLine('GEOG', { country: 'de' })] })),
  [['payload.beneficiary[0].naturalPerson.geographicAddress[0].country', 'CODE', '5.3.13']]);
case6('country-of-issue-bad', withBen(npPerson({ nationalIdentification: { nationalIdentifier: { len: 20 }, nationalIdentifierType: 'CCPT', countryOfIssue: 'ZZZ' } })),
  [['payload.beneficiary[0].naturalPerson.nationalIdentification.countryOfIssue', 'CODE', '5.3.13']]);
case6('country-of-registration-bad', withBen(lpPerson({ countryOfRegistration: '1A' })),
  [['payload.beneficiary[0].legalPerson.countryOfRegistration', 'CODE', '5.3.13']]);
case6('country-of-residence-bad', withBen(npPerson({ countryOfResidence: 'us' })),
  [['payload.beneficiary[0].naturalPerson.countryOfResidence', 'CODE', '5.3.13']]);
case6('natid-type-bad-np', withBen(npPerson({ nationalIdentification: { nationalIdentifier: { len: 20 }, nationalIdentifierType: 'XX' } })),
  [['payload.beneficiary[0].naturalPerson.nationalIdentification.nationalIdentifierType', 'CODE', '5.3.15']]);
case6('natid-type-nonstring-np', withBen(npPerson({ nationalIdentification: { nationalIdentifier: { len: 20 }, nationalIdentifierType: 42 } })),
  [['payload.beneficiary[0].naturalPerson.nationalIdentification.nationalIdentifierType', 'CODE', '5.3.15']]);
case6('transliteration-bad', ppOf({
  originator: [npPerson({ geographicAddress: [addrLine('HOME')] })],
  beneficiary: [npPerson()],
  payloadMetadata: { transliterationMethod: ['latn'], payloadVersion: OK_ED },
}), [['payload.payloadMetadata.transliterationMethod[0]', 'CODE', '5.3.17']]);
case6('payloadVersion-bad', ppOf({
  originator: [npPerson({ geographicAddress: [addrLine('HOME')] })],
  beneficiary: [npPerson()],
  payloadMetadata: { payloadVersion: '2023' },
}), [['payload.payloadMetadata.payloadVersion', 'CODE', '5.3.18']]);

// -- MAXLEN: one over-boundary row per datatype, plus an all-at-max clean row --
case6('maxlen-primary-101', withBen(npPerson({ name: { nameIdentifier: [npEntry('LEGL', { len: 101 })] } })),
  [['payload.beneficiary[0].naturalPerson.name.nameIdentifier[0].primaryIdentifier', 'MAXLEN', '5.3']]);
case6('maxlen-secondary-101', withBen(npPerson({ name: { nameIdentifier: [npEntry('LEGL', { len: 5 }), Object.assign(npEntry('BIRT'), { secondaryIdentifier: { len: 101 } })] } })),
  [['payload.beneficiary[0].naturalPerson.name.nameIdentifier[1].secondaryIdentifier', 'MAXLEN', '5.3']]);
case6('maxlen-local-primary-101', withBen(npPerson({ name: { nameIdentifier: [npEntry('LEGL')], localNameIdentifier: [{ primaryIdentifier: { len: 101 }, nameIdentifierType: 'LEGL' }] } })),
  [['payload.beneficiary[0].naturalPerson.name.localNameIdentifier[0].primaryIdentifier', 'MAXLEN', '5.3']]);
case6('maxlen-legal-name-101', withBen(lpPerson({ name: { nameIdentifier: [lpEntry('LEGL', { len: 101 })] } })),
  [['payload.beneficiary[0].legalPerson.name.nameIdentifier[0].legalPersonName', 'MAXLEN', '5.3']]);
case6('maxlen-street-71', withBen(npPerson({ geographicAddress: [addrLine('GEOG', { streetName: { len: 71 } })] })),
  [['payload.beneficiary[0].naturalPerson.geographicAddress[0].streetName', 'MAXLEN', '5.3']]);
case6('maxlen-department-51', withBen(npPerson({ geographicAddress: [addrLine('GEOG', { department: { len: 51 } })] })),
  [['payload.beneficiary[0].naturalPerson.geographicAddress[0].department', 'MAXLEN', '5.3']]);
case6('maxlen-buildingnumber-17', withBen(npPerson({ geographicAddress: [addrLine('GEOG', { buildingNumber: { len: 17 } })] })),
  [['payload.beneficiary[0].naturalPerson.geographicAddress[0].buildingNumber', 'MAXLEN', '5.3']]);
case6('maxlen-buildingname-36', withBen(npPerson({ geographicAddress: [addrLine('GEOG', { buildingName: { len: 36 } })] })),
  [['payload.beneficiary[0].naturalPerson.geographicAddress[0].buildingName', 'MAXLEN', '5.3']]);
case6('maxlen-townname-36', withBen(npPerson({ geographicAddress: [addrLine('GEOG', { townName: { len: 36 } })] })),
  [['payload.beneficiary[0].naturalPerson.geographicAddress[0].townName', 'MAXLEN', '5.3']]);
case6('maxlen-account-513', withBen(Object.assign(npPerson(), { accountNumber: [{ len: 513 }] })),
  [['payload.beneficiary[0].accountNumber[0]', 'MAXLEN', '5.3']]);
case6('maxlen-placeofbirth-71', withBen(npPerson({ dateAndPlaceOfBirth: { dateOfBirth: '1980-05-05', placeOfBirth: { len: 71 } } })),
  [['payload.beneficiary[0].naturalPerson.dateAndPlaceOfBirth.placeOfBirth', 'MAXLEN', '5.3']]);
case6('maxlen-custid-51', withBen(npPerson({ customerIdentification: { len: 51 } })),
  [['payload.beneficiary[0].naturalPerson.customerIdentification', 'MAXLEN', '5.3']]);
case6('maxlen-natid-36', withBen(npPerson({ nationalIdentification: { nationalIdentifier: { len: 36 }, nationalIdentifierType: 'CCPT' } })),
  [['payload.beneficiary[0].naturalPerson.nationalIdentification.nationalIdentifier', 'MAXLEN', '5.3']]);
case6('maxlen-all-at-max-clean', withBen(npPerson({
  name: { nameIdentifier: [npEntry('LEGL', { len: 100 })] },
  geographicAddress: [addrLine('GEOG', { streetName: { len: 70 }, townName: { len: 35 }, department: { len: 50 }, buildingNumber: { len: 16 }, buildingName: { len: 35 }, addressLine: [{ len: 70 }, { len: 70 }, { len: 70 }, { len: 70 }, { len: 70 }, { len: 70 }, { len: 70 }] })],
  customerIdentification: { len: 50 },
  nationalIdentification: { nationalIdentifier: { len: 35 }, nationalIdentifierType: 'CCPT' },
  dateAndPlaceOfBirth: { dateOfBirth: '1980-05-05', placeOfBirth: { len: 70 } },
  accountNumber: [{ len: 512 }, 'SYNTHETIC'],
})), []);

// -- skeleton-leaf contract --
case6('leaf-len-zero', withBen(npPerson({ name: { nameIdentifier: [npEntry('LEGL', { len: 0 })] } })),
  [['payload.beneficiary[0].naturalPerson.name.nameIdentifier[0].primaryIdentifier', 'PII-REFUSAL', 'skeleton-contract']]);
case6('leaf-len-negative', withBen(npPerson({ name: { nameIdentifier: [npEntry('LEGL', { len: -1 })] } })),
  [['payload.beneficiary[0].naturalPerson.name.nameIdentifier[0].primaryIdentifier', 'PII-REFUSAL', 'skeleton-contract']]);
case6('leaf-len-fractional', withBen(npPerson({ name: { nameIdentifier: [npEntry('LEGL', { len: 1.5 })] } })),
  [['payload.beneficiary[0].naturalPerson.name.nameIdentifier[0].primaryIdentifier', 'PII-REFUSAL', 'skeleton-contract']]);
case6('leaf-extra-key', withBen(npPerson({ name: { nameIdentifier: [npEntry('LEGL', { len: 1, extra: 2 })] } })),
  [['payload.beneficiary[0].naturalPerson.name.nameIdentifier[0].primaryIdentifier', 'PII-REFUSAL', 'skeleton-contract']]);
case6('leaf-number', withBen(npPerson({ name: { nameIdentifier: [npEntry('LEGL', 42)] } })),
  [['payload.beneficiary[0].naturalPerson.name.nameIdentifier[0].primaryIdentifier', 'PII-REFUSAL', 'skeleton-contract']]);
case6('leaf-boolean', withBen(npPerson({ name: { nameIdentifier: [npEntry('LEGL', true)] } })),
  [['payload.beneficiary[0].naturalPerson.name.nameIdentifier[0].primaryIdentifier', 'PII-REFUSAL', 'skeleton-contract']]);
case6('leaf-syntheticish', withBen(npPerson({ name: { nameIdentifier: [npEntry('LEGL', 'SYNTHETICX')] } })),
  [['payload.beneficiary[0].naturalPerson.name.nameIdentifier[0].primaryIdentifier', 'PII-REFUSAL', 'skeleton-contract']]);

// -- CARD shapes --
case6('card-nameidentifier-nonarray', withBen(npPerson({ name: { nameIdentifier: 'x' } })),
  [['beneficiary[0].naturalPerson.name.nameIdentifier', 'C6', '5.2.3.2'], ['payload.beneficiary[0].naturalPerson.name.nameIdentifier', 'CARD', '5.2.3.1']]);
case6('card-nameidentifier-empty', withBen(npPerson({ name: { nameIdentifier: [] } })),
  [['beneficiary[0].naturalPerson.name.nameIdentifier', 'C6', '5.2.3.2'], ['payload.beneficiary[0].naturalPerson.name.nameIdentifier', 'CARD', '5.2.3.1']]);
case6('card-addressline-8', withBen(npPerson({ geographicAddress: [addrLine('GEOG', { addressLine: [{ len: 5 }, { len: 5 }, { len: 5 }, { len: 5 }, { len: 5 }, { len: 5 }, { len: 5 }, { len: 5 }] })] })),
  [['payload.beneficiary[0].naturalPerson.geographicAddress[0].addressLine', 'CARD', '5.2.6.1']]);
case6('card-accountnumber-nonarray', withBen(Object.assign(npPerson(), { accountNumber: 'x' })),
  [['payload.beneficiary[0].accountNumber', 'CARD', '5.2.1.1']]);
case6('card-dob-nonobject', withBen(npPerson({ dateAndPlaceOfBirth: 'x' })),
  [['payload.beneficiary[0].naturalPerson.dateAndPlaceOfBirth', 'CARD', '5.2.2.1']]);
case6('card-address-nonarray', withBen(npPerson({ geographicAddress: 'x' })),
  [['payload.beneficiary[0].naturalPerson.geographicAddress', 'CARD', '5.2.2.1']]);
case6('card-natid-nonobject', withBen(npPerson({ nationalIdentification: [] })),
  [['payload.beneficiary[0].naturalPerson.nationalIdentification', 'CARD', '5.2.2.1']]);
case6('card-intermediary-nonobject', ppOf({
  originator: [npPerson({ geographicAddress: [addrLine('HOME')] })],
  beneficiary: [npPerson()],
  transferPath: ['x'],
  payloadMetadata: { payloadVersion: OK_ED },
}), [['payload.transferPath[0]', 'CARD', '6']]);
case6('card-sequence-noninteger', ppOf({
  originator: [npPerson({ geographicAddress: [addrLine('HOME')] })],
  beneficiary: [npPerson()],
  transferPath: [{ intermediaryVASP: npPerson(), sequence: 'x' }],
  payloadMetadata: { payloadVersion: OK_ED },
}), [['transferPath[0].sequence', 'C12', '5.2.13.2'], ['payload.transferPath[0].sequence', 'CARD', '5.3.16']]);

// -- dates (format, calendar bounds, leap year, C2 pinning) --
case6('dob-format-bad', withBen(npPerson({ dateAndPlaceOfBirth: { dateOfBirth: '2026-1-01', placeOfBirth: { len: 5 } } })),
  [['payload.beneficiary[0].naturalPerson.dateAndPlaceOfBirth.dateOfBirth', 'CARD', '5.3.11']]);
case6('dob-month-13', withBen(npPerson({ dateAndPlaceOfBirth: { dateOfBirth: '2026-13-01', placeOfBirth: { len: 5 } } })),
  [['beneficiary[0].naturalPerson.dateAndPlaceOfBirth.dateOfBirth', 'C2', '5.2.7.2'], ['payload.beneficiary[0].naturalPerson.dateAndPlaceOfBirth.dateOfBirth', 'CARD', '5.3.11']]);
case6('dob-feb29-nonleap', withBen(npPerson({ dateAndPlaceOfBirth: { dateOfBirth: '2023-02-29', placeOfBirth: { len: 5 } } })),
  [['payload.beneficiary[0].naturalPerson.dateAndPlaceOfBirth.dateOfBirth', 'CARD', '5.3.11']]);
case6('dob-feb29-leap-clean', withBen(npPerson({ dateAndPlaceOfBirth: { dateOfBirth: '2024-02-29', placeOfBirth: { len: 5 } } })), []);
case6('dob-future-c2', withBen(npPerson({ dateAndPlaceOfBirth: { dateOfBirth: '2026-11-02', placeOfBirth: { len: 5 } } })),
  [['beneficiary[0].naturalPerson.dateAndPlaceOfBirth.dateOfBirth', 'C2', '5.2.7.2'], ['payload.beneficiary[0].naturalPerson.dateAndPlaceOfBirth.dateOfBirth', 'C2', '5.2.7.2']]);
case6('dob-evaldate-c2', withBen(npPerson({ dateAndPlaceOfBirth: { dateOfBirth: '2026-11-01', placeOfBirth: { len: 5 } } })),
  [['beneficiary[0].naturalPerson.dateAndPlaceOfBirth.dateOfBirth', 'C2', '5.2.7.2'], ['payload.beneficiary[0].naturalPerson.dateAndPlaceOfBirth.dateOfBirth', 'C2', '5.2.7.2']]);
case6('dob-past-clean', withBen(npPerson({ dateAndPlaceOfBirth: { dateOfBirth: '2026-10-31', placeOfBirth: { len: 5 } } })), []);

// -- registration authority format --
case6('ra-short', withBen(lpPerson({ nationalIdentification: { nationalIdentifier: { len: 12 }, nationalIdentifierType: 'TXID', registrationAuthority: 'RA12345' } })),
  [['payload.beneficiary[0].legalPerson.nationalIdentification.registrationAuthority', 'CODE', '5.3.14']]);
case6('ra-prefix-bad', withBen(lpPerson({ nationalIdentification: { nationalIdentifier: { len: 12 }, nationalIdentifierType: 'TXID', registrationAuthority: 'XA000001' } })),
  [['payload.beneficiary[0].legalPerson.nationalIdentification.registrationAuthority', 'CODE', '5.3.14']]);
case6('ra-clean', withBen(lpPerson({ nationalIdentification: { nationalIdentifier: { len: 12 }, nationalIdentifierType: 'TXID', registrationAuthority: 'RA000001' } })), []);
case6('ra-synthetic', withBen(lpPerson({ nationalIdentification: { nationalIdentifier: 'SYNTHETIC', nationalIdentifierType: 'TXID', registrationAuthority: 'SYNTHETIC' } })), []);

// -- PERSON-EXCL --
case6('person-both-branches', withBen({ naturalPerson: npPerson().naturalPerson, legalPerson: lpPerson().legalPerson }),
  [['beneficiary[0]', 'PERSON-EXCL', '5.2.1.1']]);
case6('person-neither-branch', withBen({}),
  [['beneficiary[0]', 'PERSON-EXCL', '5.2.1.1']]);
case6('person-null-branch', withBen({ naturalPerson: null }),
  [['beneficiary[0]', 'PERSON-EXCL', '5.2.1.1']]);

// -- C1 originator natural person --
case6('c1-name-only', ppOf({ originator: [npPerson()], beneficiary: [npPerson()], payloadMetadata: { payloadVersion: OK_ED } }),
  [['originator[0].naturalPerson', 'C1', '5.2.1.2']]);
case6('c1-home-address', ppOf({ originator: [npPerson({ geographicAddress: [addrLine('HOME')] })], beneficiary: [npPerson()], payloadMetadata: { payloadVersion: OK_ED } }), []);
case6('c1-bizz-address', ppOf({ originator: [npPerson({ geographicAddress: [addrLine('BIZZ')] })], beneficiary: [npPerson()], payloadMetadata: { payloadVersion: OK_ED } }), []);
case6('c1-geog-address', ppOf({ originator: [npPerson({ geographicAddress: [addrLine('GEOG', { streetName: undefined, addressLine: [{ len: 5 }] })] })], beneficiary: [npPerson()], payloadMetadata: { payloadVersion: OK_ED } }), []);
case6('c1-custid', ppOf({ originator: [npPerson({ customerIdentification: { len: 5 } })], beneficiary: [npPerson()], payloadMetadata: { payloadVersion: OK_ED } }), []);
case6('c1-natid', ppOf({ originator: [npPerson({ nationalIdentification: { nationalIdentifier: { len: 20 }, nationalIdentifierType: 'CCPT' } })], beneficiary: [npPerson()], payloadMetadata: { payloadVersion: OK_ED } }), []);
case6('c1-dob', ppOf({ originator: [npPerson({ dateAndPlaceOfBirth: { dateOfBirth: '1980-01-01', placeOfBirth: { len: 5 } } })], beneficiary: [npPerson()], payloadMetadata: { payloadVersion: OK_ED } }), []);

// -- C4 originator legal person (GEOG-only) --
case6('c4-name-only', ppOf({ originator: [lpPerson()], beneficiary: [npPerson()], payloadMetadata: { payloadVersion: OK_ED } }),
  [['originator[0].legalPerson', 'C4', '5.2.1.2']]);
case6('c4-bizz-not-enough', ppOf({ originator: [lpPerson({ geographicAddress: [addrLine('BIZZ')] })], beneficiary: [npPerson()], payloadMetadata: { payloadVersion: OK_ED } }),
  [['originator[0].legalPerson', 'C4', '5.2.1.2']]);
case6('c4-geog', ppOf({ originator: [lpPerson({ geographicAddress: [addrLine('GEOG')] })], beneficiary: [npPerson()], payloadMetadata: { payloadVersion: OK_ED } }), []);
case6('c4-custid', ppOf({ originator: [lpPerson({ customerIdentification: { len: 5 } })], beneficiary: [npPerson()], payloadMetadata: { payloadVersion: OK_ED } }), []);

// -- C5 / C6 legal name present --
case6('c6-np-no-legl', withBen(npPerson({ name: { nameIdentifier: [npEntry('BIRT')] } })),
  [['beneficiary[0].naturalPerson.name.nameIdentifier', 'C6', '5.2.3.2']]);
case6('c5-lp-no-legl', withBen(lpPerson({ name: { nameIdentifier: [lpEntry('SHRT')] } })),
  [['beneficiary[0].legalPerson.name.nameIdentifier', 'C5', '5.2.10.2']]);

// -- C7 legal-person national identifier type domain --
case6('c7-ccpt', withBen(lpPerson({ nationalIdentification: { nationalIdentifier: { len: 12 }, nationalIdentifierType: 'CCPT' } })),
  [['beneficiary[0].legalPerson.nationalIdentification.nationalIdentifierType', 'C7', '5.2.8.2'], ['beneficiary[0].legalPerson.nationalIdentification.registrationAuthority', 'C9', '5.2.8.2']]);
case6('c7-raid-clean', withBen(lpPerson({ nationalIdentification: { nationalIdentifier: { len: 12 }, nationalIdentifierType: 'RAID', registrationAuthority: 'RA000001' } })), []);
case6('c7-misc-clean', withBen(lpPerson({ nationalIdentification: { nationalIdentifier: { len: 12 }, nationalIdentifierType: 'MISC', registrationAuthority: 'RA000001' } })), []);
case6('c7-leix-clean', withBen(lpPerson({ nationalIdentification: { nationalIdentifier: { len: 20 }, nationalIdentifierType: 'LEIX' } })), []);
case6('c7-txid-clean', withBen(lpPerson({ nationalIdentification: { nationalIdentifier: { len: 12 }, nationalIdentifierType: 'TXID', registrationAuthority: 'RA000001' } })), []);

// -- C9 RA / country-of-issue coherence --
case6('c9-leix-countryofissue', withBen(lpPerson({ nationalIdentification: { nationalIdentifier: { len: 20 }, nationalIdentifierType: 'LEIX', countryOfIssue: 'DE' } })),
  [['beneficiary[0].legalPerson.nationalIdentification.countryOfIssue', 'C9', '5.2.8.2']]);
case6('c9-leix-ra-present', withBen(lpPerson({ nationalIdentification: { nationalIdentifier: { len: 20 }, nationalIdentifierType: 'LEIX', registrationAuthority: 'RA000001' } })),
  [['beneficiary[0].legalPerson.nationalIdentification.registrationAuthority', 'C9', '5.2.8.2']]);
case6('c9-txid-ra-missing', withBen(lpPerson({ nationalIdentification: { nationalIdentifier: { len: 12 }, nationalIdentifierType: 'TXID' } })),
  [['beneficiary[0].legalPerson.nationalIdentification.registrationAuthority', 'C9', '5.2.8.2']]);
case6('c9-raid-ra-missing', withBen(lpPerson({ nationalIdentification: { nationalIdentifier: { len: 12 }, nationalIdentifierType: 'RAID' } })),
  [['beneficiary[0].legalPerson.nationalIdentification.registrationAuthority', 'C9', '5.2.8.2']]);

// -- C11 LEI length on len markers --
case6('c11-lei-len-19', withBen(lpPerson({ nationalIdentification: { nationalIdentifier: { len: 19 }, nationalIdentifierType: 'LEIX' } })),
  [['beneficiary[0].legalPerson.nationalIdentification.nationalIdentifier', 'C11', '5.2.8.2']]);
case6('c11-lei-len-20-clean', withBen(lpPerson({ nationalIdentification: { nationalIdentifier: { len: 20 }, nationalIdentifierType: 'LEIX' } })), []);
case6('c11-lei-synthetic-not-evaluated', withBen(lpPerson({ nationalIdentification: { nationalIdentifier: 'SYNTHETIC', nationalIdentifierType: 'LEIX' } })), []);

// -- C12 transfer path sequence --
case6('c12-sequence-skip', ppOf({
  originator: [npPerson({ geographicAddress: [addrLine('HOME')] })],
  beneficiary: [npPerson()],
  transferPath: [
    { intermediaryVASP: lpPerson(), sequence: 0 },
    { intermediaryVASP: lpPerson(), sequence: 2 },
  ],
  payloadMetadata: { payloadVersion: OK_ED },
}), [['transferPath[1].sequence', 'C12', '5.2.13.2']]);
case6('c12-sequence-clean', ppOf({
  originator: [npPerson({ geographicAddress: [addrLine('HOME')] })],
  beneficiary: [npPerson()],
  transferPath: [
    { intermediaryVASP: lpPerson(), sequence: 0 },
    { intermediaryVASP: lpPerson(), sequence: 1 },
  ],
  payloadMetadata: { payloadVersion: OK_ED },
}), []);

// -- C8 valid address --
case6('c8-no-line-no-street', withBen(npPerson({ geographicAddress: [{ addressType: 'GEOG', townName: { len: 6 }, country: 'DE' }] })),
  [['beneficiary[0].naturalPerson.geographicAddress[0]', 'C8', '5.2.6.2']]);
case6('c8-addressline-enough', withBen(npPerson({ geographicAddress: [{ addressType: 'GEOG', addressLine: [{ len: 5 }], townName: { len: 6 }, country: 'DE' }] })), []);
case6('c8-buildingnumber-enough', withBen(npPerson({ geographicAddress: [{ addressType: 'GEOG', buildingNumber: { len: 3 }, townName: { len: 6 }, country: 'DE' }] })), []);
case6('c8-buildingname-enough', withBen(npPerson({ geographicAddress: [{ addressType: 'GEOG', buildingName: { len: 3 }, townName: { len: 6 }, country: 'DE' }] })), []);
case6('c8-streetname-enough', withBen(npPerson({ geographicAddress: [addrLine('GEOG')] })), []);

// -- REQUIRED deep in the tree --
case6('req-name-empty', withBen(npPerson({ name: {} })),
  [['beneficiary[0].naturalPerson.name.nameIdentifier', 'C6', '5.2.3.2'], ['payload.beneficiary[0].naturalPerson.name.nameIdentifier', 'REQUIRED', '5.2.3.1']]);
case6('req-nameidentifier-entry-empty', withBen(npPerson({ name: { nameIdentifier: [{}] } })),
  [['beneficiary[0].naturalPerson.name.nameIdentifier', 'C6', '5.2.3.2'],
   ['payload.beneficiary[0].naturalPerson.name.nameIdentifier[0].naturalPersonNameIdentifierType', 'REQUIRED', '5.2.4.1'],
   ['payload.beneficiary[0].naturalPerson.name.nameIdentifier[0].primaryIdentifier', 'REQUIRED', '5.2.4.1']]);
case6('req-address-fields', withBen(npPerson({ geographicAddress: [{ streetName: { len: 3 } }] })),
  [['payload.beneficiary[0].naturalPerson.geographicAddress[0].addressType', 'REQUIRED', '5.2.6.1'],
   ['payload.beneficiary[0].naturalPerson.geographicAddress[0].country', 'REQUIRED', '5.2.6.1'],
   ['payload.beneficiary[0].naturalPerson.geographicAddress[0].townName', 'REQUIRED', '5.2.6.1']]);
case6('req-natid-fields', withBen(npPerson({ nationalIdentification: {} })),
  [['payload.beneficiary[0].naturalPerson.nationalIdentification.nationalIdentifier', 'REQUIRED', '5.2.8.1'],
   ['payload.beneficiary[0].naturalPerson.nationalIdentification.nationalIdentifierType', 'REQUIRED', '5.2.8.1']]);
case6('req-dob-fields', withBen(npPerson({ dateAndPlaceOfBirth: {} })),
  [['payload.beneficiary[0].naturalPerson.dateAndPlaceOfBirth.dateOfBirth', 'REQUIRED', '5.2.7.1'],
   ['payload.beneficiary[0].naturalPerson.dateAndPlaceOfBirth.placeOfBirth', 'REQUIRED', '5.2.7.1']]);

function checkP6_exactViolationsTable() {
  let checked = 0, violations = 0;
  for (const c of P6_CASES) {
    const got = compute(c.pp).output_payload.violations;
    checked++;
    if (JSON.stringify(got) !== JSON.stringify(c.expect)) {
      violations++;
      if (violations <= 40) {
        console.error(`  P6 FAIL ${c.name}\n    expected ${JSON.stringify(c.expect)}\n    got      ${JSON.stringify(got)}`);
      }
    }
  }
  return { name: 'P6_exact_violations_table', checked, violations };
}

// ---------- P7: full output_payload pins ----------
const RULES19 = ['EDITION', 'PII-REFUSAL', 'REQUIRED', 'CARD', 'MAXLEN', 'CODE', 'PERSON-EXCL', 'C1', 'C2', 'C3', 'C4', 'C5', 'C6', 'C7', 'C8', 'C9', 'C10', 'C11', 'C12'];
function pin(name, pp, expect) { return { name, pp, expect }; }
const P7_CASES = [
  pin('clean-full-payload', ppOf({
    originator: [npPerson({ geographicAddress: [addrLine('HOME')] })],
    beneficiary: [npPerson()],
    payloadMetadata: { payloadVersion: OK_ED },
  }), { valid: true, edition: OK_ED, edition_declared: OK_ED, rules_checked: RULES19, violation_count: 0, violations: [], errors: [] }),
  pin('pii-full-payload', ppOf({
    originator: [npPerson({ geographicAddress: [addrLine('HOME')] })],
    beneficiary: [npPerson({ name: { nameIdentifier: [npEntry('LEGL', 'Jane Doe')] } })],
    payloadMetadata: { payloadVersion: OK_ED },
  }), {
    valid: false, edition: OK_ED, edition_declared: OK_ED, rules_checked: RULES19, violation_count: 1,
    violations: [{ path: 'payload.beneficiary[0].naturalPerson.name.nameIdentifier[0].primaryIdentifier', rule_id: 'PII-REFUSAL', section: 'skeleton-contract' }],
    errors: ['PII-REFUSAL@payload.beneficiary[0].naturalPerson.name.nameIdentifier[0].primaryIdentifier'],
  }),
  pin('edition-full-payload', ppOf({
    originator: [npPerson({ geographicAddress: [addrLine('HOME')] })],
    beneficiary: [npPerson()],
    payloadMetadata: { payloadVersion: OK_ED },
  }, '101.2024'), {
    valid: false, edition: OK_ED, edition_declared: '101.2024', rules_checked: RULES19, violation_count: 1,
    violations: [{ path: 'ivms101_edition', rule_id: 'EDITION', section: '5.3.18' }],
    errors: ['EDITION@ivms101_edition'],
  }),
  pin('edition-missing-full-payload', ppOf({
    originator: [npPerson({ geographicAddress: [addrLine('HOME')] })],
    beneficiary: [npPerson()],
    payloadMetadata: { payloadVersion: OK_ED },
  }, ''), {
    valid: false, edition: OK_ED, edition_declared: null, rules_checked: RULES19, violation_count: 1,
    violations: [{ path: 'ivms101_edition', rule_id: 'EDITION', section: '5.3.18' }],
    errors: ['EDITION@ivms101_edition'],
  }),
];
function checkP7_fullPayloadPins() {
  let checked = 0, violations = 0;
  for (const c of P7_CASES) {
    const got = compute(c.pp).output_payload;
    checked++;
    if (JSON.stringify(got) !== JSON.stringify(c.expect)) {
      violations++;
      if (violations <= 5) console.error(`  P7 FAIL ${c.name}\n    expected ${JSON.stringify(c.expect)}\n    got      ${JSON.stringify(got)}`);
    }
  }
  return { name: 'P7_full_payload_pins', checked, violations };
}

// ---------- P8: compliance_flags pins ----------
function checkP8_flagPins() {
  const junkName = npPerson({ name: { nameIdentifier: [npEntry('LEGL', 'Jane Doe')] } });
  const cases = [
    { name: 'flags-clean', pp: ppOf({ originator: [npPerson({ geographicAddress: [addrLine('HOME')] })], beneficiary: [npPerson()], payloadMetadata: { payloadVersion: OK_ED } }), expect: ['IVMS101_SKELETON_VALID'] },
    { name: 'flags-pii', pp: ppOf({ originator: [npPerson({ geographicAddress: [addrLine('HOME')] })], beneficiary: [junkName], payloadMetadata: { payloadVersion: OK_ED } }), expect: ['IVMS101_SKELETON_INVALID', 'IVMS101_PII_REFUSED'] },
    { name: 'flags-edition', pp: ppOf({ originator: [npPerson({ geographicAddress: [addrLine('HOME')] })], beneficiary: [junkName], payloadMetadata: { payloadVersion: OK_ED } }, '2023'), expect: ['IVMS101_SKELETON_INVALID', 'IVMS101_EDITION_REJECTED'] },
  ];
  let checked = 0, violations = 0;
  for (const c of cases) {
    const got = compute(c.pp).compliance_flags;
    checked++;
    if (JSON.stringify(got) !== JSON.stringify(c.expect)) {
      violations++;
      if (violations <= 5) console.error(`  P8 FAIL ${c.name}\n    expected ${JSON.stringify(c.expect)}\n    got      ${JSON.stringify(got)}`);
    }
  }
  return { name: 'P8_compliance_flags_pins', checked, violations };
}

// ---------- P9: flag-mirror correlation on randomized inputs ----------
function checkP9_mirrorCorrelation() {
  let checked = 0, violations = 0;
  const rng = mulberry32(804004);
  for (let i = 0; i < 150; i++) {
    const pp = basePayload(rng);
    if (rng() < 0.5) {
      const path = pickLivePath(rng, pp);
      if (pathExists(pp, path)) setAtPath(pp, path, junkString(rng, 1 + Math.floor(rng() * 60)));
    }
    if (rng() < 0.3 && Array.isArray(pp.payload.beneficiary) && pp.payload.beneficiary[0]) {
      pp.payload.beneficiary[0].corrupt = 'ZZ';
    }
    if (rng() < 0.2) pp.ivms101_edition = '2023';
    const { output_payload: op, compliance_flags: flags } = compute(pp);
    checked++;
    let bad = false;
    if (!Object.prototype.hasOwnProperty.call(op, 'errors')) bad = true;
    if (!Array.isArray(op.errors) || op.errors.length !== op.violations.length) bad = true;
    for (let k = 0; k < op.violations.length && !bad; k++) {
      if (op.errors[k] !== op.violations[k].rule_id + '@' + op.violations[k].path) bad = true;
    }
    if ((op.errors.length > 0) !== (op.violation_count > 0)) bad = true;
    if ((op.errors.length > 0) !== (op.valid === false)) bad = true;
    if (flags[0] !== (op.valid ? 'IVMS101_SKELETON_VALID' : 'IVMS101_SKELETON_INVALID')) bad = true;
    if (flags.includes('IVMS101_PII_REFUSED') !== op.violations.some((v) => v.rule_id === 'PII-REFUSAL')) bad = true;
    if (flags.includes('IVMS101_EDITION_REJECTED') !== op.violations.some((v) => v.rule_id === 'EDITION')) bad = true;
    if (bad) violations++;
  }
  return { name: 'P9_flag_mirror_correlation', checked, violations };
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
  checkP6_exactViolationsTable(),
  checkP7_fullPayloadPins(),
  checkP8_flagPins(),
  checkP9_mirrorCorrelation(),
];
console.log(`[${KERNEL_ID}] class-K floor property test — zero-PII skeleton contract.`);
const ok = summarize(KERNEL_ID, oracle, properties);
process.exit(ok ? 0 : 1);
