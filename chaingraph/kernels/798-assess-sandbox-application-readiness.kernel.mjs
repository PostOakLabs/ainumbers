import { executionHash } from './_hash.mjs';

// 798-assess-sandbox-application-readiness — regulatory sandbox application readiness.
//
// Assesses a firm's sandbox application against a declared regulator profile's
// eligibility criteria and test-parameter limits: verdict (READY /
// READY_WITH_GAPS / NOT_ELIGIBLE), sorted gaps, parameter breaches, missing
// safeguards, and per-profile source cites. Profiles are DATA embedded below —
// every criterion id, mandatory flag and numeric cap carries its own source
// cite; a cap the pinned source does not fix is null and is never invented.
//
// Primary texts (pinned 2026-10-31, sha256 in research/SANDBOX-READINESS-PIN-2026-10-30.md):
//   cbob    — Central Bank of The Bahamas, "Guidance Note for Participation in
//             the Regulatory Sandbox Framework", issued 8 October 2026.
//   generic — jurisdiction-neutral rubric using the same six criteria; the
//             only numeric value it fixes is this tool's own disclosed default
//             customer cap (250), never attributed to any regulator.
// The BMA (Bermuda) profile is NOT shipped: at claim time the BMA had no
// published sandbox framework text for payment applicants and its AI Payments
// Hub was still consultation-stage (recorded in the pin note).
//
// DETERMINISM: compute() is a PURE function of pp — no clock, no randomness,
// no I/O. Guest-builtin-safe (no TextEncoder/URL/atob).
function utf8ToBytes(str) {
  const bytes = [];
  for (let i = 0; i < str.length; i++) {
    let code = str.charCodeAt(i);
    if (code >= 0xd800 && code <= 0xdbff) {
      const next = i + 1 < str.length ? str.charCodeAt(i + 1) : 0;
      if (next >= 0xdc00 && next <= 0xdfff) {
        code = (code - 0xd800) * 0x400 + (next - 0xdc00) + 0x10000;
        i++;
      } else {
        code = 0xfffd;
      }
    } else if (code >= 0xdc00 && code <= 0xdfff) {
      code = 0xfffd;
    }
    if (code < 0x80) bytes.push(code);
    else if (code < 0x800) bytes.push(0xc0 | (code >> 6), 0x80 | (code & 0x3f));
    else if (code < 0x10000) bytes.push(0xe0 | (code >> 12), 0x80 | ((code >> 6) & 0x3f), 0x80 | (code & 0x3f));
    else bytes.push(0xf0 | (code >> 18), 0x80 | ((code >> 12) & 0x3f), 0x80 | ((code >> 6) & 0x3f), 0x80 | (code & 0x3f));
  }
  return Uint8Array.from(bytes);
}
void utf8ToBytes;

const TOOL_ID = '798-assess-sandbox-application-readiness';
const TOOL_VERSION = '1.0.0';

export const meta = {
  tool_id: TOOL_ID, tool_version: TOOL_VERSION,
  mcp_name: 'assess_sandbox_readiness',
  mandate_type: 'compliance_control', gpu: false,
};

// ── Profile data (data, not behaviour) ─────────────────────────────────────
// Cite keys: paragraph references into the pinned CBOB final guidance note.
const CRITERIA_IDS = [
  'innovation',
  'consumer_benefit',
  'benchmarking_viability',
  'resources',
  'customer_risk',
  'legal_compatibility',
];
const STATUSES = ['met', 'partially_met', 'not_met'];
const SAFEGUARD_KEYS = ['consumer_redress', 'aml_cft_controls', 'data_protection', 'disclosure_to_participants'];

