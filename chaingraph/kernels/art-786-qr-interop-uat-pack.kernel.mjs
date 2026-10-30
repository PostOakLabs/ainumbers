import { executionHash } from './_hash.mjs';

// art-786-qr-interop-uat-pack — QR payment scheme participant user-acceptance test pack
// generator. Built from a declared participant list (pseudonymous codes only) and a scheme
// profile. Emits an interoperability matrix (ordered presenter/payer pairs that can
// transact), positive and negative cases drawn from field rules of the pinned primary
// texts (EMVCo MPM v1.1, RBF FJQR guidelines May 2026, BCB BR Code manual v2.0.0 —
// behaviour only here; citations live in the node shard metadata per KERNEL-CITATION-CLASS-1),
// reversal/refund/dispute cases and payee-name outcome cases when toggled on, phased
// domestic first then cross-border when link profiles are declared.
// Negative cases are described as mutations only — the kernel never emits a live QR
// payload string carrying merchant or payee data (CONTRACT zero-PII).
// DETERMINISM: compute() is a pure function of pp — no Date.now()/Math.random(), no
// network, no filesystem, no TextEncoder (all case ids derive from a pure FNV-1a content
// hash, so identical inputs always produce an identical pack).

const TOOL_ID = 'art-786-qr-interop-uat-pack';
const TOOL_VERSION = '1.0.0';

export const meta = {
  tool_id: TOOL_ID, tool_version: TOOL_VERSION,
  mcp_name: 'build_qr_interop_uat_pack',
  mandate_type: 'compliance_control', gpu: false,
};

// Scheme profiles as data — matching the payload validator's profile ids. currency is the
// ISO 4217 numeric code the profile pins for tag 53 (null = not pinned). static_amount_allowed
// records whether a STATIC payload may carry tag 54 under the profile.
const PROFILES = {
  generic:    { currency: null, static_amount_allowed: true },
  fjqr:       { currency: '242', static_amount_allowed: true },
  pix_brcode: { currency: '986', static_amount_allowed: false },
};

const ROLES = ['issuer', 'acquirer', 'wallet', 'aggregator'];
// A payer side needs an account it can debit from; a presenter (merchant/payee) side needs
// an acquiring capability. An aggregator alone can hold neither seat.
const PAYER_ROLES = ['issuer', 'wallet'];
const PRESENTER_ROLES = ['acquirer', 'wallet'];

// Negative-case rule set. rule_ref values are this node's own ids (the payload validator
// node had not landed on main at authoring time; a later alignment PR may re-point these
// to that node's rule_id values). source names the pinned primary text and its section —
// facts and field semantics only, no specification text reproduced.
const NEGATIVE_RULES = [
  { mutation: 'bad_crc',                  rule_ref: 'QRUAT-CRC-01', expected_verdict: 'reject', source: 'EMVCo MPM v1.1 s4.4: CRC-16/CCITT-FALSE over the full payload' },
  { mutation: 'bad_crc_excluding_6304',   rule_ref: 'QRUAT-CRC-02', expected_verdict: 'reject', source: 'EMVCo MPM v1.1 s4.4: CRC input includes the literal 6304 tag-and-length; generators that omit it produce a wrong checksum' },
  { mutation: 'missing_merchant_account_template', rule_ref: 'QRUAT-TLV-01', expected_verdict: 'reject', source: 'EMVCo MPM v1.1 s4.1: at least one merchant account information template in tags 26-51 is mandatory for MPM' },
  { mutation: 'malformed_tag_62',         rule_ref: 'QRUAT-TLV-02', expected_verdict: 'reject', source: 'EMVCo MPM v1.1 s4.3: additional data template tag 62 carries well-formed TLV subfields' },
  { mutation: 'wrong_currency',           rule_ref: 'QRUAT-CCY-01', expected_verdict: 'reject', source: 'EMVCo MPM v1.1 s3.1 tag 53 + profile-pinned ISO 4217 numeric code (RBF FJQR guidelines May 2026 participation rules; BCB BR Code manual v2.0.0 Table 1)' },
  { mutation: 'static_payload_with_amount', rule_ref: 'QRUAT-AMT-01', expected_verdict: 'reject', source: 'BCB BR Code manual v2.0.0 Table 1: the static BR Code does not carry transaction amount; amount belongs to the dynamic payload' },
];

