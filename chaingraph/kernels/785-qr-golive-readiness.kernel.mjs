import { executionHash } from './_hash.mjs';

// 785-qr-golive-readiness — QR scheme pilot/production/cross-border go-live readiness
// assessor. Weighted blocking + advisory gates with a Level One principles checklist.
// Pure decision kernel — no DOM, no window, no Date.now(), no filesystem.
//
// The gate catalogue below is mirrored as data in
// chaingraph/kernels/fixtures/785-qr-golive-readiness.gates.json (data of record);
// sources for every gate live in the node metadata (cited_clause_digest /
// regulatory_basis), NOT here — kernel source is behaviour only.

const TOOL_ID = '785-qr-golive-readiness';
const TOOL_VERSION = '1.0.0';

export const meta = {
  tool_id: TOOL_ID, tool_version: TOOL_VERSION,
  mcp_name: 'assess_qr_golive_readiness',
  mandate_type: 'compliance_control', gpu: false,
};

const DEFAULT_PROFILE = 'qr_scheme';
const GOV_PROFILE = 'gov_payment_programme';
const PROFILES = [DEFAULT_PROFILE, GOV_PROFILE];
const STATUSES = ['met', 'partially_met', 'not_met', 'not_applicable'];
// Level One principles catalogue (array membership via includes: never a prototype-chain lookup).
const PRINCIPLE_IDS = ['instant_payment', 'interoperable', 'pay_everywhere', 'inclusive_governance', 'low_fees', 'safe_payments', 'shared_capabilities'];

// Default weights in basis points; applicable-gate weights sum to 10000.
// blocking[phase] marks gates that force NO_GO when not_met at that phase.
const CATALOGUE = [
  { gate_id: 'participant_certification', category: 'certification',            weight: 2000, blocking: { pilot: true,  production: true,  cross_border: true  } },
  { gate_id: 'uat_completion',            category: 'UAT',                      weight: 2000, blocking: { pilot: true,  production: true,  cross_border: true  } },
  { gate_id: 'config_signoff',            category: 'configuration sign-off',   weight: 1000, blocking: { pilot: true,  production: true,  cross_border: true  } },
  { gate_id: 'operating_procedures',      category: 'operating procedures',     weight: 1500, blocking: { pilot: true,  production: true,  cross_border: true  } },
  { gate_id: 'support_cover',             category: 'incident and support cover', weight: 1500, blocking: { pilot: true,  production: true,  cross_border: true  } },
  { gate_id: 'communications',            category: 'communications',           weight: 1000, blocking: { pilot: false, production: true,  cross_border: true  } },
  { gate_id: 'link_agreements',           category: 'cross-border link agreements', weight: 1000, blocking: { pilot: false, production: false, cross_border: true } },
];

// gov_payment_programme profile: phased onboarding of government agencies onto a
// collections and disbursements platform. Same engine, separate catalogue and phase set.
// Upstream verdict references (tool 226, art-459, art-517, art-516, art-519) travel as the
// optional evidence_ref string on a gate; the kernel never calls another node.
const B3 = { agency_pilot: true, agency_wave: true, full_rollout: true };
const GOV_CATALOGUE = [
  { gate_id: 'sit_exit',                    category: 'SIT exit',                         weight: 1000, blocking: B3 },
  { gate_id: 'uat_exit',                    category: 'UAT exit',                         weight: 1500, blocking: B3 },
  { gate_id: 'security_pci_scope',          category: 'security review: PCI-DSS scope',   weight: 1000, blocking: B3 },
  { gate_id: 'security_rbac',               category: 'security review: role-based access', weight: 1000, blocking: B3 },
  { gate_id: 'security_mfa',                category: 'security review: MFA',             weight: 800,  blocking: B3 },
  { gate_id: 'security_audit_trail',        category: 'security review: audit trail',     weight: 700,  blocking: B3 },
  { gate_id: 'data_migration',              category: 'data migration complete',          weight: 1000, blocking: { agency_pilot: false, agency_wave: true, full_rollout: true } },
  { gate_id: 'reconciliation_parallel_run', category: 'reconciliation parallel run',      weight: 1000, blocking: { agency_pilot: false, agency_wave: true, full_rollout: true } },
  { gate_id: 'training_change_management',  category: 'training and change management',   weight: 800,  blocking: { agency_pilot: false, agency_wave: false, full_rollout: false } },
  { gate_id: 'support_incident_cover',      category: 'support and incident cover',       weight: 700,  blocking: B3 },
  { gate_id: 'agency_signoff',              category: 'agency sign-off',                  weight: 500,  blocking: B3 },
];

