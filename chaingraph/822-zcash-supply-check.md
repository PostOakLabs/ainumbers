# Zcash Supply Check

Checks the no-counterfeiting arithmetic of the Zcash chain value pools from caller-pasted VALUES ONLY (zero PII by schema): recomputes the four-pool sum in integer zatoshi (transparent, Sprout, Sapling, Orchard, the zcashd valuePools chainValueZat figures), checks every pool is non-negative (the pinned negative-balance consensus rules declare a negative pool an invalid chain state), and tests the no-counterfeiting conservation identity that the four pools together equal the claimed total supply, reporting any difference exactly, in zatoshi, with its sign. It checks arithmetic only: it cannot read the Zcash chain and does not verify that the pasted numbers are true of any chain at any height, and it does not verify the claimed issuance total itself (evidence.chain_verified is false on every payload, including a conserved one). Declared domain exclusions: values only - non-numeric fields, pool names outside the four pinned pools, a missing pool, an absent claimed supply, fractional zatoshi, and values above the declared safe-arithmetic bound are refused, never echoed or zeroed; no lockbox or deferred pool; no height or issuance-history corroboration; no market or price figures; not investment advice.

- Page: https://ainumbers.co/chaingraph/822-zcash-supply-check.html
- Markdown twin: https://ainumbers.co/chaingraph/822-zcash-supply-check.md
- MCP tool: audit_zcash_pool_supply (endpoint https://mcp.ainumbers.co/mcp)

## Inputs

- pools (object): The four Zcash chain value pool balances in integer zatoshi, keyed transparent, sprout, sapling, orchard (the zcashd valuePools chainValueZat figures), pasted as a JSON object. All four pools must be present; a key outside the four pinned pool names is refused, never zeroed.
- claimed_supply_zat (number): The claimed total supply the conservation identity is tested against, in integer zatoshi (the zcashd chainSupply chainValueZat figure). Absent, fractional, or over-bound values are refused, never assumed.

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

Run the sample policy_parameters through MCP tool `audit_zcash_pool_supply` at https://mcp.ainumbers.co/mcp (or the page form) and check the returned receipt's execution hash against the ledger at https://ledger.ainumbers.co/. The sample figures are synthetic round numbers chosen for hand-checkability (the four pools sum to exactly the claimed 1000000000000 zatoshi); they are not any chain's balances. A conserved verdict asserts only the arithmetic of the pasted numbers: the tool never reads the chain and never verifies that the pasted values are true.
