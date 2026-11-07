# Zcash Supply Check

Checks the arithmetic of user-pasted Zcash chain value pool balances (transparent, Sprout, Sapling, Orchard, in integer zatoshi) against a claimed total supply: recomputes the pool sum exactly, checks every pool is non-negative (the pinned negative-balance consensus rules declare a negative pool an invalid chain state), and tests the no-counterfeiting conservation identity that the four pools together equal the claimed supply, reporting any difference exactly with its sign. It states plainly that it cannot read the chain and does not verify that the pasted numbers are true: evidence.chain_verified is false on every payload, including a conserved one. Refusal branches cover non-numeric values (never echoed), pool names outside the four pinned pools (lockbox included), a missing pool, an absent claimed supply, fractional zatoshi, and values above the declared safe-arithmetic bound. Declared exclusions: values only, no chain access, no lockbox or deferred pool, no height or issuance-history corroboration, no market or price figures, not investment advice.

- Page: https://ainumbers.co/chaingraph/822-zcash-supply-check.html
- Markdown twin: https://ainumbers.co/chaingraph/822-zcash-supply-check.md
- MCP tool: audit_zcash_pool_supply (endpoint https://mcp.ainumbers.co/mcp)

## Inputs

- pools (object, optional): Four chain value pool balances in integer zatoshi, keyed transparent, sprout, sapling, orchard. All four required; unknown keys refused, never zeroed.
- claimed_supply_zat (number, optional): The claimed total supply the identity is tested against, in integer zatoshi. Absent, fractional, or over-bound values are refused, never assumed.

## Outputs

- verdict (string, optional)
- method (string, optional)
- pools (object, optional)
- recomputed_total_zat (integer, optional)
- claimed_supply_zat (integer, optional)
- delta_zat (integer, optional)
- negative_pools (array, optional)
- issues (array, optional)
- refused_because (string, optional)
- refused_field (string, optional)
- refused_fields (array, optional)
- manual_review_required (boolean, optional)
- evidence (object, optional)

## Sample

```json
{
  "pools": {
    "transparent": 100000000000,
    "sprout": 200000000000,
    "sapling": 300000000000,
    "orchard": 400000000000
  },
  "claimed_supply_zat": 1000000000000
}
```

## Verify

Run the sample policy_parameters through MCP tool `audit_zcash_pool_supply` at https://mcp.ainumbers.co/mcp (or the page form) and check the returned receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.