const PROFILE_DEFS = {
  [DEFAULT_PROFILE]: { phases: ['pilot', 'production', 'cross_border'], catalogue: CATALOGUE, uat_gate: 'uat_completion',
    phase_next: { pilot: 'production', production: 'cross_border', cross_border: null } },
  [GOV_PROFILE]: { phases: ['agency_pilot', 'agency_wave', 'full_rollout'], catalogue: GOV_CATALOGUE, uat_gate: 'uat_exit',
    phase_next: { agency_pilot: 'agency_wave', agency_wave: 'full_rollout', full_rollout: null } },
};

const WEIGHT_MIN_BP = 0;
const WEIGHT_MAX_BP = 5000;
const UAT_COUNT_MAX = 1000000;  // explicit upper bound on every uat_summary count
const PRINCIPLES_MAX = 1000;    // explicit upper bound on the principles checklist length
const GO_THRESHOLD_BP = 9750; // GO at or above, GO_WITH_CONDITIONS below (when no blocking failure)
const STATUS_FACTOR = { met: 1, partially_met: 0.5, not_met: 0, not_applicable: 0 };

function refused(reason, flag) {
  return {
    output_payload: { refusal: true, reason, verdict: null, score_bp: null, blocking_failures: [], conditions: [], principles_summary: [], warn_count: 1, phase_next: null },
    compliance_flags: [flag],
  };
}

