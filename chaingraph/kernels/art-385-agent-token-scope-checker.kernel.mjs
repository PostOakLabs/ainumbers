// art-385 — Agent Token Scope Checker: pure decision kernel.
// Verify-only: compares a requested agent action against a token/mandate's
// declared scope (spend cap, currency, MCC allow-list, expiry) and, if an
// attenuation chain of ancestor tokens is supplied, checks that each link
// narrows (never widens) relative to its parent. Returns an in/out-of-scope
// verdict + receipt. NEVER authorizes, blocks, or executes anything.
//
// Pure: no DOM, no window, no network, no Date.now(), no randomness.
// requested_at is caller-supplied (ISO 8601) so the hash is reproducible.
//
// AI-1 verify-first check (2026-07-18) found per-protocol mandate/receipt
// verification already covered by shipped kernels (art-01 mandate-chain,
// art-26/31/61/62 x402/AP2). This kernel does a DIFFERENT job: a scope
// comparison of one requested action against one token's bounds, plus
// delegation-chain narrowing — not covered by any of those.
//
// ATTENUATION VOCABULARY NOTE: OCG §22.10 / ATTEN-1 (normative attenuation-
// chain vocabulary) has not landed — it is SPEC-TICK material per Standing
// Order #22, not a build. This kernel implements attenuation-chain checking
// against the plain array-of-tokens structure below (root-first, ending
// at the token being used) rather than any not-yet-defined §22.10 shape.
// When ATTEN-1 lands, a later WU can re-express this input against the
// normative vocabulary; the narrowing logic itself does not change.

import { executionHash } from './_hash.mjs';

const TOOL_ID = 'art-385-agent-token-scope-checker';
const TOOL_VERSION = '1.0.0';

function mccAllowed(mcc, allowedMccs) {
  if (!Array.isArray(allowedMccs) || allowedMccs.length === 0) return true; // unrestricted
  return allowedMccs.includes(mcc);
}

function mccSubsetOrEqual(childMccs, parentMccs) {
  const parentUnrestricted = !Array.isArray(parentMccs) || parentMccs.length === 0;
  const childUnrestricted = !Array.isArray(childMccs) || childMccs.length === 0;
  if (parentUnrestricted) return true; // parent has no restriction to narrow from
  if (childUnrestricted) return false; // child would be WIDER than a restricted parent
  return childMccs.every((m) => parentMccs.includes(m));
}

/**
 * Pure compute. Throws on missing required inputs (caller maps to an MCP error).
 * @param {object} pp policy_parameters: { requested_action, token, attenuation_chain? }
 * @returns {{ output_payload:object, compliance_flags:string[], verdict:string, checks:object[] }}
 */
