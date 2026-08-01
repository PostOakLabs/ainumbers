import { executionHash } from './_hash.mjs';

const TOOL_ID = 'art-523-identity-proofing-assurance-level';
const TOOL_VERSION = '1.0.0';

export const meta = {
  tool_id: TOOL_ID, tool_version: TOOL_VERSION,
  mcp_name: 'compute_identity_proofing_assurance_level',
  mandate_type: 'regulatory_reporting', gpu: false,
};

// Identity-proofing assurance-level evaluator per EKYC-EVIDENCE-BUILD-SPEC.md §3.
// Rates a DECLARED evidence set against a caller-supplied, versioned assurance-level
// framework (the art-444 policy-input pattern) -- NIST 800-63-3 IAL1/2/3, eIDAS
// LoA low/substantial/high, or any other framework are all the SAME input shape:
// level_definition.levels[] ordered lowest-to-highest rigor, each level a list of
// criteria naming a required_evidence_type and a numeric min_strength (strength is
// a caller-normalized 0-100 scale -- the kernel never interprets a framework's own
// named tiers, e.g. "weak/fair/strong/superior" or "low/substantial/high"; the
// caller maps those onto min_strength/strength numbers before calling). A criterion
// missing required_evidence_type or min_strength is UNDECIDABLE, never a shortfall --
// the definition cannot express what it is asking for, which is a different defect
// from evidence failing to meet a well-formed criterion (IAL_DEFINITION_INSUFFICIENT
// vs IAL_SHORTFALL, per spec §3, must never collapse into one flag).
//
// This node rates an EVIDENCE SET against a DECLARED policy. It does NOT assert a
// person is who they claim to be (SPEC §23 honest posture) -- output_payload never
// carries identity attributes, only evidence type/strength/verification_method and,
// where the caller supplies one, an opaque attribute_ref carried through unread --
// a caller-supplied value with no commitment scheme claimed by this node, never a
// plaintext value. No approver identity, signature, approval field or role (§27
// boundary) -- manual review/EDD escalation is a separate signed
// human_accountability_record, not minted here.
//
// Pure ECMA-262 arithmetic only -- no Date.now/new Date(), no Math.random. `as_of`
// is caller-supplied and carried through unread; the kernel never compares it to a
// clock (§24.1).

function safeNum(v, def) { const n = Number(v); return Number.isFinite(n) ? n : def; }
function str(v, def) { return (typeof v === 'string' && v) ? v : def; }
function arr(v) { return Array.isArray(v) ? v : []; }

function findLevelIndex(levels, levelId) {
  for (let i = 0; i < levels.length; i++) {
    if (levels[i] && levels[i].level_id === levelId) return i;
  }
  return -1;
}

// Best matching evidence item for one criterion: same required_evidence_type, same
// verification_method if the criterion names one, highest strength among matches.
function bestMatch(evidenceItems, criterion) {
  let best = null;
  for (const ev of evidenceItems) {
    if (!ev || ev.type !== criterion.required_evidence_type) continue;
    if (criterion.verification_method && ev.verification_method !== criterion.verification_method) continue;
    const strength = safeNum(ev.strength, -1);
    if (strength < 0) continue;
    if (!best || strength > best.strength) best = { evidence_id: str(ev.evidence_id, null), strength };
  }
  return best;
}

// Evaluate one level's criteria against the declared evidence set.
// Returns { criteria_evaluated, met:[], shortfall:[], undecidable:[] }.
function evalLevel(level, evidenceItems) {
  const criteria = arr(level && level.criteria);
  const met = [];
  const shortfall = [];
  const undecidable = [];

  for (const c of criteria) {
    const criterionId = str(c && c.criterion_id, null);
    const requiredType = str(c && c.required_evidence_type, null);
    const minStrength = (c && c.min_strength !== undefined && c.min_strength !== null) ? safeNum(c.min_strength, null) : null;

    if (!requiredType || minStrength === null) {
      undecidable.push({
        level_id: level.level_id,
        criterion_id: criterionId,
        reason: !requiredType
          ? 'criterion has no required_evidence_type -- the definition cannot express what evidence would satisfy it'
          : 'criterion has no min_strength -- the definition cannot express how strong the evidence must be',
      });
      continue;
    }

    const match = bestMatch(evidenceItems, { required_evidence_type: requiredType, verification_method: c.verification_method });
    if (match && match.strength >= minStrength) {
      met.push({ level_id: level.level_id, criterion_id: criterionId, matched_evidence_id: match.evidence_id, matched_strength: match.strength });
    } else {
      shortfall.push({
        level_id: level.level_id,
        criterion_id: criterionId,
        description: str(c && c.description, null),
        required_evidence_type: requiredType,
        min_strength: minStrength,
        reason: match
          ? `best available evidence of type "${requiredType}" has strength ${match.strength}, below required ${minStrength}`
          : `no declared evidence item of type "${requiredType}"${c.verification_method ? ` verified by "${c.verification_method}"` : ''}`,
      });
    }
  }

  return { criteria_evaluated: criteria.length, met, shortfall, undecidable };
}