export function compute(pp) {
  pp = pp || {};

  // Profile selects the gate catalogue and phase set; absent means the original QR scheme profile.
  const profile = pp.profile === undefined ? DEFAULT_PROFILE : pp.profile;
  if (!PROFILES.includes(profile)) {
    return refused('profile must be one of ' + PROFILES.join(', '), 'REFUSED_INVALID_PROFILE');
  }
  const def = Object.hasOwn(PROFILE_DEFS, profile) ? PROFILE_DEFS[profile] : null;
  const CATALOGUE = def.catalogue;
  const PHASES = def.phases;
  const PHASE_NEXT = def.phase_next;

  const phase = pp.phase;
  if (!PHASES.includes(phase)) {
    return refused('phase must be one of ' + PHASES.join(', '), 'REFUSED_INVALID_PHASE');
  }
  if (!Array.isArray(pp.gates) || pp.gates.length === 0) {
    return refused('gates must be a non-empty array of {gate_id, status, evidence_ref?}', 'REFUSED_MISSING_GATES');
  }

  // Weights override — pinned bounds check before anything else is scored.
  // Null-prototype containers: caller-derived keys (gate_id) must not resolve
  // through Object.prototype (KERNEL-CALLER-KEY-LOOKUP-LINT-1).
  let weights = Object.create(null);
  for (const g of CATALOGUE) weights[g.gate_id] = g.weight;
  if (pp.weights !== undefined) {
    if (pp.weights === null || typeof pp.weights !== 'object' || Array.isArray(pp.weights)) {
      return refused('weights must be an object of {gate_id: weight_bp}', 'REFUSED_WEIGHTS_OUT_OF_BOUNDS');
    }
    const merged = Object.create(null);
    let sum = 0;
    for (const g of CATALOGUE) {
      const w = Object.hasOwn(pp.weights, g.gate_id) ? pp.weights[g.gate_id] : g.weight;
      if (!Number.isSafeInteger(w) || w < WEIGHT_MIN_BP || w > WEIGHT_MAX_BP) {
        return refused('weight for ' + g.gate_id + ' outside pinned bounds [' + WEIGHT_MIN_BP + ', ' + WEIGHT_MAX_BP + '] bp', 'REFUSED_WEIGHTS_OUT_OF_BOUNDS');
      }
      merged[g.gate_id] = w;
      sum += w;
    }
    if (sum !== 10000) {
      return refused('applicable gate weights must sum to 10000 bp, got ' + sum, 'REFUSED_WEIGHTS_OUT_OF_BOUNDS');
    }
    weights = merged;
  }

  // Submitted gate statuses (null-prototype: keys are caller-supplied gate_ids).
  const submitted = Object.create(null);
  for (const entry of pp.gates) {
    if (!entry || typeof entry !== 'object' || !CATALOGUE.some(g => g.gate_id === entry.gate_id)) {
      return refused('unknown gate_id in gates array', 'REFUSED_UNKNOWN_GATE');
    }
    if (Object.hasOwn(submitted, entry.gate_id)) {
      return refused('duplicate gate_id ' + entry.gate_id + ' in gates array', 'DUPLICATE_GATE_ID');
    }
    if (!STATUSES.includes(entry.status)) {
      return refused('status for ' + entry.gate_id + ' must be one of met, partially_met, not_met, not_applicable', 'REFUSED_INVALID_STATUS');
    }
    if (Object.hasOwn(entry, 'evidence_ref') && entry.evidence_ref !== undefined && typeof entry.evidence_ref !== 'string') {
      return refused('evidence_ref for ' + entry.gate_id + ' must be a string when present', 'EVIDENCE_REF_INVALID');
    }
    submitted[entry.gate_id] = entry;
  }

  // UAT exit criteria (matches the UAT pack's exit-criteria shape) override the
  // submitted uat_completion status when present.
  const compliance_flags = [];
  const uatGate = def.uat_gate;
  let uat = submitted[uatGate];
  if (pp.uat_summary !== undefined) {
    const u = pp.uat_summary;
    const isCount = v => Number.isSafeInteger(v) && v >= 0 && v <= UAT_COUNT_MAX;
    if (u === null || typeof u !== 'object' || Array.isArray(u)
      || !Object.hasOwn(u, 'mandatory_cases') || !Object.hasOwn(u, 'passed') || !Object.hasOwn(u, 'open_sev1')
      || !isCount(u.mandatory_cases) || !isCount(u.passed) || !isCount(u.open_sev1)) {
      return refused('uat_summary must be {mandatory_cases, passed, open_sev1} non-negative safe integers up to ' + UAT_COUNT_MAX, 'REFUSED_INVALID_UAT_SUMMARY');
    }
    const uatFailed = u.open_sev1 > 0 || u.passed < u.mandatory_cases;
    if (uatFailed) {
      uat = { gate_id: uatGate, status: 'not_met', evidence_ref: uat && uat.evidence_ref };
      compliance_flags.push('UAT_EXIT_CRITERIA_FAILED');
    }
  }

  // Per-gate resolution. A gate absent from the input counts as not_met
  // (conservative) and is flagged.
  const resolved = [];
  const missing = [];
  for (const g of CATALOGUE) {
    const entry = g.gate_id === uatGate && uat ? uat : submitted[g.gate_id];
    if (!entry) {
      missing.push(g.gate_id);
      resolved.push({ gate_id: g.gate_id, category: g.category, status: 'not_met', blocking_at_phase: g.blocking[phase], weight_bp: weights[g.gate_id], evidence_ref: null });
      continue;
    }
    resolved.push({ gate_id: g.gate_id, category: g.category, status: entry.status, blocking_at_phase: g.blocking[phase], weight_bp: weights[g.gate_id], evidence_ref: entry.evidence_ref ?? null });
  }
  if (missing.length > 0) compliance_flags.push('GATES_ASSUMED_NOT_MET:' + missing.join(','));

  // Blocking failures: any blocking-at-phase gate not_met.
  const blocking_failures = resolved
    .filter(r => r.blocking_at_phase && r.status === 'not_met')
    .map(r => ({ gate_id: r.gate_id, category: r.category, evidence_ref: r.evidence_ref }));

  // Weighted score over applicable (non not_applicable) gates.
  let num = 0, den = 0;
  for (const r of resolved) {
    if (r.status === 'not_applicable') continue;
    num += r.weight_bp * (Object.hasOwn(STATUS_FACTOR, r.status) ? STATUS_FACTOR[r.status] : undefined);
    den += r.weight_bp;
  }
  const score_bp = den > 0 ? Math.round((num / den) * 10000) : 0;

  let verdict;
  if (blocking_failures.length > 0) {
    verdict = 'NO_GO';
    compliance_flags.push('BLOCKING_GATE_NOT_MET');
  } else if (score_bp >= GO_THRESHOLD_BP) {
    verdict = 'GO';
  } else {
    verdict = 'GO_WITH_CONDITIONS';
  }

  // Conditions: every advisory (non-blocking-at-phase) gate not met, plus
  // blocking gates only partially met, listed when the verdict is conditional.
  const conditions = [];
  if (verdict !== 'NO_GO') {
    for (const r of resolved) {
      if (r.status === 'not_applicable' || r.status === 'met') continue;
      if (!r.blocking_at_phase) {
        conditions.push({ gate_id: r.gate_id, category: r.category, status: r.status, kind: 'advisory_not_met', evidence_ref: r.evidence_ref });
      } else if (r.status === 'partially_met') {
        conditions.push({ gate_id: r.gate_id, category: r.category, status: r.status, kind: 'blocking_partially_met', evidence_ref: r.evidence_ref });
      }
    }
  }

  // Level One principles checklist — advisory only, never changes the verdict.
  const principles_summary = [];
  if (pp.principles !== undefined) {
    if (!Array.isArray(pp.principles) || pp.principles.length > PRINCIPLES_MAX) {
      return refused('principles must be an array of {principle_id, status}', 'REFUSED_INVALID_PRINCIPLES');
    }
    for (const p of pp.principles) {
      if (!p || typeof p !== 'object' || typeof p.principle_id !== 'string' || !STATUSES.includes(p.status)) {
        return refused('each principle needs a principle_id and a status from met, partially_met, not_met, not_applicable', 'REFUSED_INVALID_PRINCIPLES');
      }
      if (!PRINCIPLE_IDS.includes(p.principle_id)) {
        return refused('principle_id must be one of ' + PRINCIPLE_IDS.join(', '), 'UNKNOWN_PRINCIPLE_ID');
      }
      principles_summary.push({ principle_id: p.principle_id, status: p.status });
    }
  }

  const output_payload = {
    refusal: false,
    verdict,
    score_bp,
    go_threshold_bp: GO_THRESHOLD_BP,
    phase,
    blocking_failures,
    conditions,
    principles_summary,
    warn_count: compliance_flags.length,
    advisory_note: 'principles_summary is advisory only and does not affect the verdict',
    phase_next: Object.hasOwn(PHASE_NEXT, phase) ? PHASE_NEXT[phase] : null,
    decision_support_note: 'DECISION-SUPPORT DRAFT — not a supervisory or regulatory assessment of any named participant or scheme.',
  };
  // The profile id is echoed only for non-default profiles, so default-profile outputs keep their bytes.
  if (profile !== DEFAULT_PROFILE) output_payload.profile = profile;

  return { output_payload, compliance_flags };
}