const PROFILES = {
  generic: {
    label: 'Generic sandbox eligibility rubric (jurisdiction-neutral)',
    criteria: {
      innovation:             { mandatory: true,  cite: 'generic rubric — structural template follows the pinned CBOB note ¶18 i; fixes no jurisdiction rule' },
      consumer_benefit:       { mandatory: true,  cite: 'generic rubric — template follows the pinned CBOB note ¶13 ii; fixes no jurisdiction rule' },
      benchmarking_viability: { mandatory: true,  cite: 'generic rubric — template follows the pinned CBOB note ¶13 iii; fixes no jurisdiction rule' },
      resources:              { mandatory: true,  cite: 'generic rubric — template follows the pinned CBOB note ¶13 iv; fixes no jurisdiction rule' },
      customer_risk:          { mandatory: true,  cite: 'generic rubric — template follows the pinned CBOB note ¶13 v; fixes no jurisdiction rule' },
      legal_compatibility:    { mandatory: true,  cite: 'generic rubric — template follows the pinned CBOB note ¶13 vi; fixes no jurisdiction rule' },
    },
    caps: {
      duration_months:      { cap: null, cite: 'generic rubric fixes no duration limit' },
      customer_cap:         { cap: 250,  cite: 'tool default disclosed by this node for the generic profile — no regulator fixes this number' },
      value_cap_per_customer: { cap: null, cite: 'generic rubric fixes no per-customer value limit' },
      aggregate_value_cap:    { cap: null, cite: 'generic rubric fixes no aggregate value limit' },
    },
    safeguard_cite: 'generic rubric — safeguards expectation follows the pinned CBOB note ¶19 iii–vi as the structural template',
    exit_cite: 'generic rubric — exit plan expectation follows the pinned CBOB note ¶17 xii / ¶18 iv as the structural template',
  },
  cbob: {
    label: 'Central Bank of The Bahamas — Regulatory Sandbox Framework (Guidance Note issued 8 Oct 2026)',
    criteria: {
      innovation:             { mandatory: false, cite: 'CBOB Guidance Note ¶18 i — innovation beneficial to The Bahamas, potential to promote financial inclusion' },
      consumer_benefit:       { mandatory: false, cite: 'CBOB Guidance Note ¶13 ii — enhance accessibility, efficiency, security and quality; broaden financial inclusion' },
      benchmarking_viability: { mandatory: false, cite: 'CBOB Guidance Note ¶13 iii — benchmarking and impact assessments demonstrating usefulness, functionality and viability' },
      resources:              { mandatory: false, cite: 'CBOB Guidance Note ¶13 iv — financial, human and technical resources sufficient to mitigate consumer risks' },
      customer_risk:          { mandatory: false, cite: 'CBOB Guidance Note ¶13 v — capacity of the technology to adversely impact customers or financial stability' },
      legal_compatibility:    { mandatory: true,  cite: 'CBOB Guidance Note ¶13 vi — compatibility with existing laws, regulations and Central Bank policies; treated as mandatory because a wholesale incompatibility is what the pre-application feedback stage (¶16 iii) screens out' },
    },
    caps: {
      duration_months:      { cap: 12,   cite: 'CBOB Guidance Note ¶28 — the proposed testing stage may not exceed 12 months' },
      customer_cap:         { cap: null, cite: 'CBOB Guidance Note ¶¶17 v, 25, 27 — customer limits are set per application by ORSAC; the source fixes no numeric cap, so none is asserted' },
      value_cap_per_customer: { cap: null, cite: 'CBOB Guidance Note ¶¶17 v, 27 v — transaction thresholds are set per application by ORSAC; no numeric cap fixed' },
      aggregate_value_cap:    { cap: null, cite: 'CBOB Guidance Note ¶¶17 v, 27 v — cash holding limits are set per application by ORSAC; no numeric cap fixed' },
    },
    safeguard_cite: 'CBOB Guidance Note ¶19 iii–vi — data protection, informed consent and disclosure, customer redress; ¶12 v / ¶35 iii — AML/CFT',
    exit_cite: 'CBOB Guidance Note ¶17 xii — application must include an exit-plan assessment; ¶18 iv — ORSAC evaluates the exit strategy; ¶45 — exit mechanics',
  },
};

const EXIT_PLAN_NOTE_CBOB = 'CBOB Guidance Note ¶17 xii and ¶18 iv — an application without an exit plan is not assessable against the evaluation criteria';
const EXIT_PLAN_NOTE_GENERIC = 'generic rubric — an application without an exit plan is not assessable (structural template: pinned CBOB note ¶17 xii)';

/**
 * compute(pp) — pure decision kernel.
 * pp: {
 *   profile: 'generic' | 'cbob',
 *   criteria: [{criterion_id, status: 'met'|'partially_met'|'not_met', evidence_ref?}],
 *   test_parameters: {duration_months, customer_cap, value_cap_per_customer?, aggregate_value_cap?, eligible_customer_types?[]},
 *   safeguards: {consumer_redress:{present:bool,evidence_ref?}, aml_cft_controls:…, data_protection:…, disclosure_to_participants:…},
 *   exit_plan: {present:bool, wind_down_days?, customer_transition?},
 * }
 * Refusal branches: unknown profile, unknown criterion id, invalid status.
 */
