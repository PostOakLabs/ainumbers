/**
 * art-565-kya-x402-scope-verifier.kernel.mjs
 * NEXTSUGG-WAVE-BUILD-SPEC.md §3 -- KYA credential x x402 payload scope
 * cross-check.
 *
 * MANDATE. KYA (Know Your Agent) is a credential type Skyfire has published
 * (docs.skyfire.xyz/docs/kya.md, docs.skyfire.xyz/docs/token-schemas.md,
 * docs.skyfire.xyz/docs/common-token-claims.md, pinned 2026-08-06) and x402
 * is a live HTTP-402 payment scheme (see art-26 / tools/277). This kernel
 * cross-checks a declared KYA-shaped credential's scope against a declared
 * x402 PaymentPayload, never fetches either, and never contacts Skyfire or
 * any facilitator.
 *
 * CREDENTIAL SHAPE (pinned). Skyfire's common-token-claims.md documents
 * `sub` (buyer agent id), `aud` (seller agent id, audience binding), `ssi`
 * (seller service id), `sdm` (seller domain), `iss`, `iat`, `exp`, `env`,
 * `btg`, `jti`. token-schemas.md documents `amt`/`cur`/`val` spend fields on
 * kya-pay tokens. ⛔ Skyfire's published docs, as pinned 2026-08-06, do NOT
 * enumerate an explicit network-allowlist array, asset-allowlist array, or a
 * multi-entry payee-allowlist array claim -- this kernel layers
 * `allowed_networks`, `allowed_assets`, `payee_allowlist`, and `scope` on
 * top of the documented `aud`/`ssi`/`sdm` claims as THIS TOOL's own scope
 * representation, clearly distinguished below from the documented claims.
 * This is a scope cross-check only: NO signature verification is performed
 * or claimed, because the pinned docs do not specify a caller-reproducible
 * signing scheme for a KYA token in this context.
 *
 * X402 PAYLOAD SHAPE. Reuses tools/277's PaymentPayload vocabulary:
 * {x402Version, scheme, network, payload:{authorization:{from,to,value,
 * validAfter,validBefore,nonce}, signature}}. `value` and the authorization
 * timestamps are declared as strings (smallest-unit integer / unix seconds)
 * so no float arithmetic touches the amount comparison.
 *
 * VERDICT. IN_SCOPE (every check passes), OUT_OF_SCOPE (a check the
 * credential CAN evaluate fails), or INDETERMINATE (the credential omits a
 * claim the payload requires -- never guessed, always named in
 * indeterminate_reasons).
 *
 * §25 (PII). Agent/credential ids and a payment payload carry no natural-
 * person name/account/identity field as declared here -- §25 does not apply.
 *
 * §18. Ships compute_proof_ready:"deferred" -- new shard, awaiting the async
 * GPU proving queue (S18 steady-state); NEXTSUGG-PROVE-1 batch-proves this
 * and its two sibling shards. This row does not bump any §18 baseline.
 *
 * NO CLOCK. All timestamps are caller-declared inputs; compute() never reads
 * a clock. Zero network, zero randomness.
 *
 * Spec: NEXTSUGG-WAVE-BUILD-SPEC.md §3.
 */
import { executionHash } from './_hash.mjs';

const TOOL_ID = 'art-565-kya-x402-scope-verifier';
const TOOL_VERSION = '1.0.0';
export const meta = { tool_id: TOOL_ID, tool_version: TOOL_VERSION, mcp_name: 'verify_kya_x402_scope', mandate_type: 'compliance_mandate', gpu: false };

const KYA_CLAIM_BASIS = 'Skyfire kya-pay token claims (docs.skyfire.xyz/docs/common-token-claims.md, /docs/token-schemas.md, pinned 2026-08-06): documented sub/aud/ssi/sdm/iss/iat/exp/env/amt/cur/val. allowed_networks/allowed_assets/payee_allowlist/scope are this tool\'s own scope-representation extension, not documented Skyfire claims -- stated here so the distinction is never implied as pinned.';

