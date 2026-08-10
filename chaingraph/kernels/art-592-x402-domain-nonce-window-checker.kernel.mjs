import { executionHash } from './_hash.mjs';

// art-592 -- x402 Domain & Nonce Window Checker: pure decision kernel.
// SPEC-X402-CRYPTO-CORE-1-2026-08-09.md §6: the caller supplies BOTH (a) the domain fields
// actually baked into the EIP-712 signature under check (`chainId`/`verifyingContract`, the same
// names art-590 uses) and (b) the network/contract the caller EXPECTS this authorization to be
// valid against (`expected_chain_id`/`expected_verifying_contract`, mandatory `policy_parameters`,
// never defaulted or inferred from the signed fields -- defaulting them would make the domain
// check tautological and defeat the entire point of catching cross-domain replay). A mismatch on
// either is a hard REFUSE, never a soft warning (spec §6).
//
// Also checks the EIP-3009 replay-defense-adjacent fields against the identical stateless-kernel
// limitation already disclosed for SPEC-BOTAUTH-NONCE-VISA-1 §2.3: validAfter/validBefore window
// (caller-supplied now_unix, never Date.now() -- this kernel is a pure function of its inputs,
// required for a stable execution_hash), nonce format (bytes32, non-zero), and an OPTIONAL
// caller-supplied `nonce_already_used` boolean the caller computed against its own on-chain
// record (this kernel never queries a chain).
//
// ⛔⛔ Never a facilitator/proxy/settlement relay. Zero network. Zero crypto primitive -- this
// kernel does no signature recovery (that is the sibling BUILD-X402-RECOVER-1 node) and no
// digest recompute (BUILD-X402-DIGEST-1); it only compares caller-supplied fields against each
// other and against a caller-supplied reference time.

const DISCLOSURE = 'On-chain nonce uniqueness is enforced by the token contract at settlement time, not by this verifier. This tool confirms the authorization is well-formed, correctly signed, and not self-reported as already used -- it cannot confirm the nonce has never been spent on-chain.';

function _stripHexPrefix(hex) {
  const s = String(hex ?? '');
  return s.startsWith('0x') || s.startsWith('0X') ? s.slice(2) : s;
}

function _normalizeAddress(v) {
  if (typeof v !== 'string') return null;
  const s = _stripHexPrefix(v.trim());
  if (!/^[0-9a-fA-F]{40}$/.test(s)) return null;
  return '0x' + s.toLowerCase();
}

function _normalizeBytes32(v) {
  if (typeof v !== 'string') return null;
  const s = _stripHexPrefix(v.trim());
  if (!/^[0-9a-fA-F]{64}$/.test(s)) return null;
  return '0x' + s.toLowerCase();
}

function _isZeroBytes32(normalized) {
  return normalized === ('0x' + '0'.repeat(64));
}

// Accepts a decimal string, a 0x-hex string, or a safe-integer number; never throws.
function _toUint256BigInt(v) {
  try {
    let bi;
    if (typeof v === 'bigint') {
      bi = v;
    } else if (typeof v === 'number') {
      if (!Number.isFinite(v) || !Number.isInteger(v)) return null;
      bi = BigInt(v);
    } else if (typeof v === 'string') {
      const s = v.trim();
      if (s === '') return null;
      if (/^0x[0-9a-fA-F]+$/.test(s)) bi = BigInt(s);
      else if (/^[0-9]+$/.test(s)) bi = BigInt(s);
      else return null;
    } else {
      return null;
    }
    if (bi < 0n || bi >= (1n << 256n)) return null;
    return bi;
  } catch (e) {
    return null;
  }
}

const TOOL_ID = 'art-592-x402-domain-nonce-window-checker';
const TOOL_VERSION = '1.0.0';

export const meta = {
  tool_id: TOOL_ID,
  tool_version: TOOL_VERSION,
  mcp_name: 'check_x402_domain_nonce_window',
  mandate_type: 'compliance_control',
  gpu: false,
};

/**
 * compute(pp) -- pure check_x402_domain_nonce_window kernel.
 * pp: {
 *   expected_chain_id?, expected_verifying_contract?,      -- mandatory policy parameters, never defaulted
 *   chainId?, verifyingContract?,                           -- the domain fields actually SIGNED, caller-supplied
 *   validAfter?, validBefore?, now_unix?,                   -- uint256 window fields, caller-supplied
 *   nonce?,                                                 -- bytes32
 *   nonce_already_used?,                                    -- optional boolean, caller-computed, null if omitted
 * }
 */
