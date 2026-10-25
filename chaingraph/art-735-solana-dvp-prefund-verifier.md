# Solana DvP Pre-Funding Terms Verifier

Verifies, values-only, that a pasted Solana Foundation DvP SwapDvp record is safe to fund: owner must be the pinned DvP program id, account length exactly SwapDvp::LEN 458 bytes, and the stored terms (amount_a/amount_b, expiry, earliest, user_a/user_b, settlement_authority, both settlement destinations) must match the funder-supplied agreed deal, because CreateDvp is permissionless and a forged create with attacker destinations redirects settlement proceeds. Also applies the program windows - earliest_settlement_timestamp <= expiry, expiry <= creation + one year (fixed 365-day year), expiry in the future at a REQUIRED caller-supplied cluster timestamp (never the system clock) - the Token-2022 blocked-extension deny list (TransferFeeConfig, InterestBearingConfig, ScaledUiAmountConfig, NonTransferable, which the program rejects with BlockedMintExtension), and the 32-per-leg transfer-hook extras cap. Trusted-authority risks the program accepts as-is (PermanentDelegate, Pausable, MintCloseAuthority, mutable TransferHook, ConfidentialTransfer, DefaultAccountState/freeze authority) are surfaced as trust flags, never rejections. Values only: no RPC calls, no PDA derivation, no keys, no on-chain writes. The output is a record-vs-terms recompute, NOT legal finality and NOT proof of agreement; the Cantina audit scope mapping for this program commit is UNVERIFIED and never cited as coverage. Every constant is ported from the pinned SOLANA-DVP-* clause snapshots (SOLANA-DVP-RETRIEVAL-1).

