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

const PHASES = ['pilot', 'production', 'cross_border'];
const STATUSES = ['met', 'partially_met', 'not_met', 'not_applicable'];

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

const WEIGHT_MIN_BP = 0;
const WEIGHT_MAX_BP = 5000;
const GO_THRESHOLD_BP = 9750; // GO at or above, GO_WITH_CONDITIONS below (when no blocking failure)
const STATUS_FACTOR = { met: 1, partially_met: 0.5, not_met: 0, not_applicable: 0 };

const PHASE_NEXT = { pilot: 'production', production: 'cross_border', cross_border: null };

function refused(reason, flag) {
  return {
    output_payload: { refusal: true, reason, verdict: null, score_bp: null, blocking_failures: [], conditions: [], principles_summary: [], phase_next: null },
    compliance_flags: [flag],
  };
}

export function compute(pp) {
  pp = pp || {};

  const phase = pp.phase;
  if (!PHASES.includes(phase)) {
    return refused('phase must be one of pilot, production, cross_border', 'REFUSED_INVALID_PHASE');
  }
  if (!Array.isArray(pp.gates) || pp.gates.length === 0) {
    return refused('gates must be a non-empty array of {gate_id, status, evidence_ref?}', 'REFUSED_MISSING_GATES');
  }

  // Weights override — pinned bounds check before anything else is scored.
  let weights = {};
  for (const g of CATALOGUE) weights[g.gate_id] = g.weight;
  if (pp.weights !== undefined && pp.weights !== null) {
    if (typeof pp.weights !== 'object' || Array.isArray(pp.weights)) {
      return refused('weights must be an object of {gate_id: weight_bp}', 'REFUSED_WEIGHTS_OUT_OF_BOUNDS');
    }
    const merged = {};
    let sum = 0;
    for (const g of CATALOGUE) {
      const w = pp.weights[g.gate_id] !== undefined ? pp.weights[g.gate_id] : g.weight;
      if (typeof w !== 'number' || !isFinite(w) || w < WEIGHT_MIN_BP || w > WEIGHT_MAX_BP) {
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

  // Submitted gate statuses.
  const submitted = {};
  for (const entry of pp.gates) {
    if (!entry || typeof entry !== 'object' || !CATALOGUE.some(g => g.gate_id === entry.gate_id)) {
      return refused('unknown gate_id in gates array', 'REFUSED_UNKNOWN_GATE');
    }
    if (!STATUSES.includes(entry.status)) {
      return refused('status for ' + entry.gate_id + ' must be one of met, partially_met, not_met, not_applicable', 'REFUSED_INVALID_STATUS');
    }
    submitted[entry.gate_id] = entry;
  }

  // UAT exit criteria (matches the UAT pack's exit-criteria shape) override the
  // submitted uat_completion status when present.
  const compliance_flags = [];
  let uat = submitted['uat_completion'];
  if (pp.uat_summary !== undefined && pp.uat_summary !== null) {
    const u = pp.uat_summary;
    if (typeof u !== 'object' || typeof u.mandatory_cases !== 'number' || typeof u.passed !== 'number' || typeof u.open_sev1 !== 'number') {
      return refused('uat_summary must be {mandatory_cases, passed, open_sev1} numbers', 'REFUSED_INVALID_UAT_SUMMARY');
    }
    const uatFailed = u.open_sev1 > 0 || u.passed < u.mandatory_cases;
    if (uatFailed) {
      uat = { gate_id: 'uat_completion', status: 'not_met', evidence_ref: uat && uat.evidence_ref };
      compliance_flags.push('UAT_EXIT_CRITERIA_FAILED');
    }
  }

  // Per-gate resolution. A gate absent from the input counts as not_met
  // (conservative) and is flagged.
  const resolved = [];
  const missing = [];
  for (const g of CATALOGUE) {
    const entry = g.gate_id === 'uat_completion' && uat ? uat : submitted[g.gate_id];
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
    num += r.weight_bp * STATUS_FACTOR[r.status];
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
  if (pp.principles !== undefined && pp.principles !== null) {
    if (!Array.isArray(pp.principles)) {
      return refused('principles must be an array of {principle_id, status}', 'REFUSED_INVALID_PRINCIPLES');
    }
    for (const p of pp.principles) {
      if (!p || typeof p !== 'object' || typeof p.principle_id !== 'string' || !STATUSES.includes(p.status)) {
        return refused('each principle needs a principle_id and a status from met, partially_met, not_met, not_applicable', 'REFUSED_INVALID_PRINCIPLES');
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
    advisory_note: 'principles_summary is advisory only and does not affect the verdict',
    phase_next: PHASE_NEXT[phase],
    decision_support_note: 'DECISION-SUPPORT DRAFT — not a supervisory or regulatory assessment of any named participant or scheme.',
  };

  return { output_payload, compliance_flags };
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