const PAYEE_NAME_OUTCOMES = ['match', 'close_match', 'no_match', 'not_possible'];

// FNV-1a 32-bit over UTF-16 code units — pure, stable, no built-ins needed (all hashed
// inputs are ASCII identifiers: codes, profile ids, kind and mutation names).
function fnv1a(str) {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = (h * 0x01000193) >>> 0;
  }
  return ('00000000' + h.toString(16)).slice(-8);
}

function refusal(code, detail) {
  return {
    output_payload: {
      error: code.toLowerCase(),
      detail,
      domain_errors: [{ code, text: detail }],
      scheme_profile: null, phases: [], matrix: [], cases: [],
      counts: {}, excluded_pairs: [], exit_criteria: {},
    },
    compliance_flags: code ? ['INPUT_REFUSED'] : [],
  };
}

function hasRole(participant, roles) {
  return (participant.roles || []).some(function (r) { return roles.indexOf(r) !== -1; });
}

function pairKey(presenter, payer) { return presenter + '->' + payer; }

/**
 * compute(pp) — pure test-pack generator.
 * pp: {
 *   scheme_profile: 'generic' | 'fjqr' | 'pix_brcode',
 *   participants: [ { code: string (pseudonymous), roles: [ 'issuer'|'acquirer'|'wallet'|'aggregator' ] } ],
 *   phases: optional ['domestic'] | ['domestic','cross_border'] (default: domestic, plus
 *           cross_border when link_profiles is given),
 *   link_profiles: optional [ 'generic'|'fjqr'|'pix_brcode' ] — foreign schemes for the
 *           cross-border phase,
 *   include: optional { reversal: bool, refund: bool, dispute: bool, payee_name_outcome: bool }
 * }
 * @param {object} pp policy_parameters
 * @returns {{ output_payload: object, compliance_flags: string[] }}
 */
