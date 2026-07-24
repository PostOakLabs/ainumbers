import { executionHash } from './_hash.mjs';

const TOOL_ID = 'art-465-workpaper-bundle-composer';
const TOOL_VERSION = '1.0.0';

export const meta = {
  tool_id: TOOL_ID, tool_version: TOOL_VERSION,
  mcp_name: 'compose_workpaper_bundle',
  mandate_type: 'attestation_mandate', gpu: false,
};

// Terminal composer for the substantive-procedure-cycle chain. Assembles a
// per-audit-area evidence bundle from caller-declared inputs: the procedure
// identifier, a population hash (computed upstream, declared here, not
// recomputed), the prior kernels' execution-hash artifacts (art-462/463/464
// or any other substantive-procedure kernel), an exception list with
// disposition inputs, and three declared sign-off roles (preparer, reviewer,
// partner). This node re-expresses those declarations into one bundle and
// mints no new judgment: it does not re-run upstream kernels, does not
// recompute the population hash, and does not decide whether an exception is
// resolved -- only whether a disposition was declared for it. Exception
// disposition is recorded as an approval record with a reason_code, never a
// silent close. Partner release is single-signer but always tagged
// gate_status "review_required" per §27 Human Accountability vocabulary --
// this node records that a release occurred, it does not enforce
// countersignature. Pure ECMA-262 arithmetic only -- no Date, no
// Math.random. NaN-safe.

function s(v) { return String(v == null ? '' : v).trim(); }
function arr(v) { return Array.isArray(v) ? v : []; }

function sanitizeRole(r) {
  const role = s(r && r.role);
  const statement = s(r && r.statement);
  return { role, statement, declared: Boolean(role && statement) };
}

export function compute(pp) {
  pp = pp || {};

  const procedure_id = s(pp.procedure_id);
  const population_hash = s(pp.population_hash);

  const malformed_kernel_artifacts = [];
  const kernel_artifacts = [];
  for (const a of arr(pp.kernel_artifacts)) {
    const tool_id = s(a && a.tool_id);
    const execution_hash = s(a && a.execution_hash);
    if (!tool_id || !execution_hash) {
      malformed_kernel_artifacts.push({ tool_id: tool_id || null, execution_hash: execution_hash || null, reason: !tool_id ? 'MISSING_TOOL_ID' : 'MISSING_EXECUTION_HASH' });
      continue;
    }
    kernel_artifacts.push({ tool_id, execution_hash });
  }

  const exceptions = [];
  const undisposed_exceptions = [];
  for (const e of arr(pp.exceptions)) {
    const item_id = s(e && e.item_id);
    if (!item_id) continue;
    const reason_code = s(e && e.reason_code);
    const disposition = s(e && e.disposition);
    const disposed_by_role = s(e && e.disposed_by_role);
    exceptions.push({ item_id, reason_code, disposition, disposed_by_role });
    if (!disposition) undisposed_exceptions.push(item_id);
  }
  const disposed_exception_count = exceptions.length - undisposed_exceptions.length;

  const preparer = sanitizeRole(pp.preparer);
  const reviewer = sanitizeRole(pp.reviewer);
  const partner = sanitizeRole(pp.partner);

  const compliance_flags = ['WORKPAPER_BUNDLE_COMPOSED'];
  if (!procedure_id) compliance_flags.push('WORKPAPER_BUNDLE_MISSING_PROCEDURE_ID');
  if (!population_hash) compliance_flags.push('WORKPAPER_BUNDLE_MISSING_POPULATION_HASH');
  if (kernel_artifacts.length === 0) compliance_flags.push('WORKPAPER_BUNDLE_NO_KERNEL_ARTIFACTS');
  if (malformed_kernel_artifacts.length > 0) compliance_flags.push('WORKPAPER_BUNDLE_MALFORMED_ARTIFACT');
  if (undisposed_exceptions.length > 0) compliance_flags.push('WORKPAPER_BUNDLE_UNDISPOSED_EXCEPTION');
  if (exceptions.length > 0 && undisposed_exceptions.length === 0) compliance_flags.push('WORKPAPER_BUNDLE_ALL_EXCEPTIONS_DISPOSED');
  if (!preparer.declared || !reviewer.declared || !partner.declared) compliance_flags.push('WORKPAPER_BUNDLE_MISSING_ROLE_STATEMENT');
  if (partner.declared) compliance_flags.push('WORKPAPER_BUNDLE_PARTNER_RELEASE_RECORDED');

  return {
    output_payload: {
      procedure_id: procedure_id || null,
      population_hash: population_hash || null,
      kernel_artifact_count: kernel_artifacts.length,
      kernel_artifacts,
      malformed_kernel_artifacts,
      exception_count: exceptions.length,
      disposed_exception_count,
      undisposed_exceptions,
      exceptions,
      roles: {
        preparer,
        reviewer,
        partner: { ...partner, gate_status: 'review_required' },
      },
    },
    compliance_flags,
  };
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
