import { executionHash } from './_hash.mjs';

// art-778-token2022-withheld-fee-reconciler — Token-2022 withheld-fee reconciliation across accounts.
// Given the mint's declared TransferFeeConfig (its accumulated withheld_amount and its
// withdraw_withheld_authority), a caller-declared list of token accounts each carrying a
// TransferFeeAmount, an optional declared harvest/withdraw destination, and the caller's declared
// total, recomputes the sum of per-account withheld fees, reconciles the declared total against
// it, and checks where the fees would land (destination mint match, withdraw authority match).
//
// PROVENANCE (SOLANA-WITHHELD-FEE-RECON-1; common rules SOLANA-BUILD-CHAIN-COMMON-2026-10-27
// section 2, re-pinned at claim): solana-program/token-2022 at commit
// b5b7511e5d4f19a6a118b858d83a7fe3b0017b1e (committed 2026-10-06):
//   - interface/src/extension/transfer_fee/mod.rs L135-L151: TransferFeeConfig (mint extension)
//     carries withdraw_withheld_authority: MaybeNull<Address> — "Withdraw from mint instructions
//     must be signed by this key" — and withheld_amount: U64 — "Withheld transfer fee tokens that
//     have been moved to the mint for withdrawal". Units: token minor units (base 8), u64.
//   - interface/src/extension/transfer_fee/mod.rs L178-L181: TransferFeeAmount (account extension)
//     carries withheld_amount: U64 — "Amount withheld during transfers, to be harvested to the
//     mint". Same u64 minor units.
//   - interface/src/extension/transfer_fee/instruction.rs L118-L135: WithdrawWithheldTokensFromAccounts
//     (accounts: destination, authority signer, M signers, N writable sources) and
//     HarvestWithheldTokensToMint — "Permissionless instruction to transfer all withheld tokens
//     to the mint."
//   - program/src/extension/transfer_fee/processor.rs L169-L227 (harvest_from_account +
//     process_harvest_withheld_tokens_to_mint): an account whose mint differs from the mint key
//     returns MintMismatch and that account is SKIPPED (logged, not fatal); each harvested amount
//     is added to the mint's withheld_amount with checked_add, which fails the instruction with
//     TokenError::Overflow past u64.
// No bytes are copied from the Solana sources; the rules below restate the pinned behaviour.
//
// SIBLING: art-715-token2022-transfer-fee-reconciler (schedule arithmetic, live, proven) is NOT
// edited by this row; its decimal-string parsing and structured-refusal idiom are reused by copy.
//
// DETERMINISM: compute() is a PURE function of pp — no Date.now()/Math.random(), no network, no
// filesystem. All amounts are BigInt end to end: u64 exceeds 2^53, so JS Number is NEVER used for
// amounts. Sums are computed in unbounded BigInt and CHECKED against u64 bounds rather than
// wrapped, mirroring the source's checked_add semantics.
//
// FACTS ONLY: outputs are recomputed values, differences and boolean matches. No wording about
// risk, intent, or what anyone ought to do.

const TOOL_ID = 'art-778-token2022-withheld-fee-reconciler';
const TOOL_VERSION = '1.0.0';

export const meta = {
  tool_id: TOOL_ID, tool_version: TOOL_VERSION,
  mcp_name: 'reconcile_token2022_withheld',
  mandate_type: 'settlement_mandate', gpu: false,
};

const U64_MAX = (1n << 64n) - 1n;

// Decimal-string -> BigInt (art-715 idiom). Inputs and outputs are decimal strings.
function parseU64(s) {
  if (typeof s !== 'string' || !/^[0-9]+$/.test(s)) return null;
  let v = 0n;
  for (let __i = 0; __i < s.length; __i++) { const ch = s[__i]; v = v * 10n + BigInt(ch.charCodeAt(0) - 48); if (v > U64_MAX) return null; }
  return v;
}
function dec(v) { return v.toString(10); }

function deNull(o) {
  if (!o || typeof o !== 'object' || Array.isArray(o)) return o;
  const c = { ...o };
  for (const k of Object.keys(c)) if (c[k] === null) c[k] = undefined;
  return c;
}

function refusal(code, detail, extra = {}) {
  return {
    output_payload: {
      error: code.toLowerCase(),
      detail,
      domain_errors: [{ code, text: detail }],
      mint: null,
      account_count: null,
      harvestable_account_count: null,
      wrong_mint_account_count: null,
      duplicate_address_count: null,
      mint_withheld_accumulated: null,
      recomputed_account_sum: null,
      declared_total: null,
      reconciliation: null,
      declared_minus_recomputed: null,
      sum_over_all_declared_entries: null,
      sum_exceeds_u64: null,
      post_harvest_mint_withheld: null,
      post_harvest_would_overflow_u64: null,
      wrong_mint_accounts: null,
      duplicate_addresses: null,
      fee_receiver_placement: null,
      ...extra,
    },
    compliance_flags: code ? ['INPUT_REFUSED'] : [],
  };
}