export function compute(pp) {
  pp = pp || {};

  const profile = PROFILES[pp.scheme_profile];
  if (!profile) {
    return refusal('PROFILE_UNKNOWN', 'scheme_profile must be one of generic, fjqr, pix_brcode; got ' + JSON.stringify(pp.scheme_profile === undefined ? null : pp.scheme_profile) + '.');
  }
  if (!Array.isArray(pp.participants) || pp.participants.length < 2) {
    return refusal('PARTICIPANTS_INSUFFICIENT', 'participants must be an array of at least two participants; a UAT interoperability matrix over zero or one participant is undefined. Got length ' + JSON.stringify(Array.isArray(pp.participants) ? pp.participants.length : null) + '.');
  }
  const seen = {};
  for (let i = 0; i < pp.participants.length; i++) {
    const p = pp.participants[i];
    if (!p || typeof p !== 'object' || typeof p.code !== 'string' || !p.code) {
      return refusal('PARTICIPANT_MALFORMED', 'participants[' + i + '] must carry a non-empty pseudonymous code string.');
    }
    if (seen[p.code]) {
      return refusal('PARTICIPANT_DUPLICATE', 'participants[' + i + '] repeats code ' + JSON.stringify(p.code) + '; participant codes must be unique.');
    }
    seen[p.code] = true;
    if (!Array.isArray(p.roles) || p.roles.length === 0) {
      return refusal('PARTICIPANT_ROLES_MISSING', 'participants[' + i + '] (' + p.code + ') must declare at least one role from issuer, acquirer, wallet, aggregator.');
    }
    for (let j = 0; j < p.roles.length; j++) {
      if (ROLES.indexOf(p.roles[j]) === -1) {
        return refusal('ROLE_UNKNOWN', 'participants[' + i + '] (' + p.code + ') declares unknown role ' + JSON.stringify(p.roles[j]) + '; roles must be from issuer, acquirer, wallet, aggregator.');
      }
    }
  }
  if (pp.link_profiles !== undefined && pp.link_profiles !== null) {
    if (!Array.isArray(pp.link_profiles) || pp.link_profiles.length === 0) {
      return refusal('LINK_PROFILES_MALFORMED', 'link_profiles, when given, must be a non-empty array of foreign scheme profile ids.');
    }
    for (let i = 0; i < pp.link_profiles.length; i++) {
      if (!PROFILES[pp.link_profiles[i]]) {
        return refusal('PROFILE_UNKNOWN', 'link_profiles[' + i + '] is not a known scheme profile; known: generic, fjqr, pix_brcode.');
      }
    }
  }

  const include = pp.include || {};
  const crossBorder = !!(pp.link_profiles && pp.link_profiles.length > 0);
  const phases = ['domestic'];
  if (crossBorder) phases.push('cross_border');
  if (Array.isArray(pp.phases)) {
    for (const ph of pp.phases) {
      if (phases.indexOf(ph) === -1) {
        return refusal('PHASE_UNKNOWN', 'phases may name only domestic and cross_border; cross_border requires link_profiles. Got ' + JSON.stringify(ph) + '.');
      }
    }
  }

  const cases = [];
  const matrix = [];
  const excluded_pairs = [];

  // Self-pairs are excluded and counted before the ordered pair loop.
  for (const p of pp.participants) {
    excluded_pairs.push({ pair: pairKey(p.code, p.code), reason: 'self_pair', phase: 'domestic' });
  }

  // Domestic ordered pairs: every (presenter, payer) with presenter !== payer — at most
  // N x (N-1), with impossible role pairs excluded and counted.
  for (const presenter of pp.participants) {
    for (const payer of pp.participants) {
      if (presenter.code === payer.code) continue;
      if (!hasRole(payer, PAYER_ROLES) || !hasRole(presenter, PRESENTER_ROLES)) {
        excluded_pairs.push({ pair: pairKey(presenter.code, payer.code), reason: 'role_pair_cannot_transact', phase: 'domestic' });
        continue;
      }
      const pair = pairKey(presenter.code, payer.code);
      const case_ids = [];
      case_ids.push(addCase(cases, 'domestic', pair, 'positive_static', { expected_verdict: 'pass', rule_ref: 'QRUAT-POS-01', detail: 'static payload, no amount, full field set for the profile' }));
      case_ids.push(addCase(cases, 'domestic', pair, 'positive_dynamic', { expected_verdict: 'pass', rule_ref: 'QRUAT-POS-02', detail: 'dynamic payload with amount, unique reference' }));
      for (const neg of NEGATIVE_RULES) {
        if (neg.mutation === 'wrong_currency' && !profile.currency) continue;
        if (neg.mutation === 'static_payload_with_amount' && profile.static_amount_allowed) continue;
        case_ids.push(addCase(cases, 'domestic', pair, 'negative', { expected_verdict: neg.expected_verdict, rule_ref: neg.rule_ref, detail: neg.mutation, source: neg.source }));
      }
      if (include.reversal) case_ids.push(addCase(cases, 'domestic', pair, 'reversal', { expected_verdict: 'pass', rule_ref: 'QRUAT-REV-01', detail: 'full reversal of a completed domestic payment' }));
      if (include.refund) case_ids.push(addCase(cases, 'domestic', pair, 'refund', { expected_verdict: 'pass', rule_ref: 'QRUAT-RFD-01', detail: 'partial refund against a completed domestic payment' }));
      if (include.dispute) case_ids.push(addCase(cases, 'domestic', pair, 'dispute', { expected_verdict: 'pass', rule_ref: 'QRUAT-DSP-01', detail: 'dispute lifecycle open, evidence, resolution on a completed domestic payment' }));
      if (include.payee_name_outcome) {
        for (const outcome of PAYEE_NAME_OUTCOMES) {
          case_ids.push(addCase(cases, 'domestic', pair, 'payee_name_outcome', { expected_verdict: 'pass', rule_ref: 'QRUAT-VOP-01', detail: 'payee-name check outcome: ' + outcome }));
        }
      }
      matrix.push({ phase: 'domestic', pair, presenter: presenter.code, payer: payer.code, case_ids });
    }
  }

  // Cross-border phase: each domestic presenter with acquiring capability against each
  // foreign link profile, following the ASEAN order (bilateral pilot, then commercial).
  if (crossBorder) {
    for (const link of pp.link_profiles) {
      const linkProfile = PROFILES[link];
      for (const presenter of pp.participants) {
        if (!hasRole(presenter, PRESENTER_ROLES)) continue;
        const pair = pairKey(presenter.code, link);
        const case_ids = [];
        case_ids.push(addCase(cases, 'cross_border', pair, 'positive_dynamic', { expected_verdict: 'pass', rule_ref: 'QRUAT-POS-03', detail: 'cross-border dynamic payment from foreign scheme ' + link + ' acquired domestically' }));
        case_ids.push(addCase(cases, 'cross_border', pair, 'negative', { expected_verdict: 'reject', rule_ref: 'QRUAT-CRC-01', detail: 'bad_crc on a cross-border payload', source: NEGATIVE_RULES[0].source }));
        if (linkProfile.currency) {
          case_ids.push(addCase(cases, 'cross_border', pair, 'negative', { expected_verdict: 'reject', rule_ref: 'QRUAT-CCY-02', detail: 'foreign currency not convertible under the link agreement', source: 'cross-border linkage phase: currency handling per the linked scheme profile' }));
        }
        matrix.push({ phase: 'cross_border', pair, presenter: presenter.code, payer: link, case_ids });
      }
    }
  }

  cases.sort(function (a, b) { return a.case_id < b.case_id ? -1 : a.case_id > b.case_id ? 1 : 0; });
  matrix.sort(function (a, b) { return a.phase < b.phase ? -1 : a.phase > b.phase ? 1 : a.pair < b.pair ? -1 : a.pair > b.pair ? 1 : 0; });
  excluded_pairs.sort(function (a, b) { return a.pair < b.pair ? -1 : a.pair > b.pair ? 1 : 0; });

  const counts = {};
  for (const ph of phases) {
    const byKind = {};
    let total = 0;
    for (const c of cases) {
      if (c.phase !== ph) continue;
      total++;
      byKind[c.kind] = (byKind[c.kind] || 0) + 1;
    }
    counts[ph] = { total, by_kind: byKind };
  }

  const exit_criteria = {};
  for (const ph of phases) {
    exit_criteria[ph] = {
      all_mandatory_cases_passed: true,
      no_open_severity_1_defect: true,
      description: ph === 'domestic'
        ? 'Domestic interoperability exit: every mandatory domestic case passes and no severity-1 defect remains open before any cross-border linkage phase begins.'
        : 'Cross-border exit: every mandatory cross-border case passes and no severity-1 defect remains open before commercial expansion.',
    };
  }

  return {
    output_payload: {
      scheme_profile: pp.scheme_profile,
      profile_currency: profile.currency,
      phases,
      matrix,
      cases,
      counts,
      excluded_pairs,
      excluded_pair_count: excluded_pairs.length,
      exit_criteria,
      case_id_scheme: 'UAT- + FNV-1a-32 of (phase|pair|kind|detail); stable and content-derived',
      participant_note: 'Participant codes are pseudonymous; no real participant, merchant or account data is accepted or emitted. Negative cases are described as mutations, never emitted as live QR strings.',
    },
    compliance_flags: [],
  };
}

