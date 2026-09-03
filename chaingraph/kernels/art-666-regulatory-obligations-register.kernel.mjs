import { executionHash } from './_hash.mjs';

// art-666 — Regulatory Obligations Register: a regime-agnostic rule-to-obligation-to-evidence
// register verdict, staged 2026-09-03 per OBLIGATIONS-REGISTER-BUILD-SPEC.md (Tim-approved
// gap-scan slate; source research/REGTECH-GAP-SCAN-2026-09-03.md Tier 1.1 + research/
// REDTEAM-GAP-VERDICTS-2026-09-03.md Sec. 7.1 KEEP). Five stages, one pure compute():
//   stage 1  obligation intake + shape validation, fail closed on a missing rule_id
//   stage 2  owner coverage: assigned/total counts plus the unassigned rule_id list
//   stage 3  control linkage: obligations carrying at least one control_id
//   stage 4  evidence linkage: obligations carrying at least one evidence_ref
//   stage 5  register verdict: one FAIL finding per failing check, overall COVERED/GAPS_FOUND
//
// The worked example in the spec's canonical fenced preimage is the oracle this kernel was
// built against: compute() over its policy_parameters reproduces its output_payload
// byte-identically (golden fixture worked-example-spec-pinned, golden_hash bdf74ddc...34ba67).
//
// GATED CHECKS ARE OWNER AND EVIDENCE ONLY. Control linkage (stage 3) is measured, never
// gated: the spec's own worked example ships control_linked 2 of 3 with no control finding,
// so a control_coverage finding would diverge from the pinned oracle. An obligation without
// a control but with an owner and evidence is COVERED here; control-depth attestation is the
// downstream packs' job, not this spine's.
//
// FLAG-MIRROR DOCTRINE (AUTHORING-STANDARD.md flag-mirror section): compliance_flags is
// CONSTANT by design — ['OBLREG_REGISTER_ASSESSED'] on every input, the always-emitted
// "the register was assessed" marker. Every conditional outcome (intake failure, owner gaps,
// evidence gaps, the verdict itself) already lives in output_payload (intake_error on the
// error path only, unassigned, findings, overall_determination), so no gate needs to route on
// a flag and no mirror member is owed. Do not add a conditional flag without adding a mirror.
//
// DETERMINISM: compute() is a pure function of pp — no clock, no randomness, no network, no
// filesystem, no TextEncoder/atob/btoa/URL (the QuickJS guest lacks all four). Percentage
// rounding is one Math.round over a non-negative ratio scaled by 10, IEEE-754 exact in every
// required execution environment; integer counts never round.

const TOOL_ID = 'art-666-regulatory-obligations-register';
const TOOL_VERSION = '1.0.0';

export const meta = {
  tool_id: TOOL_ID, tool_version: TOOL_VERSION,
  mcp_name: 'compute_regulatory_obligations_register',
  mandate_type: 'compliance_control', gpu: false,
};

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function nonEmptyString(v) {
  return typeof v === 'string' && v.trim().length > 0;
}

// Stage 1 — intake + shape validation. Returns the first violation as a string, or null when
// the whole register is well-formed. Fail closed: any violation zeroes the register and emits
// an intake_validation FAIL finding; partial counts over a malformed register would be
// silently-wrong coverage numbers, the exact failure mode this stage exists to prevent.
function validateIntake(pp) {
  const ip = pp.input_parameters;
  if (!ip || typeof ip !== 'object' || Array.isArray(ip)) return 'input_parameters is required.';
  if (ip.as_of !== undefined && ip.as_of !== null) {
    if (typeof ip.as_of !== 'string' || !ISO_DATE_RE.test(ip.as_of)) {
      return 'input_parameters.as_of, when present, must be a YYYY-MM-DD date string.';
    }
  }
  if (!Array.isArray(ip.rules)) return 'input_parameters.rules must be an array.';
  if (ip.rules.length === 0) return 'input_parameters.rules is empty; a register must carry at least one obligation.';
  const seen = new Set();
  for (let i = 0; i < ip.rules.length; i++) {
    const r = ip.rules[i];
    const label = `rules[${i}]`;
    if (!r || typeof r !== 'object' || Array.isArray(r)) return `${label} must be an object.`;
    if (!nonEmptyString(r.rule_id)) return `${label}.rule_id is required (fail closed on a missing rule_id).`;
    if (r.owner !== undefined && r.owner !== null && !nonEmptyString(r.owner)) {
      return `${label}.owner must be a non-empty string or null (null marks an unassigned obligation).`;
    }
    for (const field of ['control_ids', 'evidence_refs']) {
      const v = r[field];
      if (v === undefined || v === null) continue; // absent linkage reads as none, not as malformed
      if (!Array.isArray(v)) return `${label}.${field} must be an array of non-empty strings.`;
      for (let j = 0; j < v.length; j++) {
        if (!nonEmptyString(v[j])) return `${label}.${field}[${j}] must be a non-empty string.`;
      }
    }
    if (seen.has(r.rule_id)) {
      return `duplicate rule_id "${r.rule_id}" at ${label}; register entries must be unique.`;
    }
    seen.add(r.rule_id);
  }
  return null;
}