export function compute(pp) {
  pp = pp || {};
  const flags = [];
  const profileName = pp.profile;

  const params = (pp.test_parameters && typeof pp.test_parameters === 'object') ? pp.test_parameters : {};
  const safeguardsIn = (pp.safeguards && typeof pp.safeguards === 'object') ? pp.safeguards : {};
  const exitIn = (pp.exit_plan && typeof pp.exit_plan === 'object') ? pp.exit_plan : {};
  const criteriaIn = Array.isArray(pp.criteria) ? pp.criteria : [];

  const profile = PROFILES[profileName];
  if (!profile) {
    flags.push('REFUSED_UNKNOWN_PROFILE');
    return {
      output_payload: {
        verdict: null,
        refusal: {
          code: 'unknown_profile',
          detail: "profile must be one of " + Object.keys(PROFILES).map(function (k) { return "'" + k + "'"; }).join(' | ') + "; got " + JSON.stringify(profileName ?? null),
        },
        gaps: [], parameter_breaches: [], safeguards_missing: [], profile_cites: {},
      },
      compliance_flags: flags,
    };
  }

  // Validate criteria rows; refusal on unknown id or invalid status.
  const unknown = [];
  const invalidStatus = [];
  for (let i = 0; i < criteriaIn.length; i++) {
    const row = criteriaIn[i] || {};
    if (!Object.prototype.hasOwnProperty.call(profile.criteria, row.criterion_id)) {
      unknown.push(row.criterion_id === undefined ? null : row.criterion_id);
    } else if (STATUSES.indexOf(row.status) === -1) {
      invalidStatus.push({ criterion_id: row.criterion_id, status: row.status === undefined ? null : row.status });
    }
  }
  if (unknown.length > 0 || invalidStatus.length > 0) {
    flags.push(unknown.length ? 'REFUSED_UNKNOWN_CRITERION' : 'REFUSED_INVALID_STATUS');
    return {
      output_payload: {
        verdict: null,
        refusal: {
          code: unknown.length ? 'unknown_criterion' : 'invalid_status',
          unknown_criteria: unknown,
          invalid_status: invalidStatus,
          known_criteria: CRITERIA_IDS.slice(),
          detail: 'every criterion_id must be one of the profile criteria and every status one of met | partially_met | not_met; the node never guesses',
        },
        gaps: [], parameter_breaches: [], safeguards_missing: [], profile_cites: {},
      },
      compliance_flags: flags,
    };
  }

  // Gaps: any declared criterion not fully met, sorted by criterion_id.
  const gaps = criteriaIn
    .filter(function (r) { return r.status !== 'met'; })
    .map(function (r) {
      return {
        criterion_id: r.criterion_id,
        status: r.status,
        mandatory: profile.criteria[r.criterion_id].mandatory,
        cite: profile.criteria[r.criterion_id].cite,
        evidence_ref: r.evidence_ref === undefined ? null : r.evidence_ref,
      };
    })
    .sort(function (a, b) { return a.criterion_id < b.criterion_id ? -1 : a.criterion_id > b.criterion_id ? 1 : 0; });

  // Parameter breaches: a declared value over a profile cap. null caps never bite.
  const CAP_KEYS = ['duration_months', 'customer_cap', 'value_cap_per_customer', 'aggregate_value_cap'];
  const parameter_breaches = [];
  for (let k = 0; k < CAP_KEYS.length; k++) {
    const key = CAP_KEYS[k];
    const declared = params[key];
    const capDef = profile.caps[key];
    if (typeof declared === 'number' && Number.isFinite(declared) && capDef.cap !== null && declared > capDef.cap) {
      parameter_breaches.push({
        parameter: key, declared: declared, cap: capDef.cap, cite: capDef.cite,
      });
    }
  }
  parameter_breaches.sort(function (a, b) { return a.parameter < b.parameter ? -1 : a.parameter > b.parameter ? 1 : 0; });

  // Safeguards: each declared safeguard must carry present === true.
  const safeguards_missing = [];
  for (let k = 0; k < SAFEGUARD_KEYS.length; k++) {
    const key = SAFEGUARD_KEYS[k];
    const s = safeguardsIn[key];
    const present = !!(s && s.present === true);
    if (!present) safeguards_missing.push({ safeguard: key, cite: profile.safeguard_cite });
  }

  // Exit plan.
  const exitPresent = exitIn.present === true;
  const exit_note = profileName === 'cbob' ? EXIT_PLAN_NOTE_CBOB : EXIT_PLAN_NOTE_GENERIC;

  // Verdict.
  const mandatoryNotMet = gaps.some(function (g) { return g.mandatory && g.status === 'not_met'; });
  const fatal = mandatoryNotMet || !exitPresent;
  let verdict;
  if (fatal) verdict = 'NOT_ELIGIBLE';
  else if (gaps.length > 0 || parameter_breaches.length > 0 || safeguards_missing.length > 0) verdict = 'READY_WITH_GAPS';
  else verdict = 'READY';

  if (mandatoryNotMet) flags.push('MANDATORY_CRITERION_NOT_MET');
  if (!exitPresent) flags.push('EXIT_PLAN_MISSING');
  if (parameter_breaches.length > 0) flags.push('PARAMETER_CAP_BREACHED');
  if (safeguards_missing.length > 0) flags.push('SAFEGUARDS_MISSING');

  const profile_cites = {
    profile: profileName,
    label: profile.label,
    criteria: CRITERIA_IDS.reduce(function (o, id) { o[id] = profile.criteria[id].cite; return o; }, {}),
    caps: CAP_KEYS.reduce(function (o, k) { o[k] = profile.caps[k].cite; return o; }, {}),
    safeguards: profile.safeguard_cite,
    exit_plan: profile.exit_cite,
  };

  return {
    output_payload: {
      verdict,
      exit_plan_declared: exitPresent,
      exit_plan_note: exitPresent ? null : exit_note,
      gaps,
      parameter_breaches,
      safeguards_missing,
      profile_cites,
    },
    compliance_flags: flags,
  };
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
