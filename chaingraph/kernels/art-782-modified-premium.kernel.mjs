import { executionHash } from './_hash.mjs';

const TOOL_ID = 'art-782-modified-premium';
const TOOL_VERSION = '1.0.0';

export const meta = {
  tool_id: TOOL_ID, tool_version: TOOL_VERSION,
  mcp_name: 'compute_modified_premium',
  mandate_type: 'compliance_mandate', gpu: false,
};

// Modified premium: the caller supplies a subject premium (total manual premium
// plus every premium item subject to experience rating) and an experience
// modification factor; the modified premium is their product. The experience
// modification itself is NOT computed here -- it is taken as given from the
// output of the experience-modification node in a chain, or supplied directly
// by the caller from their own experience rating worksheet.
//
// Rounding: modified premium is a premium, so the whole-dollars premium rule
// applies -- shown to the nearest dollar, a remainder of $0.50 or more rounds
// to the next higher dollar (half-up on non-negative dollars). Values are
// rounded to cents first to remove binary-float drift, then to whole dollars.
//
// The subject premium composition is the caller's responsibility: this kernel
// does not compute manual premium from payrolls and rates. It never vendors
// or reproduces NCCI or state rate tables; every licensed value is a caller
// input.
//
// Pure ECMA-262 arithmetic only -- no Math.pow, no Date.now/new Date(), no
// Math.random.

function r2(v) { return Math.round(v * 100) / 100; }
// Whole dollars, half-up (the "$0.50 or more rounds to the next higher
// dollar" rule); non-negative inputs only -- negative premiums are gated out
// before this is ever called.
function wholeDollars(v) { return Math.round(r2(v)); }

export function compute(pp) {
  pp = pp || {};

  const compliance_flags = [];
  // No Number() coercion on the raw inputs: Number(null) is 0 and Number('') is 0,
  // which would smuggle a null/empty mod through the gate as a valid 0 -- exactly the
  // value that must never yield a premium.
  const rawMod = pp.mod;
  const rawSubject = pp.subject_premium;

  const modFinite = Number.isFinite(rawMod);
  const subjectFinite = Number.isFinite(rawSubject);
  const subjectNegative = subjectFinite && rawSubject < 0;
  // A mod of exactly 0 (or negative) must NOT yield a modified premium: the
  // experience-modification node emits mod 0 with rating_class "undetermined"
  // and an EXPMOD_ZERO_DENOMINATOR flag when its denominator is not positive,
  // and a plain negativity check would let that through as a $0 premium.
  const modNonPositive = modFinite && rawMod <= 0;

  let modifiedPremium = null;
  if (!modFinite || !subjectFinite) {
    compliance_flags.push('INPUT_NOT_FINITE');
  } else if (subjectNegative) {
    compliance_flags.push('NEGATIVE_SUBJECT_PREMIUM');
  } else if (modNonPositive) {
    compliance_flags.push('NONPOSITIVE_MOD');
  } else {
    modifiedPremium = wholeDollars(rawSubject * rawMod);
  }

  const output_payload = {
    // null when any gate fires -- a flagged input never emits a premium.
    modified_premium: modifiedPremium,
    mod: modFinite ? rawMod : null,
    subject_premium: subjectFinite ? rawSubject : null,
    regulatory_basis: 'NCCI Basic Manual premium algorithm as published by the Indiana Compensation Rating Bureau (Premium Algorithms): add to manual premium all premium items subject to experience rating to get total subject premium, then apply the experience modification to arrive at the modified premium; premiums shown to the nearest dollar, a remainder of $0.50 or more rounded to the next higher dollar (WCRB Wisconsin Workers Compensation and Employers Liability Basic Manual, Whole Dollars - Premiums).',
    note: 'Subject premium composition is the caller\'s responsibility -- this kernel does not compute manual premium from payrolls and rates, and never vendors or reproduces NCCI or state rate tables. Out of scope: premium discount, expense constant, terrorism/catastrophe surcharges, state taxes, schedule rating and assigned-risk surcharge. The NCCI algorithm does not apply in the monopolistic state funds (Ohio, North Dakota, Washington, Wyoming) or the Puerto Rico and USVI funds.',
    gate: modifiedPremium === null ? 'flagged' : 'computed',
    // FLAG-MIRROR-DOCTRINE (AUTHORING-STANDARD.md §2.2): compute() raises flags
    // CONDITIONALLY (empty on success, INPUT_NOT_FINITE / NEGATIVE_SUBJECT_PREMIUM /
    // NONPOSITIVE_MOD on refusal), so output_payload mirrors them in the closed-list
    // `errors` member -- truthy exactly when the flags are present, so a §21.4 chain
    // gate can route on the payload alone.
    errors: compliance_flags.slice(),
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