function addCase(cases, phase, pair, kind, spec) {
  const case_id = 'UAT-' + fnv1a(phase + '|' + pair + '|' + kind + '|' + (spec.detail || ''));
  cases.push({
    case_id, phase, pair, kind,
    expected_verdict: spec.expected_verdict,
    rule_ref: spec.rule_ref,
    detail: spec.detail === undefined ? null : spec.detail,
    source: spec.source === undefined ? null : spec.source,
  });
  return case_id;
}

export async function buildArtifact(pp, { now = null, parent_hashes = [], parent_tool_ids = [], chain_depth = 0 } = {}) {
  const { output_payload, compliance_flags } = compute(pp);
  const hash = await executionHash(pp, output_payload);
  return {
    '@context': 'https://ainumbers.co/chaingraph/context/v0.3/context.jsonld',
    chaingraph_version: '0.4.0',
    mandate_type: meta.mandate_type,
    tool_id: TOOL_ID,
    tool_version: TOOL_VERSION,
    generated_at: now ?? null,
    execution_hash: hash,
    chain: { parent_hashes, parent_tool_ids, chain_depth },
    policy_parameters: pp,
    output_payload,
    compliance_flags,
    compute_mode: 'server',
    compute_proof_ready: 'deferred',
    audit_signature: { payloadType: 'application/vnd.openchain.graph+json;version=0.4', payload: '', signatures: [] },
  };
}