function nonEmptyStringOrNull(v) { return typeof v === 'string' && v.length > 0 ? v : null; }
function stringArrayOrNull(v) { return Array.isArray(v) && v.every((x) => typeof x === 'string') ? v : null; }
function unsignedIntStringOrNull(v) { return typeof v === 'string' && /^\d+$/.test(v) ? v : null; }
function unixSecondsOrNull(v) {
  if (typeof v === 'number' && Number.isFinite(v) && Number.isSafeInteger(v) && v >= 0) return v;
  if (typeof v === 'string' && /^\d+$/.test(v)) { const n = Number(v); return Number.isSafeInteger(n) ? n : null; }
  return null;
}
function cmpUnsignedIntStrings(a, b) {
  // returns -1/0/1 for a<b / a==b / a>b, both digit-only strings, no BigInt needed for gate (compare length then lexical)
  const na = a.replace(/^0+(?=\d)/, ''); const nb = b.replace(/^0+(?=\d)/, '');
  if (na.length !== nb.length) return na.length < nb.length ? -1 : 1;
  if (na === nb) return 0;
  return na < nb ? -1 : 1;
}
function caseInsensitiveIncludes(arr, v) {
  if (!Array.isArray(arr) || typeof v !== 'string') return false;
  const lv = v.toLowerCase();
  return arr.some((x) => typeof x === 'string' && x.toLowerCase() === lv);
}

