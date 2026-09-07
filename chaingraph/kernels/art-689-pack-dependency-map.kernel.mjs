import { executionHash } from './_hash.mjs';

// art-689-pack-dependency-map — Pack Dependency Map.
// Deterministic impact-mapping kernel over CALLER-DECLARED pack->component usage
// lists: given the declared packs (each with the components it uses) and a changed
// component, it emits the set of impacted packs, the impact count, a trace restating
// the membership arithmetic, and an overall verdict (IMPACT_MAPPED when at least one
// declared pack uses the changed component; NO_IMPACT when none does). The verdict
// describes the declared declarations ONLY — it is a static membership computation
// over synthetic inputs, never an observation of any real repository, registry, or
// build system. Zero storage, zero network, no runtime clock (any as-of is a
// caller-declared input). All inputs are synthetic per the PII banner.
//
// DEPTH SEMANTICS: every impacted pack is a DIRECT (depth-1) consumer — the kernel
// maps membership in the declared usage lists, one hop, and says so in the trace.
// No transitive closure is computed and none is claimed.
//
// ROUNDING: impact_count is a member count over declared lists — an exact integer.
// No floating-point rounding applies to any output member; there is nothing here to
// round at 2dp half-up, and the kernel invents no number it was not given.
//
// DETERMINISM: compute() is a PURE function of pp — no Date.now()/Math.random(),
// no network, no filesystem. It runs unmodified inside the QuickJS-ng zkVM guest,
// which is a STRICT SUBSET of a browser/Node global environment.

const TOOL_ID = 'art-689-pack-dependency-map';
const TOOL_VERSION = '1.0.0';

export const meta = {
  tool_id: TOOL_ID, tool_version: TOOL_VERSION,
  mcp_name: 'compute_pack_dependency_map',
  mandate_type: 'compliance_control', gpu: false,
};

function isNonEmptyString(v) {
  return typeof v === 'string' && v.trim().length > 0;
}

/**
 * compute(pp) — pure decision kernel.
 * Declared inputs:
 *   packs              (required, non-empty array) caller-declared usage lists; each
 *                      element { pack: string, uses: string[] } — `uses` holds the
 *                      component identifiers the pack declares (duplicates inside one
 *                      list are rejected so the count stays exact)
 *   changed_component  (required, non-empty string) the component whose change is
 *                      being impact-mapped
 * @param {object} pp policy_parameters
 * @returns {{ output_payload: object, compliance_flags: string[] }}
 */
export function compute(pp) {
  pp = pp || {};
  const flags = [];

  const packs = pp.packs;
  if (!Array.isArray(packs) || packs.length === 0) {
    flags.push('PDM_ERROR');
    throw new TypeError('packs must be supplied as a non-empty array of declared { pack, uses } usage lists (synthetic declarations; never a real repository scan).');
  }
  const seenPackNames = new Set();
  for (const entry of packs) {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) {
      flags.push('PDM_ERROR');
      throw new TypeError('every element of packs must be an object with non-empty string pack and an array uses.');
    }
    if (!isNonEmptyString(entry.pack)) {
      flags.push('PDM_ERROR');
      throw new TypeError('every declared usage list must carry a non-empty string pack name.');
    }
    if (seenPackNames.has(entry.pack)) {
      flags.push('PDM_ERROR');
      throw new TypeError(`pack name "${entry.pack}" is declared more than once; declare each pack exactly once so the impact count stays exact.`);
    }
    seenPackNames.add(entry.pack);
    if (!Array.isArray(entry.uses)) {
      flags.push('PDM_ERROR');
      throw new TypeError(`the declared usage list for pack "${entry.pack}" must be an array of component identifier strings.`);
    }
    const seenComponents = new Set();
    for (const c of entry.uses) {
      if (!isNonEmptyString(c)) {
        flags.push('PDM_ERROR');
        throw new TypeError(`the declared usage list for pack "${entry.pack}" contains a component that is not a non-empty string.`);
      }
      if (seenComponents.has(c)) {
        flags.push('PDM_ERROR');
        throw new TypeError(`pack "${entry.pack}" declares component "${c}" more than once; a usage list declares each component once.`);
      }
      seenComponents.add(c);
    }
  }

  const changedComponent = pp.changed_component;
  if (!isNonEmptyString(changedComponent)) {
    flags.push('PDM_ERROR');
    throw new TypeError('changed_component must be supplied as a non-empty string.');
  }

  // The named rule: a pack is impacted iff its DECLARED usage list contains the
  // changed component. Direct (depth-1) membership only, in declared pack order.
  const impacted = [];
  for (const entry of packs) {
    if (entry.uses.includes(changedComponent)) impacted.push(entry.pack);
  }
  const impactCount = impacted.length;

  // Trace restates the membership count in words, exactly as declared.
  const trace = impactCount === 0
    ? `${changedComponent} does not appear in any declared usage list`
    : impactCount === 1
      ? `${changedComponent} appears in one declared usage list`
      : impactCount === 2
        ? `${changedComponent} appears in both declared usage lists`
        : `${changedComponent} appears in all ${impactCount} declared usage lists`;

  const overall = impactCount > 0 ? 'IMPACT_MAPPED' : 'NO_IMPACT';

  const output_payload = {
    impacted,
    impact_count: impactCount,
    trace,
    overall,
  };

  return { output_payload, compliance_flags: flags };
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
