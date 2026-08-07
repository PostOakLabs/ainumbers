import { executionHash } from './_hash.mjs';

const TOOL_ID = 'art-585-sanctions-screening-evidence-pack';
const TOOL_VERSION = '1.0.0';

export const meta = {
  tool_id: TOOL_ID,
  tool_version: TOOL_VERSION,
  mcp_name: 'build_sanctions_screening_evidence_pack',
  mandate_type: 'compliance_mandate',
  gpu: false,
};

// Sanctions-screening evidence pack (art-585). A screening decision (query, match results,
// thresholds) is only reproducible evidence if it is bound to the EXACT dataset version and
// digest it was run against -- a decision record that names a dataset by name alone ("OFAC
// SDN") cannot later prove which day's list it actually checked. This kernel never fetches or
// verifies against a live list (zero network, per SPEC); it binds a caller-declared screening
// decision to a caller-declared dataset_ref by comparing a caller-supplied computed digest
// against the caller-declared published digest for that dataset version.
//
// Generic dataset_ref shape -- works with ANY versioned list source (checksum + version string
// + dataset identifier). OpenSanctions' immutable version-pinned artifact paths
// (/artifacts/<dataset>/<version>/, effective 2026-08-17) are the worked example only, never a
// dependency: https://www.opensanctions.org/docs/bulk/ , https://www.opensanctions.org/docs/bulk/faq/
//
// Proves process REPRODUCIBILITY (this decision ran against this exact byte-identical dataset
// version), never screening ADEQUACY (whether the list/thresholds/matching logic were any good --
// that is the screening provider's problem, not this node's).
//
// Deterministic comparison arithmetic only -- no clock, no network, no PII (query is a synthetic
// input per the PII banner, never a real name).

function s(v) { return String(v == null ? '' : v).trim(); }
function normDigest(v) { return typeof v === 'string' ? v.trim().toLowerCase().replace(/^[a-z0-9]+:/, '') : ''; }

// hex length per algo, where known; unknown algos fall back to a generic hex sanity check so
// the kernel stays source-agnostic rather than OpenSanctions-specific.
const KNOWN_HEX_LEN = { sha1: 40, sha256: 64, sha512: 128, md5: 32 };

function digestWellFormed(algo, digest) {
  const d = normDigest(digest);
  if (!/^[0-9a-f]+$/.test(d)) return false;
  const want = KNOWN_HEX_LEN[s(algo).toLowerCase()];
  return want ? d.length === want : d.length >= 8;
}

export function compute(pp) {
  pp = pp || {};
  const screening = pp.screening || {};
  const dataset_ref = pp.dataset_ref || {};
  const caller_computed_digest_raw = pp.caller_computed_digest;

  const query = s(screening.query);
  const decision = s(screening.decision) || null;
  const match_count = Number.isFinite(Number(screening.match_count)) ? Number(screening.match_count) : null;

  const dataset_id = s(dataset_ref.dataset_id);
  const dataset_version = s(dataset_ref.version);
  const digest_algo = s(dataset_ref.digest_algo).toLowerCase();
  const published_digest = s(dataset_ref.published_digest);

  const dataset_ref_complete = !!dataset_id && !!dataset_version && !!digest_algo && !!published_digest;
  const published_digest_well_formed = dataset_ref_complete && digestWellFormed(digest_algo, published_digest);

  const compliance_flags = ['SANCTIONS_SCREENING_EVIDENCE_PACK_EVALUATED'];

  let verdict;
  let reason = null;
  let digest_match = null;
  const caller_computed_digest = typeof caller_computed_digest_raw === 'string' && caller_computed_digest_raw.trim() !== ''
    ? caller_computed_digest_raw.trim() : null;

  if (!dataset_ref_complete || !published_digest_well_formed) {
    verdict = 'INDETERMINATE';
    reason = !dataset_ref_complete ? 'dataset_ref_incomplete' : 'published_digest_malformed';
    compliance_flags.push('DATASET_REF_INCOMPLETE_OR_MALFORMED');
  } else if (!caller_computed_digest) {
    verdict = 'INDETERMINATE';
    reason = 'no_caller_computed_digest_declared';
    compliance_flags.push('NO_CALLER_COMPUTED_DIGEST');
  } else {
    digest_match = normDigest(caller_computed_digest) === normDigest(published_digest);
    verdict = digest_match ? 'BOUND' : 'UNBOUND';
    reason = digest_match ? null : 'digest_mismatch';
    compliance_flags.push(digest_match ? 'DATASET_DIGEST_BOUND' : 'DATASET_DIGEST_MISMATCH');
  }

  const evidence_pack = {
    dataset_id: dataset_id || null,
    dataset_version: dataset_version || null,
    digest_algo: digest_algo || null,
    published_digest: published_digest || null,
    caller_computed_digest,
    digest_match,
    screening_query: query || null,
    screening_decision: decision,
    screening_match_count: match_count,
    verdict,
    reason,
  };

  return {
    output_payload: { verdict, reason, evidence_pack },
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