export function compute(pp) {
  pp = pp || {};

  const def = pp.level_definition || {};
  const frameworkId = str(def.framework_id, null);
  const frameworkVersion = str(def.framework_version, null);
  const levels = arr(def.levels);
  const evidenceItems = arr(pp.evidence_items);
  const declaredTargetLevel = str(pp.declared_target_level, null);
  const asOf = str(pp.as_of, null);

  const compliance_flags = [];

  const targetIdx = declaredTargetLevel ? findLevelIndex(levels, declaredTargetLevel) : -1;
  const definitionUsable = levels.length > 0 && targetIdx >= 0;

  let achievedLevel = null;
  let targetMet = false;
  let shortfall = [];
  let undecidable = [];
  let criteriaEvaluated = 0;
  let criteriaMet = 0;

  if (definitionUsable) {
    // Evaluate the target level directly -- this is what shortfall/undecidable report.
    const targetResult = evalLevel(levels[targetIdx], evidenceItems);
    shortfall = targetResult.shortfall;
    undecidable = targetResult.undecidable;
    criteriaEvaluated = targetResult.criteria_evaluated;
    criteriaMet = targetResult.met.length;

    const decidableAtTarget = targetResult.criteria_evaluated - targetResult.undecidable.length;
    targetMet = decidableAtTarget > 0 && targetResult.shortfall.length === 0;
    if (targetResult.criteria_evaluated === 0) targetMet = true; // vacuous: level declares no criteria

    if (targetMet) {
      achievedLevel = declaredTargetLevel;
    } else {
      // Walk down from the level below target to find the highest fully-met level.
      for (let i = targetIdx - 1; i >= 0; i--) {
        const r = evalLevel(levels[i], evidenceItems);
        const decidable = r.criteria_evaluated - r.undecidable.length;
        const passes = r.criteria_evaluated === 0 || (decidable > 0 && r.shortfall.length === 0);
        if (passes) { achievedLevel = levels[i].level_id; break; }
      }
    }
  }

  if (!definitionUsable || undecidable.length > 0) {
    compliance_flags.push('IAL_DEFINITION_INSUFFICIENT');
  }
  if (evidenceItems.length === 0) {
    compliance_flags.push('IAL_EVIDENCE_UNDECLARED');
  }
  if (definitionUsable) {
    if (targetMet) compliance_flags.push('IAL_MET');
    else if (shortfall.length > 0) compliance_flags.push('IAL_SHORTFALL');
  }
  if (compliance_flags.length === 0) compliance_flags.push('IAL_DEFINITION_INSUFFICIENT');

  const output_payload = {
    framework_id: frameworkId,
    framework_version: frameworkVersion,
    declared_target_level: declaredTargetLevel,
    as_of: asOf,
    levels_defined: levels.length,
    target_level_found: targetIdx >= 0,
    evidence_item_count: evidenceItems.length,
    criteria_evaluated: criteriaEvaluated,
    criteria_met: criteriaMet,
    criteria_shortfall_count: shortfall.length,
    criteria_undecidable_count: undecidable.length,
    achieved_level: achievedLevel,
    target_met: targetMet,
    shortfall,
    undecidable,
    note: 'Rates a DECLARED evidence set against a caller-supplied, versioned assurance-level framework -- never a hardcoded one. Does not assert a person is who they claim to be: this evidences that a declared evidence set was measured against a declared policy, not the truth of the declarations. A criterion the definition cannot express (no required_evidence_type or no min_strength) is reported as IAL_DEFINITION_INSUFFICIENT, distinct from IAL_SHORTFALL (evidence present but not meeting a well-formed criterion) -- the two are never conflated. No identity attributes are ever computed over; evidence items are types, strengths and verification methods, with an optional opaque attribute reference (caller-supplied, no commitment scheme claimed by this node) carried through unread.',
  };

  return { output_payload, compliance_flags };
}

export async function buildArtifact(pp, { now, parent_hashes = [], parent_tool_ids = [], chain_depth = 0 } = {}) {
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
