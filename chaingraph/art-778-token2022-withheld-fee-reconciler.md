# Token-2022 Withheld-Fee Reconciler

Token-2022 withheld-fee reconciliation across token accounts (the first node added after art-715; its primary text is the Solana Token-2022 program source, pinned at solana-program/token-2022 commit b5b7511e5d4f19a6a118b858d83a7fe3b0017b1e). Inputs, all pasted values: the mint's declared TransferFeeConfig fields (its accumulated withheld_amount and its withdraw_withheld_authority, which may be null), a caller-declared list of token accounts each {address, mint, withheld_amount}, the caller's declared total, and optionally a declared harvest or withdraw destination {address, mint, withdraw_authority}. Outputs, values only: the per-account withheld sum recomputed over mint-matching accounts (the program's HarvestWithheldTokensToMint skips a wrong-mint account with MintMismatch instead of moving its fees), the mint's accumulated withheld_amount, what the mint would accumulate after harvesting every mint-matching account (the on-chain addition is checked_add, so past u64 the harvest fails with TokenError::Overflow, reported as a fact, never wrapped), the declared total versus the recomputed total with the signed difference, lists of wrong-mint accounts and duplicate addresses in the declared list, and a fee-receiver placement check: whether the declared destination's mint matches the declared mint and whether the declared withdraw authority is the config's withdraw_withheld_authority (withdraw instructions require that signer; harvest to the mint is permissionless). Amounts are u64 token minor units in decimal strings, summed in BigInt. Facts only: no wording about risk or intent. Zero network, zero RPC, nothing on-chain is read.

- Page: https://ainumbers.co/chaingraph/art-778-token2022-withheld-fee-reconciler.html
- Markdown twin: https://ainumbers.co/chaingraph/art-778-token2022-withheld-fee-reconciler.md
- MCP tool: reconcile_token2022_withheld (endpoint https://mcp.ainumbers.co/mcp)

## Inputs

- mint (string, required): The declared mint address, pasted. Every account's mint is compared to this by string equality.
- transfer_fee_config (object, required): The mint's TransferFeeConfig fields: withdraw_withheld_authority (string or null) and withheld_amount (u64 decimal string), the accumulated pot.
- accounts (array, required): Token accounts, each { address, mint, withheld_amount } with withheld_amount a u64 decimal string. Empty array is valid (sum 0).
- declared_total (string, required): The caller's declared sum of withheld fees, decimal string (u64), reconciled against the recomputed sum.
- destination (object, optional): Optional destination { address, mint, withdraw_authority }, compared with the declared mint and the config's withdraw authority.

## Outputs

- mint (string,null, optional)
- account_count (string,null, optional)
- harvestable_account_count (string,null, optional)
- wrong_mint_account_count (string,null, optional)
- duplicate_address_count (string,null, optional)
- mint_withheld_accumulated (string,null, optional)
- recomputed_account_sum (string,null, optional)
- declared_total (string,null, optional)
- reconciliation (string,null, optional)
- declared_minus_recomputed (string,null, optional)
- sum_over_all_declared_entries (string,null, optional)
- sum_exceeds_u64 (boolean,null, optional)
- post_harvest_mint_withheld (string,null, optional)
- post_harvest_would_overflow_u64 (boolean,null, optional)
- wrong_mint_accounts (array,null, optional)
- duplicate_addresses (array,null, optional)
- fee_receiver_placement (object,null, optional)
- error (string, optional)
- detail (string, optional)
- domain_errors (array, optional)
- note (string, optional)

## Sample

```json
{
  "mint": "MintXkT2WITHHELDFEES00001",
  "transfer_fee_config": {
    "withdraw_withheld_authority": "Auth1WithdrawAuthority1111111111111111111",
    "withheld_amount": "500"
  },
  "accounts": [
    {
      "address": "AcctHolder1Token20220000000000000001",
      "mint": "MintXkT2WITHHELDFEES00001",
      "withheld_amount": "100"
    },
    {
      "address": "AcctHolder2Token20220000000000000002",
      "mint": "MintXkT2WITHHELDFEES00001",
      "withheld_amount": "250"
    },
    {
      "address": "AcctHolder3Token20220000000000000003",
      "mint": "MintXkT2WITHHELDFEES00001",
      "withheld_amount": "100"
    }
  ],
  "declared_total": "450"
}
```

## Verify

Run the sample policy_parameters through MCP tool `reconcile_token2022_withheld` at https://mcp.ainumbers.co/mcp (or the page form) and check the returned receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.