// Hashability walk: mirrors the classes _hash.mjs refuses before canonicalizing (a
// non-finite number, an integer outside the 2^53 safe range, nesting past MAX_DEPTH, more
// values than MAX_ELEMENTS). Reports { reason, detail } with path and kind only, never the
// value; null when the subtree is safe to hash.
const HASH_MAX_DEPTH = 512;        // _hash.mjs MAX_DEPTH
const HASH_MAX_ELEMENTS = 1000000; // _hash.mjs MAX_ELEMENTS

function findHashRefusal(v, path, depth, budget) {
  if (depth > budget.maxDepth) return { reason: 'REFUSED_INPUT_HASH_LIMIT', detail: path + ': too_deep' };
  if (++budget.n > budget.maxElements) return { reason: 'REFUSED_INPUT_HASH_LIMIT', detail: path + ': too_many_values' };
  if (typeof v === 'number') {
    if (!Number.isFinite(v)) return { reason: 'REFUSED_INPUT_UNSAFE_NUMBER', detail: path + ': non_finite' };
    if (Number.isInteger(v) && !Number.isSafeInteger(v)) return { reason: 'REFUSED_INPUT_UNSAFE_NUMBER', detail: path + ': unsafe_integer' };
    return null;
  }
  if (Array.isArray(v)) {
    for (let i = 0; i < v.length; i++) {
      const r = findHashRefusal(v[i], path + '[' + i + ']', depth + 1, budget);
      if (r !== null) return r;
    }
    return null;
  }
  if (v !== null && typeof v === 'object') {
    const ks = Object.keys(v).sort();
    for (let i = 0; i < ks.length; i++) {
      const r = findHashRefusal(v[ks[i]], path + '.' + ks[i], depth + 1, budget);
      if (r !== null) return r;
    }
  }
  return null;
}

export async function buildArtifact(pp, { now = null, parent_hashes = [], parent_tool_ids = [], chain_depth = 0 } = {}) {
  // The walked object is the exact execution_hash preimage. When the shared canonicalizer
  // would refuse it, mint the artifact with a null execution_hash and the reason beside it
  // instead of letting the hash throw: buildArtifact never throws on any input.
  let output_payload, compliance_flags, unhashable;
  const ppWalk = findHashRefusal(pp, 'pp', 1, { maxDepth: HASH_MAX_DEPTH - 8, maxElements: 199000, n: 0 });
  if (ppWalk !== null) {
    // pp itself is unhashable or oversized: do not run compute() over it.
    ({ output_payload, compliance_flags } = refused('policy parameters cannot be hashed: ' + ppWalk.detail, ppWalk.reason));
    unhashable = findHashRefusal({ policy_parameters: pp, output_payload }, 'pp', 1, { maxDepth: HASH_MAX_DEPTH, maxElements: HASH_MAX_ELEMENTS, n: 0 }) || ppWalk;
  } else {
    ({ output_payload, compliance_flags } = compute(pp));
    unhashable = findHashRefusal({ policy_parameters: pp, output_payload }, 'pp', 1, { maxDepth: HASH_MAX_DEPTH, maxElements: HASH_MAX_ELEMENTS, n: 0 });
  }
  const hash = unhashable === null ? await executionHash(pp, output_payload) : null;
  const artifact = {
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
  if (unhashable !== null) artifact.hash_refusal = { reason: unhashable.reason, detail: unhashable.detail };
  return artifact;
}