export function compute(pp) {
  const { requested_action, token } = pp;
  const attenuation_chain = Array.isArray(pp.attenuation_chain) ? pp.attenuation_chain : [];
  if (!requested_action) throw new Error('policy_parameters.requested_action is required.');
  if (!token) throw new Error('policy_parameters.token is required.');
  if (!requested_action.requested_at) throw new Error('policy_parameters.requested_action.requested_at (ISO 8601) is required for a reproducible hash.');
  const requestedAt = new Date(requested_action.requested_at);
  if (isNaN(requestedAt.getTime())) throw new Error('policy_parameters.requested_action.requested_at is not a valid ISO timestamp.');

  const checks = [];

  /* 1. TOKEN EXPIRY */
  let expiryOk = true; let expiryDetail;
  if (!token.expires_at) { expiryOk = false; expiryDetail = 'token.expires_at is missing.'; }
  else {
    const exp = new Date(token.expires_at);
    if (isNaN(exp.getTime())) { expiryOk = false; expiryDetail = `token.expires_at "${token.expires_at}" is not a valid ISO timestamp.`; }
    else if (exp <= requestedAt) { expiryOk = false; expiryDetail = `Token EXPIRED — expires_at ${token.expires_at} ≤ requested_at ${requestedAt.toISOString()}.`; }
    else expiryDetail = `Token valid until ${token.expires_at} (${Math.round((exp - requestedAt) / 60000)} min remaining).`;
  }
  checks.push({ id: 'expiry', name: 'Token expiry', status: expiryOk ? 'pass' : 'fail', detail: expiryDetail });

  /* 2. CURRENCY MATCH */
  const currencyOk = !token.currency || !requested_action.currency || token.currency === requested_action.currency;
  checks.push({ id: 'currency', name: 'Currency match', status: currencyOk ? 'pass' : 'fail',
    detail: currencyOk ? `Currency "${requested_action.currency || token.currency || '–'}" consistent.` : `Requested currency "${requested_action.currency}" ≠ token currency "${token.currency}".` });

  /* 3. AMOUNT CAP */
  let amountOk = true; let amountDetail = 'No max_amount cap set on token — informational.';
  if (token.max_amount != null) {
    const amt = Number(requested_action.amount);
    if (!Number.isFinite(amt)) { amountOk = false; amountDetail = 'requested_action.amount is not a finite number.'; }
    else if (amt > token.max_amount) { amountOk = false; amountDetail = `Requested amount ${amt} exceeds token max_amount ${token.max_amount} (over by ${(amt - token.max_amount).toFixed(2)}).`; }
    else amountDetail = `Requested amount ${amt} ≤ token max_amount ${token.max_amount} ✓.`;
  }
  checks.push({ id: 'amount_cap', name: 'Spend cap', status: amountOk ? 'pass' : 'fail', detail: amountDetail });

  /* 4. MERCHANT CATEGORY (MCC) SCOPE */
  const mccOk = mccAllowed(requested_action.mcc, token.allowed_mccs);
  checks.push({ id: 'mcc', name: 'Merchant category scope', status: mccOk ? 'pass' : 'fail',
    detail: mccOk ? (Array.isArray(token.allowed_mccs) && token.allowed_mccs.length ? `MCC "${requested_action.mcc}" ✓ in allow-list.` : 'No MCC restriction on token — informational.') : `MCC "${requested_action.mcc}" not in token allowed_mccs [${(token.allowed_mccs || []).join(', ')}].` });

  /* 5. ATTENUATION CHAIN NARROWING (only if a delegation chain was supplied) */
  if (attenuation_chain.length > 0) {
    const fullChain = [...attenuation_chain, token]; // root-first, leaf last
    let chainOk = true; const chainDetails = [];
    for (let i = 1; i < fullChain.length; i++) {
      const parent = fullChain[i - 1];
      const child = fullChain[i];
      const linkLabel = `link ${i} (${parent.token_id || 'parent'} → ${child.token_id || 'child'})`;
      if (child.currency && parent.currency && child.currency !== parent.currency) { chainOk = false; chainDetails.push(`${linkLabel}: currency changed "${parent.currency}"→"${child.currency}".`); }
      if (parent.max_amount != null && child.max_amount != null && child.max_amount > parent.max_amount) { chainOk = false; chainDetails.push(`${linkLabel}: max_amount WIDENED ${parent.max_amount}→${child.max_amount}.`); }
      if (parent.expires_at && child.expires_at && new Date(child.expires_at) > new Date(parent.expires_at)) { chainOk = false; chainDetails.push(`${linkLabel}: expires_at WIDENED ${parent.expires_at}→${child.expires_at}.`); }
      if (!mccSubsetOrEqual(child.allowed_mccs, parent.allowed_mccs)) { chainOk = false; chainDetails.push(`${linkLabel}: allowed_mccs WIDENED (child not a subset of parent).`); }
    }
    if (chainOk) chainDetails.push(`All ${fullChain.length - 1} attenuation link(s) narrow or hold scope — no widening detected.`);
    checks.push({ id: 'attenuation', name: 'Attenuation chain narrowing', status: chainOk ? 'pass' : 'fail', detail: chainDetails.join(' ') });
  } else {
    checks.push({ id: 'attenuation', name: 'Attenuation chain narrowing', status: 'skip', detail: 'No attenuation_chain supplied — token treated as a root-issued token.' });
  }

  /* OVERALL — fail-closed: any failing check ⇒ OUT_OF_SCOPE */
  const failing = checks.filter((c) => c.status === 'fail');
  const verdict = failing.length > 0 ? 'OUT_OF_SCOPE' : 'IN_SCOPE';

  const output_payload = {
    verdict,
    checks_run: checks.length,
    failing_checks: failing.map((c) => ({ id: c.id, detail: c.detail.slice(0, 200) })),
    token_id: token.token_id ?? null,
    attenuation_depth: attenuation_chain.length,
    enforcement: 'none', // pure evaluation — this kernel never blocks, authorizes, or executes
  };

  const compliance_flags = ['AGENT_TOKEN_SCOPE_ASSESSED'];
  compliance_flags.push(verdict === 'IN_SCOPE' ? 'TOKEN_SCOPE_IN_SCOPE' : 'TOKEN_SCOPE_OUT_OF_SCOPE');
  failing.forEach((c) => compliance_flags.push(`SCOPE_VIOLATION_${c.id.toUpperCase()}`));

  return { output_payload, compliance_flags, verdict, checks };
}

// Build the full v0.4 artifact envelope, hash included. `now` and chain wiring
// are injected by the caller so the kernel stays pure (timestamps are framing,
// outside the hash preimage).
export async function buildArtifact(pp, { now, parent_hashes = [], parent_tool_ids = [], chain_depth = 0 } = {}) {
  const { output_payload, compliance_flags } = compute(pp);
  const execution_hash = await executionHash(pp, output_payload);
  return {
    '@context': 'https://ainumbers.co/chaingraph/context/v0.3/context.jsonld',
    chaingraph_version: '0.4.0',
    mandate_type: 'compliance_mandate',
    tool_id: TOOL_ID,
    tool_version: TOOL_VERSION,
    generated_at: now ?? null,
    execution_hash,
    chain: { parent_hashes, parent_tool_ids, chain_depth },
    policy_parameters: pp,
    output_payload,
    compliance_flags,
    compute_mode: 'server',
    audit_signature: { payloadType: 'application/vnd.openchain.graph+json;version=0.4', payload: '', signatures: [] },
  };
}

export const meta = { tool_id: TOOL_ID, tool_version: TOOL_VERSION, gpu: false, mandate_type: 'compliance_mandate', mcp_name: 'check_agent_token_scope' };