function isNonEmptyString(s) { return typeof s === 'string' && s.length > 0; }

/**
 * compute(pp) — pure reconciliation kernel (values only; nothing on-chain is read).
 * pp: {
 *   mint: string,                          // the declared mint address, pasted
 *   transfer_fee_config: {                 // the mint's declared TransferFeeConfig fields
 *     withdraw_withheld_authority: string|null,  // the config's withdraw authority (null = none set)
 *     withheld_amount: string              // mint-accumulated withheld, decimal string (u64)
 *   },
 *   accounts: [ {                          // caller-declared token accounts
 *     address: string,                     // account address, pasted
 *     mint: string,                        // the mint this account declares
 *     withheld_amount: string              // TransferFeeAmount.withheld_amount, decimal string (u64)
 *   } ],
 *   declared_total: string,                // the caller's declared sum, decimal string (u64)
 *   destination: {                         // OPTIONAL declared harvest/withdraw destination
 *     address: string,
 *     mint: string,
 *     withdraw_authority: string           // the authority the caller declares as signing
 *   }
 * }
 * @param {object} pp policy_parameters
 * @returns {{ output_payload: object, compliance_flags: string[] }}
 */
export function compute(pp) {
  pp = deNull(pp || {});

  if (!isNonEmptyString(pp.mint)) {
    return refusal('MINT_INVALID', 'mint must be a non-empty string (the declared mint address); got ' + JSON.stringify(pp.mint ?? null) + '.');
  }
  const mint = pp.mint;

  const cfg = pp.transfer_fee_config;
  if (!cfg || typeof cfg !== 'object' || Array.isArray(cfg)) {
    return refusal('TRANSFER_FEE_CONFIG_MALFORMED', 'transfer_fee_config must be an object { withdraw_withheld_authority, withheld_amount }.');
  }
  const authority = cfg.withdraw_withheld_authority;
  if (authority !== null && !isNonEmptyString(authority)) {
    return refusal('TRANSFER_FEE_CONFIG_MALFORMED', 'transfer_fee_config.withdraw_withheld_authority must be a non-empty string or null (MaybeNull in the pinned source); got ' + JSON.stringify(authority ?? null) + '.');
  }
  const mintWithheld = parseU64(cfg.withheld_amount);
  if (mintWithheld === null) {
    return refusal('TRANSFER_FEE_CONFIG_MALFORMED', 'transfer_fee_config.withheld_amount must be a decimal string in u64 range (the mint-accumulated withheld amount); got ' + JSON.stringify(cfg.withheld_amount ?? null) + '.');
  }

  if (!Array.isArray(pp.accounts)) {
    return refusal('ACCOUNTS_MALFORMED', 'accounts must be an array of { address, mint, withheld_amount } objects; an empty array is valid (sum 0).');
  }
  const accounts = [];
  for (let i = 0; i < pp.accounts.length; i++) {
    const a = pp.accounts[i];
    if (!a || typeof a !== 'object' || Array.isArray(a)) {
      return refusal('ACCOUNTS_MALFORMED', 'accounts[' + i + '] must be an object { address, mint, withheld_amount }.');
    }
    if (!isNonEmptyString(a.address)) {
      return refusal('ACCOUNTS_MALFORMED', 'accounts[' + i + '].address must be a non-empty string.');
    }
    if (!isNonEmptyString(a.mint)) {
      return refusal('ACCOUNTS_MALFORMED', 'accounts[' + i + '].mint must be a non-empty string.');
    }
    const w = parseU64(a.withheld_amount);
    if (w === null) {
      return refusal('ACCOUNTS_MALFORMED', 'accounts[' + i + '].withheld_amount must be a decimal string in u64 range (TransferFeeAmount.withheld_amount); got ' + JSON.stringify(a.withheld_amount ?? null) + '.');
    }
    accounts.push({ address: a.address, mint: a.mint, withheld: w });
  }

  const declaredTotal = parseU64(pp.declared_total);
  if (declaredTotal === null) {
    return refusal('DECLARED_TOTAL_INVALID', 'declared_total must be a decimal string in u64 range; got ' + JSON.stringify(pp.declared_total ?? null) + '.');
  }

  let destination = null;
  if (pp.destination !== undefined) {
    const d = pp.destination;
    if (!d || typeof d !== 'object' || Array.isArray(d)) {
      return refusal('DESTINATION_MALFORMED', 'destination, when supplied, must be an object { address, mint, withdraw_authority }.');
    }
    if (!isNonEmptyString(d.address) || !isNonEmptyString(d.mint) || !isNonEmptyString(d.withdraw_authority)) {
      return refusal('DESTINATION_MALFORMED', 'destination.{address, mint, withdraw_authority} must each be a non-empty string when a destination is supplied.');
    }
    destination = { address: d.address, mint: d.mint, withdrawAuthority: d.withdraw_authority };
  }

  const compliance_flags = [];

  // Wrong-mint accounts: the pinned harvest processor skips them with MintMismatch (logged, not
  // fatal), so the recomputed sum counts only mint-matching accounts.
  const wrongMint = accounts.filter((a) => a.mint !== mint);
  const harvestable = accounts.filter((a) => a.mint === mint);

  // Duplicate addresses in the declared list (data-quality fact about the input list; each
  // declared entry is counted as declared).
  const byAddress = new Map();
  for (const a of accounts) byAddress.set(a.address, (byAddress.get(a.address) || 0) + 1);
  const duplicates = [];
  for (const [address, count] of byAddress) if (count > 1) duplicates.push({ address, declared_count: count });

  // Sums in unbounded BigInt, then CHECKED against u64 (the source's checked_add fails the
  // harvest with TokenError::Overflow; this kernel reports the fact instead of refusing).
  let recomputed = 0n;
  let sumAll = 0n;
  for (const a of harvestable) recomputed += a.withheld;
  for (const a of accounts) sumAll += a.withheld;
  const sumExceedsU64 = recomputed > U64_MAX;

  const postHarvest = mintWithheld + recomputed;
  const postHarvestExceedsU64 = postHarvest > U64_MAX;

  // Declared total versus recomputed total.
  let reconciliation;
  let declaredMinusRecomputed;
  if (declaredTotal === recomputed) {
    reconciliation = 'MATCH';
    declaredMinusRecomputed = '0';
  } else if (declaredTotal > recomputed) {
    reconciliation = 'DECLARED_ABOVE_RECOMPUTED';
    declaredMinusRecomputed = '+' + dec(declaredTotal - recomputed);
  } else {
    reconciliation = 'DECLARED_BELOW_RECOMPUTED';
    declaredMinusRecomputed = '-' + dec(recomputed - declaredTotal);
  }

  if (wrongMint.length > 0) compliance_flags.push('ACCOUNT_MINT_MISMATCH');
  if (duplicates.length > 0) compliance_flags.push('DUPLICATE_ACCOUNT_ADDRESS');
  if (reconciliation !== 'MATCH') compliance_flags.push('DECLARED_TOTAL_DIVERGES');

  // Fee-receiver placement check (facts only): the destination's mint versus the declared mint,
  // and the declared withdraw authority versus the config's withdraw_withheld_authority.
  let feeReceiverPlacement = null;
  if (destination !== null) {
    const mintMatches = destination.mint === mint;
    const authorityMatches = destination.withdrawAuthority === authority;
    if (!mintMatches) compliance_flags.push('DESTINATION_MINT_MISMATCH');
    if (!authorityMatches) compliance_flags.push('DECLARED_WITHDRAW_AUTHORITY_MISMATCH');
    feeReceiverPlacement = {
      declared_destination_address: destination.address,
      declared_destination_mint: destination.mint,
      declared_mint: mint,
      destination_mint_matches_declared_mint: mintMatches,
      declared_withdraw_authority: destination.withdrawAuthority,
      config_withdraw_withheld_authority: authority,
      declared_withdraw_authority_matches_config: authorityMatches,
      authority_basis: 'WithdrawWithheldTokensFromAccounts and WithdrawWithheldTokensFromMint require the config withdraw_withheld_authority as signer ("Withdraw from mint instructions must be signed by this key", pinned source); harvest to the mint is permissionless and needs no authority.',
    };
  }

  const output_payload = {
    mint,
    account_count: dec(BigInt(accounts.length)),
    harvestable_account_count: dec(BigInt(harvestable.length)),
    wrong_mint_account_count: dec(BigInt(wrongMint.length)),
    duplicate_address_count: dec(BigInt(duplicates.length)),
    mint_withheld_accumulated: dec(mintWithheld),
    recomputed_account_sum: dec(recomputed),
    declared_total: dec(declaredTotal),
    reconciliation,
    declared_minus_recomputed: declaredMinusRecomputed,
    sum_over_all_declared_entries: dec(sumAll),
    sum_exceeds_u64: sumExceedsU64,
    post_harvest_mint_withheld: dec(postHarvest),
    post_harvest_would_overflow_u64: postHarvestExceedsU64,
    wrong_mint_accounts: wrongMint.map((a) => ({ address: a.address, declared_mint: mint, account_mint: a.mint })),
    duplicate_addresses: duplicates,
    fee_receiver_placement: feeReceiverPlacement,
    note: 'Withheld amounts are per-account TransferFeeAmount.withheld_amount and the mint-level TransferFeeConfig.withheld_amount, both u64 in token minor units, pinned at solana-program/token-2022 commit b5b7511e5d4f19a6a118b858d83a7fe3b0017b1e. recomputed_account_sum counts only accounts whose mint matches the declared mint: the harvest instruction skips a wrong-mint account with MintMismatch instead of moving its fees. post_harvest_mint_withheld is what the mint would accumulate after harvesting every mint-matching account; the on-chain addition is checked_add, so an amount past u64 fails the harvest with TokenError::Overflow, reported here as post_harvest_would_overflow_u64. Mint and authority comparisons are string equality on the pasted values; this kernel reads nothing on-chain.',
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