export function compute(pp) {
  pp = (pp !== null && typeof pp === 'object') ? pp : {};
  const reasons = [];

  const expectedChainId = _toUint256BigInt(pp.expected_chain_id);
  const expectedVerifyingContract = _normalizeAddress(pp.expected_verifying_contract);
  if (expectedChainId === null) reasons.push('expected_chain_id is required and must be a non-negative uint256 (mandatory policy_parameter, never defaulted or inferred from the signed domain)');
  if (!expectedVerifyingContract) reasons.push('expected_verifying_contract is required and must be a 20-byte hex address (mandatory policy_parameter, never defaulted or inferred from the signed domain)');

  const signedChainId = _toUint256BigInt(pp.chainId);
  const signedVerifyingContract = _normalizeAddress(pp.verifyingContract);
  if (signedChainId === null) reasons.push('chainId is required and must be a non-negative uint256 (the domain field actually baked into the signature)');
  if (!signedVerifyingContract) reasons.push('verifyingContract is required and must be a 20-byte hex address (the domain field actually baked into the signature)');

  const validAfter = _toUint256BigInt(pp.validAfter);
  const validBefore = _toUint256BigInt(pp.validBefore);
  const nowUnix = _toUint256BigInt(pp.now_unix);
  if (validAfter === null) reasons.push('validAfter is required and must be a non-negative uint256');
  if (validBefore === null) reasons.push('validBefore is required and must be a non-negative uint256');
  if (nowUnix === null) reasons.push('now_unix is required and must be a non-negative uint256 (caller-supplied reference time -- this kernel never reads the system clock, which would make execution_hash non-reproducible)');

  const nonceNormalized = _normalizeBytes32(pp.nonce);
  if (!nonceNormalized) reasons.push('nonce is required and must be a 32-byte hex value (bytes32)');

  let nonceAlreadyUsed = null;
  if (pp.nonce_already_used === true || pp.nonce_already_used === false) {
    nonceAlreadyUsed = pp.nonce_already_used;
  } else if (pp.nonce_already_used !== undefined && pp.nonce_already_used !== null) {
    reasons.push('nonce_already_used, when supplied, must be a boolean');
  }

  const expected_echo = {
    expected_chain_id: expectedChainId !== null ? expectedChainId.toString() : null,
    expected_verifying_contract: expectedVerifyingContract,
  };
  const signed_domain_echo = {
    chain_id: signedChainId !== null ? signedChainId.toString() : null,
    verifying_contract: signedVerifyingContract,
  };
  const window_echo = {
    valid_after: validAfter !== null ? validAfter.toString() : null,
    valid_before: validBefore !== null ? validBefore.toString() : null,
    now_unix: nowUnix !== null ? nowUnix.toString() : null,
  };

  if (reasons.length > 0) {
    return {
      output_payload: {
        verdict: 'INDETERMINATE',
        reasons,
        expected: expected_echo,
        signed_domain: signed_domain_echo,
        domain_chain_match: null,
        domain_contract_match: null,
        window: window_echo,
        authorization_within_window: null,
        authorization_expired: null,
        authorization_not_yet_valid: null,
        nonce: nonceNormalized,
        nonce_well_formed: null,
        nonce_already_used: nonceAlreadyUsed,
        disclosure: DISCLOSURE,
      },
      compliance_flags: ['X402_DOMAIN_NONCE_INDETERMINATE', 'X402_MALFORMED_INPUT'],
    };
  }

  const domainChainMatch = expectedChainId === signedChainId;
  const domainContractMatch = expectedVerifyingContract === signedVerifyingContract;

  const withinWindow = validAfter <= nowUnix && nowUnix <= validBefore;
  const expired = nowUnix > validBefore;
  const notYetValid = nowUnix < validAfter;

  const nonceWellFormed = !_isZeroBytes32(nonceNormalized);
  if (!nonceWellFormed) reasons.push('nonce failed format check: bytes32 value must be non-zero');

  const compliance_flags = [
    domainChainMatch ? 'DOMAIN_CHAIN_MATCH' : 'DOMAIN_CHAIN_MISMATCH',
    domainContractMatch ? 'DOMAIN_CONTRACT_MATCH' : 'DOMAIN_CONTRACT_MISMATCH',
    withinWindow ? 'AUTHORIZATION_WITHIN_WINDOW' : (expired ? 'AUTHORIZATION_EXPIRED' : 'AUTHORIZATION_NOT_YET_VALID'),
    nonceWellFormed ? 'NONCE_WELL_FORMED' : 'NONCE_MALFORMED',
  ];

  const hardRefuse = !domainChainMatch || !domainContractMatch || !withinWindow || !nonceWellFormed || nonceAlreadyUsed === true;
  const verdict = hardRefuse ? 'REFUSE' : 'PASS';
  compliance_flags.push(hardRefuse ? 'X402_DOMAIN_NONCE_REFUSE' : 'X402_DOMAIN_NONCE_PASS');

  const output_payload = {
    verdict,
    reasons,
    expected: expected_echo,
    signed_domain: signed_domain_echo,
    domain_chain_match: domainChainMatch,
    domain_contract_match: domainContractMatch,
    window: window_echo,
    authorization_within_window: withinWindow,
    authorization_expired: expired,
    authorization_not_yet_valid: notYetValid,
    nonce: nonceNormalized,
    nonce_well_formed: nonceWellFormed,
    nonce_already_used: nonceAlreadyUsed,
    disclosure: DISCLOSURE,
  };

  return { output_payload, compliance_flags };
}

export async function buildArtifact(pp, { now, parent_hashes = [], parent_tool_ids = [], chain_depth = 0 } = {}) {
  const { output_payload, compliance_flags } = compute(pp);
  const hash = await executionHash(pp, output_payload);
  return {
    '@context':         'https://ainumbers.co/chaingraph/context/v0.3/context.jsonld',
    chaingraph_version: '0.4.0',
    mandate_type:       meta.mandate_type,
    tool_id:             TOOL_ID,
    tool_version:        TOOL_VERSION,
    generated_at:        now ?? null,
    execution_hash:      hash,
    chain:               { parent_hashes, parent_tool_ids, chain_depth },
    policy_parameters:   pp,
    output_payload,
    compliance_flags,
    compute_mode:        'server',
    compute_proof_ready: 'deferred',
    audit_signature:     { payloadType: 'application/vnd.openchain.graph+json;version=0.4', payload: '', signatures: [] },
  };
}