- Page: https://ainumbers.co/chaingraph/art-735-solana-dvp-prefund-verifier.html
- Markdown twin: https://ainumbers.co/chaingraph/art-735-solana-dvp-prefund-verifier.md
- MCP tool: verify_solana_dvp_terms (endpoint https://mcp.ainumbers.co/mcp)

## Inputs

- owner_program_id (string, required): The pasted account owner program id. Must equal the pinned DvP program id dvp34bdbcEm4f4FCUjGV4mDAkDshaQR4LkK8fdcsyZq.
- byte_length (string, required): The pasted account data length in bytes. Must be exactly 458 (SwapDvp::LEN struct pin).
- now (string, required): REQUIRED cluster unix timestamp in seconds (Clock::unix_timestamp). Cluster time, not wall-clock; the system clock is never read.
- creation_timestamp (string, required): The record's creation cluster time (i64 decimal string); the one-year expiry cap is measured from it.
- nonce (string, required): The pasted nonce value as a non-empty string (the README advises a cryptographically random 64-bit nonce per trade).
- user_a (string, optional): Party A address as pasted.
- user_b (string, optional): Party B address as pasted.
- mint_a (string, optional): Leg A mint address as pasted.
- mint_b (string, optional): Leg B mint address as pasted.
- token_program_a (string, optional): Leg A token program as pasted (struct pin: owner of mint_a captured at Create).
- token_program_b (string, optional): Leg B token program as pasted (struct pin: owner of mint_b captured at Create).
- settlement_authority (string, optional): The record's settlement_authority as pasted.
- destination_a (string, optional): user A's settlement destination (receives the cash leg mint_b proceeds) as pasted.
- destination_b (string, optional): user B's settlement destination (receives the asset leg mint_a proceeds) as pasted.
- mint_a_authority (string, optional): mint_a's mint authority captured at Create as pasted (struct pin).
- mint_b_authority (string, optional): mint_b's mint authority captured at Create as pasted (struct pin).
- amount_a (string, optional): Leg A amount as pasted, decimal string in u64 range.
- amount_b (string, optional): Leg B amount as pasted, decimal string in u64 range.
- expiry_timestamp (string,null, optional): The record's expiry_timestamp (i64 decimal string). Only Settle rejects after it (README Notes line 24).
- earliest_settlement_timestamp (string,null, optional): The record's earliest_settlement_timestamp, or null for None (no lower bound; struct pin lines 40-44).
- mint_a_extensions (array, optional): Token-2022 extension names present on mint_a (caller-read off-chain). Unknown names are refused.
- mint_b_extensions (array, optional): Token-2022 extension names present on mint_b (caller-read off-chain). Unknown names are refused.
- mint_a_frozen_by_default (boolean, optional): mint_a carries DefaultAccountState frozen (or starts accounts frozen).
- mint_b_frozen_by_default (boolean, optional): mint_b carries DefaultAccountState frozen (or starts accounts frozen).
- mint_a_freeze_authority_set (boolean, optional): mint_a has a freeze authority.
- mint_b_freeze_authority_set (boolean, optional): mint_b has a freeze authority.
- leg_a_extras_count (string, required): Hook trailing accounts resolved for leg A (u8 0-255); must be <= 32 per leg (MAX_HOOK_REMAINING_ACCOUNTS).
- leg_b_extras_count (string, required): Hook trailing accounts resolved for leg B (u8 0-255); must be <= 32 per leg.
- expected (object, required): The funder-supplied agreed deal the record is verified against. Supplying the forged record's own values here makes the check circular.

## Outputs

- prefund_check (string, required)
- owner_matches (boolean,null, required)
- length_matches (boolean,null, required)
- terms_match (boolean,null, required)
- terms_mismatches (array, optional)
- earliest_within_expiry (boolean,null, required)
- expiry_within_one_year (boolean,null, required)
- expiry_in_future (boolean,null, required)
- no_blocked_extensions (boolean,null, required)
- blocked_extensions_found (array, optional)
- hook_extras_within_cap (boolean,null, required)
- failed_checks (array,null, required)
- trust_flags (array, required)
- warnings (array, required)
- record (object,null, optional)
- error (string, optional)
- detail (string, optional)
- domain_errors (array, optional)
- manual_review_required (boolean, optional)
- disclaimer (string, required)
- audit_scope_note (string, required)
- expected_terms_note (string, optional)
- error_direction (string, optional)

## Sample

```json
{
  "owner_program_id": "dvp34bdbcEm4f4FCUjGV4mDAkDshaQR4LkK8fdcsyZq",
  "byte_length": "458",
  "user_a": "7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU",
  "user_b": "Gf8cMJ3yRMLpponGJtdfkzX67BhTReLh4m1uPjYz6Ugk",
  "mint_a": "3p9W2vGhTdMQp7sKdDXhcHmgRcxpaB3ZuXYxU8k2FhQN",
  "mint_b": "8kQFfPJ1FwDkZUsxBernCLzexFAZpQvH4fpRS8TwEGXi",
  "token_program_a": "TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb",
  "token_program_b": "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA",
  "settlement_authority": "BfIwS1B8f7RC1ZY8NbZLBuJSQP9fM2tzL8t8XnJ9c8kX",
  "destination_a": "Ck8x2E9S8DcVJ3cJnd6oFfEqBMDdhzWY9zKLzye4LYBw",
  "destination_b": "Dq8pgDk1ZdLcPdMxyvRQ2NLhEu9XvPia8Gn2LtzY9dKo",
  "mint_a_authority": "Eq2vH9GeNcqLQobYm5YoFbLpaKMPTZhMKAqcBf41LxNh",
  "mint_b_authority": "Fq9kxRfM4PqNZeSVh3pLRLn9vbcEKmZAxnZqdZ4SPrBG",
  "amount_a": "1500000000",
  "amount_b": "250000000",
  "expiry_timestamp": "1770086400",
  "earliest_settlement_timestamp": null,
  "creation_timestamp": "1769900000",
  "nonce": "7284759301947385401",
  "mint_a_extensions": [],
  "mint_b_extensions": [],
  "mint_a_frozen_by_default": false,
  "mint_b_frozen_by_default": false,
  "mint_a_freeze_authority_set": false,
  "mint_b_freeze_authority_set": false,
  "leg_a_extras_count": "0",
  "leg_b_extras_count": "0",
  "now": "1770000000",
  "expected": {
    "amount_a": "1500000000",
    "amount_b": "250000000",
    "expiry_timestamp": "1770086400",
    "earliest_settlement_timestamp": null,
    "user_a": "7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU",
    "user_b": "Gf8cMJ3yRMLpponGJtdfkzX67BhTReLh4m1uPjYz6Ugk",
    "settlement_authority": "BfIwS1B8f7RC1ZY8NbZLBuJSQP9fM2tzL8t8XnJ9c8kX",
    "destination_a": "Ck8x2E9S8DcVJ3cJnd6oFfEqBMDdhzWY9zKLzye4LYBw",
    "destination_b": "Dq8pgDk1ZdLcPdMxyvRQ2NLhEu9XvPia8Gn2LtzY9dKo"
  }
}
```

## Verify

Run the sample policy_parameters through MCP tool `verify_solana_dvp_terms` at https://mcp.ainumbers.co/mcp (or the page form) and check the returned receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.