export function compute(pp) {
  pp = pp || {};
  const rejected_inputs = [];
  const indeterminate_reasons = [];
  const findings = [];

  const cred = (pp.kya_credential && typeof pp.kya_credential === 'object') ? pp.kya_credential : null;
  const pay = (pp.x402_payload && typeof pp.x402_payload === 'object') ? pp.x402_payload : null;
  if (!cred) rejected_inputs.push({ where: 'kya_credential', reason: 'absent or not an object', supplied: pp.kya_credential === undefined ? null : pp.kya_credential });
  if (!pay) rejected_inputs.push({ where: 'x402_payload', reason: 'absent or not an object', supplied: pp.x402_payload === undefined ? null : pp.x402_payload });

  const inputs_insufficient = rejected_inputs.length > 0;

  // -- credential fields (declared, no defaults invented) --
  const cred_sub = inputs_insufficient ? null : nonEmptyStringOrNull(cred.sub);
  const cred_aud = inputs_insufficient ? null : nonEmptyStringOrNull(cred.aud);
  const cred_ssi = inputs_insufficient ? null : nonEmptyStringOrNull(cred.ssi);
  const cred_iat = inputs_insufficient ? null : unixSecondsOrNull(cred.iat);
  const cred_exp = inputs_insufficient ? null : unixSecondsOrNull(cred.exp);
  const cred_spend_cap_amt = inputs_insufficient ? null : unsignedIntStringOrNull(cred.spend_cap_amt);
  const cred_allowed_networks = inputs_insufficient ? null : stringArrayOrNull(cred.allowed_networks);
  const cred_allowed_assets = inputs_insufficient ? null : stringArrayOrNull(cred.allowed_assets);
  const cred_payee_allowlist = inputs_insufficient ? null : stringArrayOrNull(cred.payee_allowlist);
  const cred_scope = inputs_insufficient ? null : stringArrayOrNull(cred.scope);

  // -- payload fields (tools/277 PaymentPayload vocabulary) --
  const pay_scheme = inputs_insufficient ? null : nonEmptyStringOrNull(pay.scheme);
  const pay_network = inputs_insufficient ? null : nonEmptyStringOrNull(pay.network);
  const auth = inputs_insufficient ? null : (pay.payload && typeof pay.payload === 'object' ? pay.payload.authorization : null);
  const pay_asset = inputs_insufficient ? null : nonEmptyStringOrNull(pay.asset);
  const pay_to = inputs_insufficient ? null : (auth && typeof auth === 'object' ? nonEmptyStringOrNull(auth.to) : null);
  const pay_value = inputs_insufficient ? null : (auth && typeof auth === 'object' ? unsignedIntStringOrNull(auth.value) : null);
  const pay_valid_after = inputs_insufficient ? null : (auth && typeof auth === 'object' ? unixSecondsOrNull(auth.validAfter) : null);
  const pay_valid_before = inputs_insufficient ? null : (auth && typeof auth === 'object' ? unixSecondsOrNull(auth.validBefore) : null);

  let out_of_scope = false;

  if (!inputs_insufficient) {
    // 1. amount vs spend cap
    if (cred_spend_cap_amt === null) {
      indeterminate_reasons.push('credential omits spend_cap_amt -- cannot check payload amount against a spend cap.');
    } else if (pay_value === null) {
      indeterminate_reasons.push('payload omits payload.authorization.value -- cannot check it against the credential spend cap.');
    } else {
      const within = cmpUnsignedIntStrings(pay_value, cred_spend_cap_amt) <= 0;
      findings.push({ check: 'amount_vs_spend_cap', pass: within, detail: `payload value ${pay_value} vs credential spend_cap_amt ${cred_spend_cap_amt}` });
      if (!within) out_of_scope = true;
    }

    // 2. asset/network vs allowed set
    if (cred_allowed_networks === null || cred_allowed_assets === null) {
      indeterminate_reasons.push('credential omits allowed_networks and/or allowed_assets -- cannot check payload network/asset against an allowed set.');
    } else if (pay_network === null || pay_asset === null) {
      indeterminate_reasons.push('payload omits network and/or asset -- cannot check against the credential allowed set.');
    } else {
      const netOk = caseInsensitiveIncludes(cred_allowed_networks, pay_network);
      const assetOk = caseInsensitiveIncludes(cred_allowed_assets, pay_asset);
      findings.push({ check: 'network_vs_allowed_set', pass: netOk, detail: `payload network "${pay_network}" vs credential allowed_networks ${JSON.stringify(cred_allowed_networks)}` });
      findings.push({ check: 'asset_vs_allowed_set', pass: assetOk, detail: `payload asset "${pay_asset}" vs credential allowed_assets ${JSON.stringify(cred_allowed_assets)}` });
      if (!netOk || !assetOk) out_of_scope = true;
    }

    // 3. payee vs merchant allowlist
    if (cred_payee_allowlist === null) {
      indeterminate_reasons.push('credential omits payee_allowlist -- cannot check payload payee against a merchant allowlist.');
    } else if (pay_to === null) {
      indeterminate_reasons.push('payload omits payload.authorization.to -- cannot check it against the credential payee allowlist.');
    } else {
      const payeeOk = caseInsensitiveIncludes(cred_payee_allowlist, pay_to);
      findings.push({ check: 'payee_vs_merchant_allowlist', pass: payeeOk, detail: `payload payee "${pay_to}" vs credential payee_allowlist ${JSON.stringify(cred_payee_allowlist)}` });
      if (!payeeOk) out_of_scope = true;
    }

    // 4. validity window vs payload timestamp
    if (cred_iat === null || cred_exp === null) {
      indeterminate_reasons.push('credential omits iat and/or exp -- cannot check the payload timestamps against a validity window.');
    } else if (pay_valid_after === null || pay_valid_before === null) {
      indeterminate_reasons.push('payload omits payload.authorization.validAfter and/or validBefore -- cannot check against the credential validity window.');
    } else {
      const windowOk = pay_valid_after >= cred_iat && pay_valid_before <= cred_exp;
      findings.push({ check: 'validity_window_vs_payload_timestamp', pass: windowOk, detail: `payload window [${pay_valid_after}, ${pay_valid_before}] vs credential window [${cred_iat}, ${cred_exp}]` });
      if (!windowOk) out_of_scope = true;
    }

    // 5. scope string coverage
    if (cred_scope === null) {
      indeterminate_reasons.push('credential omits scope -- cannot check scope-string coverage for this payment scheme.');
    } else if (pay_scheme === null) {
      indeterminate_reasons.push('payload omits scheme -- cannot check it against the credential scope strings.');
    } else {
      const needle = `payments:x402:${pay_scheme}`;
      const covered = cred_scope.includes(needle) || cred_scope.includes('payments:x402:*') || cred_scope.includes('payments:*');
      findings.push({ check: 'scope_string_coverage', pass: covered, detail: `payload scheme "${pay_scheme}" needs scope "${needle}" (or a wildcard) in credential scope ${JSON.stringify(cred_scope)}` });
      if (!covered) out_of_scope = true;
    }
  }

  let verdict;
  if (inputs_insufficient) verdict = 'INDETERMINATE';
  else if (out_of_scope) verdict = 'OUT_OF_SCOPE';
  else if (indeterminate_reasons.length > 0) verdict = 'INDETERMINATE';
  else verdict = 'IN_SCOPE';

  const compliance_flags = [`KYA_X402_${verdict}`];

  const rationale = [];
  if (inputs_insufficient) {
    rationale.push('One or both of kya_credential / x402_payload is absent or malformed; see rejected_inputs. No scope cross-check can run without both declared objects.');
  } else {
    rationale.push(`Ran ${findings.length} evaluable check(s) (amount vs spend cap, network vs allowed set, asset vs allowed set, payee vs merchant allowlist, validity window vs payload timestamp, scope string coverage); ${indeterminate_reasons.length} check(s) could not run because the credential omitted a claim the payload requires.`);
    for (const f of findings) rationale.push(`${f.check}: ${f.pass ? 'PASS' : 'FAIL'} -- ${f.detail}`);
    for (const r of indeterminate_reasons) rationale.push(`INDETERMINATE: ${r}`);
  }
  rationale.push('Verify-only: this kernel never initiates, signs, or settles an x402 payment (x402 EXECUTION is a KILLED ledger row). It performs no signature verification -- the pinned Skyfire docs (2026-08-06) do not specify a caller-reproducible KYA signing scheme in this context, so this is a scope cross-check only.');
  rationale.push(KYA_CLAIM_BASIS);

  const output_payload = {
    verdict,
    findings,
    indeterminate_reasons,
    credential_subject: cred_sub,
    credential_audience: cred_aud,
    credential_seller_service_id: cred_ssi,
    payload_scheme: pay_scheme,
    payload_network: pay_network,
    kya_claim_basis: KYA_CLAIM_BASIS,
    rejected_inputs,
    rationale,
    note: 'Cross-checks a declared KYA-shaped credential\'s scope (spend cap, allowed networks/assets, payee allowlist, validity window, scope strings) against a declared x402 PaymentPayload. Never fetches either, never contacts Skyfire or a facilitator, never verifies a signature, never initiates or settles a payment.',
  };

  return { output_payload, compliance_flags };
}

export async function buildArtifact(pp, { now, parent_hashes = [], parent_tool_ids = [], chain_depth = 0 } = {}) {
  const { output_payload, compliance_flags } = compute(pp);
  const hash = await executionHash(pp, output_payload);
  return {
    '@context': 'https://ainumbers.co/chaingraph/context/v0.3/context.jsonld',
    chaingraph_version: '0.4.0', mandate_type: meta.mandate_type,
    tool_id: TOOL_ID, tool_version: TOOL_VERSION, generated_at: now ?? null, execution_hash: hash,
    chain: { parent_hashes, parent_tool_ids, chain_depth },
    policy_parameters: pp, output_payload, compliance_flags, compute_mode: 'server',
    compute_proof_ready: 'deferred',
    audit_signature: { payloadType: 'application/vnd.openchain.graph+json;version=0.4', payload: '', signatures: [] },
  };
}