// One-decimal percentage rounding: Math.round over the scaled ratio. Non-negative domain, so
// Math.round's half-up-on-ties behavior is uniform and IEEE-754 reproducible. 2/3 -> 66.7,
// 1/3 -> 33.3 (the worked example's two pinned values).
function pct(numerator, denominator) {
  if (denominator <= 0) return 0;
  return Math.round((numerator / denominator) * 1000) / 10;
}

/**
 * compute(pp) — the five-stage register verdict. Pure and synchronous.
 * pp: { input_parameters: { as_of?: "YYYY-MM-DD", rules: [{ rule_id, owner?, control_ids?, evidence_refs? }] } }
 * @returns {{ output_payload: object, compliance_flags: string[] }}
 *
 * On a well-formed register the payload carries exactly the nine pinned members
 * (total, owner_assigned, owner_coverage_pct, control_linked, evidence_linked,
 * evidence_coverage_pct, unassigned, findings, overall_determination) — the worked example's
 * execution_hash pins that shape, so no member may be added on this path. intake_error joins
 * only the fail-closed path, where no pin applies.
 */
export function compute(pp) {
  pp = pp || {};

  // Stage 1 — intake. Fail closed: a malformed register yields zeroed counts, an empty
  // unassigned list (unvalidated rule_ids must never surface as coverage data), a single
  // intake_validation FAIL finding, and GAPS_FOUND.
  const intake_error = validateIntake(pp);
  if (intake_error !== null) {
    return {
      output_payload: {
        total: 0,
        owner_assigned: 0,
        owner_coverage_pct: 0,
        control_linked: 0,
        evidence_linked: 0,
        evidence_coverage_pct: 0,
        unassigned: [],
        findings: [{ check: 'intake_validation', status: 'FAIL', detail: intake_error }],
        overall_determination: 'GAPS_FOUND',
        intake_error,
      },
      compliance_flags: ['OBLREG_REGISTER_ASSESSED'],
    };
  }

  // Stages 2-4 over the validated register, in input order.
  const rules = pp.input_parameters.rules;
  const total = rules.length;
  const unassigned = [];
  let ownerAssigned = 0;
  let controlLinked = 0;
  let evidenceLinked = 0;
  for (const r of rules) {
    if (nonEmptyString(r.owner)) ownerAssigned++;
    else unassigned.push(r.rule_id);
    if (Array.isArray(r.control_ids) && r.control_ids.length > 0) controlLinked++;
    if (Array.isArray(r.evidence_refs) && r.evidence_refs.length > 0) evidenceLinked++;
  }

  // Stage 5 — verdict. Findings name failing checks only, per the spec's "findings per
  // failing check"; a passing check emits nothing. Detail strings are pinned by the worked
  // example ("<n> of <total> no owner" / "<n> of <total> no evidence pointer").
  const findings = [];
  if (unassigned.length > 0) {
    findings.push({ check: 'owner_coverage', status: 'FAIL', detail: `${unassigned.length} of ${total} no owner` });
  }
  const noEvidence = total - evidenceLinked;
  if (noEvidence > 0) {
    findings.push({ check: 'evidence_coverage', status: 'FAIL', detail: `${noEvidence} of ${total} no evidence pointer` });
  }

  return {
    output_payload: {
      total,
      owner_assigned: ownerAssigned,
      owner_coverage_pct: pct(ownerAssigned, total),
      control_linked: controlLinked,
      evidence_linked: evidenceLinked,
      evidence_coverage_pct: pct(evidenceLinked, total),
      unassigned,
      findings,
      overall_determination: findings.length > 0 ? 'GAPS_FOUND' : 'COVERED',
    },
    compliance_flags: ['OBLREG_REGISTER_ASSESSED'],
  };
}

export async function buildArtifact(pp, { now = null, parent_hashes = [], parent_tool_ids = [], chain_depth = 0, supersedes = undefined } = {}) {
  const { output_payload, compliance_flags } = compute(pp);
  const hash = await executionHash(pp, output_payload);
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
  if (Array.isArray(supersedes) && supersedes.length > 0) {
    artifact.supersedes = supersedes;
  }
  return artifact;
}
