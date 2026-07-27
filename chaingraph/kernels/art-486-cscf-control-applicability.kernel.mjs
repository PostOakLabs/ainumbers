import { executionHash } from './_hash.mjs';

const TOOL_ID = 'art-486-cscf-control-applicability';
const TOOL_VERSION = '1.0.0';

export const meta = {
  tool_id: TOOL_ID, tool_version: TOOL_VERSION,
  mcp_name: 'check_cscf_control_applicability',
  mandate_type: 'compliance_mandate', gpu: false,
};

// Scores a firm's declared architecture type + component inventory against a POLICY-SUPPLIED
// Swift CSCF control matrix (control_number, tier, applicable_architecture_types, evidence_ref) --
// the matrix is a kernel INPUT, never embedded kernel source, because the control set changes
// annually (SWIFT-CSP-BUILD-SPEC.md kill criteria) and Swift's own control text is not ours to
// redistribute. Declared implementation_status per control drives coverage/gap classification.
// Every applicable control lands in exactly one bucket -- implemented, gap, or not_applicable
// WITH a stated reason -- so an omission can never silently read as a pass (SPEC §0.3).
//
// Deterministic by construction: string/array membership + integer counting only, no floats
// beyond a single round(pct,2). No Date.now()/Math.random()/locale formatting/hash-heavy ops.

function isNonEmptyStr(v) { return typeof v === 'string' && v.length > 0; }
function round2(n) { return Math.round(n * 100) / 100; }

export function compute(pp) {
  pp = pp || {};
  if (!isNonEmptyStr(pp.architecture_type)) throw new Error('architecture_type is required');
  if (!isNonEmptyStr(pp.cscf_version)) throw new Error('cscf_version is required');
  if (!Array.isArray(pp.control_matrix) || pp.control_matrix.length === 0) {
    throw new Error('control_matrix must be a non-empty array (policy-supplied, never kernel source)');
  }
  const componentInventory = Array.isArray(pp.component_inventory) ? pp.component_inventory.slice() : [];
  const implementationStatus = (pp.implementation_status && typeof pp.implementation_status === 'object') ? pp.implementation_status : {};

  const architectureType = pp.architecture_type;
  const cscfVersion = pp.cscf_version;

  const gapList = [];
  const evidenceIndex = {};
  const notApplicableSet = {};
  let mandatoryTotal = 0, mandatoryImplemented = 0, mandatoryNa = 0;
  let advisoryTotal = 0, advisoryImplemented = 0, advisoryNa = 0;

  const sortedMatrix = pp.control_matrix.slice().sort((a, b) => {
    const an = String(a.control_number), bn = String(b.control_number);
    return an < bn ? -1 : an > bn ? 1 : 0;
  });

  for (const entry of sortedMatrix) {
    if (!entry || !isNonEmptyStr(entry.control_number)) throw new Error('every control_matrix entry needs a control_number');
    if (entry.tier !== 'mandatory' && entry.tier !== 'advisory') throw new Error('control ' + entry.control_number + ' has an invalid tier (must be mandatory or advisory)');
    const applicableTypes = Array.isArray(entry.applicable_architecture_types) ? entry.applicable_architecture_types : [];
    const applicable = applicableTypes.indexOf(architectureType) !== -1 || applicableTypes.indexOf('ALL') !== -1;
    if (!applicable) continue;

    const controlNumber = entry.control_number;
    const evidenceRef = isNonEmptyStr(entry.evidence_ref) ? entry.evidence_ref : null;
    const status = (implementationStatus[controlNumber] && typeof implementationStatus[controlNumber] === 'object') ? implementationStatus[controlNumber] : {};

    evidenceIndex[controlNumber] = { tier: entry.tier, evidence_ref: evidenceRef, evidence_provided: status.evidence_provided === true };

    if (status.not_applicable === true) {
      if (!isNonEmptyStr(status.na_reason)) throw new Error('control ' + controlNumber + ' marked not_applicable without a stated na_reason');
      notApplicableSet[controlNumber] = status.na_reason;
      if (entry.tier === 'mandatory') mandatoryNa++; else advisoryNa++;
      if (entry.tier === 'mandatory') mandatoryTotal++; else advisoryTotal++;
      continue;
    }

    if (entry.tier === 'mandatory') mandatoryTotal++; else advisoryTotal++;

    if (status.implemented === true) {
      if (entry.tier === 'mandatory') mandatoryImplemented++; else advisoryImplemented++;
    } else {
      gapList.push({ control_number: controlNumber, tier: entry.tier, evidence_ref: evidenceRef });
    }
  }

  const mandatoryApplicable = mandatoryTotal - mandatoryNa;
  const advisoryApplicable = advisoryTotal - advisoryNa;
  const mandatoryCoveragePct = mandatoryApplicable > 0 ? round2((mandatoryImplemented / mandatoryApplicable) * 100) : 100;
  const advisoryCoveragePct = advisoryApplicable > 0 ? round2((advisoryImplemented / advisoryApplicable) * 100) : 100;
  const mandatoryGapCount = gapList.filter((g) => g.tier === 'mandatory').length;
  const overallStatus = mandatoryGapCount === 0 ? 'compliant' : 'gaps_present';

  const output_payload = {
    architecture_type: architectureType,
    cscf_version: cscfVersion,
    component_inventory: componentInventory,
    applicable_mandatory_count: mandatoryTotal,
    applicable_advisory_count: advisoryTotal,
    mandatory_coverage_pct: mandatoryCoveragePct,
    advisory_coverage_pct: advisoryCoveragePct,
    gap_list: gapList,
    evidence_index: evidenceIndex,
    not_applicable_set: notApplicableSet,
    overall_status: overallStatus,
  };

  const compliance_flags = [overallStatus === 'compliant' ? 'CSCF_MANDATORY_COVERAGE_COMPLETE' : 'CSCF_MANDATORY_GAPS_PRESENT'];

  return { output_payload, compliance_flags };
}

export async function buildArtifact(pp, { now, parent_hashes = [], parent_tool_ids = [], chain_depth = 0 } = {}) {
  const { output_payload, compliance_flags } = compute(pp);
  const hash = await executionHash(pp, output_payload);
  return {
    '@context': 'https://ainumbers.co/chaingraph/context/v0.3/context.jsonld',
    chaingraph_version: '0.4.0', mandate_type: meta.mandate_type,
    tool_id: TOOL_ID, tool_version: TOOL_VERSION, generated_at: now ?? null,
    execution_hash: hash, chain: { parent_hashes, parent_tool_ids, chain_depth },
    policy_parameters: pp, output_payload, compliance_flags, compute_mode: 'server',
    audit_signature: { payloadType: 'application/vnd.openchain.graph+json;version=0.4', payload: '', signatures: [] },
  };
}
