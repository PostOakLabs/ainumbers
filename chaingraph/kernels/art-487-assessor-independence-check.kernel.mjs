import { executionHash } from './_hash.mjs';

const TOOL_ID = 'art-487-assessor-independence-check';
const TOOL_VERSION = '1.0.0';

export const meta = {
  tool_id: TOOL_ID, tool_version: TOOL_VERSION,
  mcp_name: 'check_assessor_independence',
  mandate_type: 'compliance_mandate', gpu: false,
};

// Eligibility check for a Swift CSCF Independent Assessment Framework assessment: route
// permitted for the declared architecture type (policy-supplied, never hard-coded -- Swift's
// route-by-architecture-type table is a per-cycle policy input like the CSCF matrix in
// art-486), claimed assessor certifications against a policy-supplied required set, a
// distinct-identity independence test (SPEC §9/§27.3: one human wearing two hats -- assessor
// AND implementer -- cannot satisfy both sides), and assessment-date validity against the
// attestation deadline. Returns eligible/ineligible WITH the first failing predicate named so
// a rejection is always traceable.
//
// Deterministic by construction: string membership + array intersection + ISO date-string
// comparison only. No Date.now()/Math.random()/locale formatting.

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
function isNonEmptyStr(v) { return typeof v === 'string' && v.length > 0; }
function strArr(v) { return Array.isArray(v) ? v.filter((x) => typeof x === 'string') : []; }

export function compute(pp) {
  pp = pp || {};
  if (!isNonEmptyStr(pp.architecture_type)) throw new Error('architecture_type is required');
  if (!isNonEmptyStr(pp.assessment_route)) throw new Error('assessment_route is required');
  if (['internal_2nd_line', 'internal_3rd_line', 'external'].indexOf(pp.assessment_route) === -1) {
    throw new Error('assessment_route must be one of internal_2nd_line, internal_3rd_line, external');
  }
  if (!Array.isArray(pp.permitted_routes) || pp.permitted_routes.length === 0) {
    throw new Error('permitted_routes must be a non-empty array (policy-supplied per architecture_type)');
  }
  if (!isNonEmptyStr(pp.assessment_date) || !isNonEmptyStr(pp.attestation_deadline)) {
    throw new Error('assessment_date and attestation_deadline are required');
  }
  if (!Array.isArray(pp.identity_set) || pp.identity_set.length === 0) {
    throw new Error('identity_set must be a non-empty array of {person_id, roles}');
  }

  const identityIds = pp.identity_set.map((i) => i && i.person_id).filter(isNonEmptyStr);
  const implementerIds = strArr(pp.implementer_person_ids);
  const assessorIds = strArr(pp.assessor_person_ids);
  for (const id of implementerIds.concat(assessorIds)) {
    if (identityIds.indexOf(id) === -1) throw new Error('person_id ' + id + ' referenced but not present in identity_set');
  }

  const requiredCerts = strArr(pp.required_certifications);
  const claimedCerts = strArr(pp.claimed_assessor_certifications);

  const routeEligible = pp.permitted_routes.indexOf(pp.assessment_route) !== -1;
  const certEligible = requiredCerts.length === 0 || requiredCerts.some((c) => claimedCerts.indexOf(c) !== -1);

  const overlapping = assessorIds.filter((id) => implementerIds.indexOf(id) !== -1).sort();
  const independenceEligible = overlapping.length === 0;

  const assessmentDateValid = ISO_DATE_RE.test(pp.assessment_date);
  const deadlineValid = ISO_DATE_RE.test(pp.attestation_deadline);
  const dateEligible = assessmentDateValid && deadlineValid && pp.assessment_date <= pp.attestation_deadline;

  let failingPredicate = null;
  if (!routeEligible) failingPredicate = 'assessment_route_not_permitted_for_architecture_type';
  else if (!certEligible) failingPredicate = 'assessor_certification_requirement_not_met';
  else if (!independenceEligible) failingPredicate = 'identity_overlap:' + overlapping.join(',');
  else if (!dateEligible) failingPredicate = 'assessment_date_after_deadline_or_invalid_format';

  const eligible = routeEligible && certEligible && independenceEligible && dateEligible;

  const output_payload = {
    architecture_type: pp.architecture_type,
    assessment_route: pp.assessment_route,
    route_eligible: routeEligible,
    cert_eligible: certEligible,
    independence_eligible: independenceEligible,
    date_eligible: dateEligible,
    overlapping_identities: overlapping,
    assessment_date: pp.assessment_date,
    attestation_deadline: pp.attestation_deadline,
    eligible,
    failing_predicate: failingPredicate,
  };

  const compliance_flags = [eligible ? 'ASSESSOR_INDEPENDENCE_ELIGIBLE' : 'ASSESSOR_INDEPENDENCE_INELIGIBLE'];

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
