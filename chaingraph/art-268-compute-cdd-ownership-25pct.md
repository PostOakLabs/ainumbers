# FinCEN CDD 25% Beneficial Ownership Attribution

Recursive indirect natural-person beneficial ownership computation via ownership-tier multiplication. 25% threshold per FinCEN CDD Rule 31 CFR 1010.230 bank KYB customer due diligence. Returns is_beneficial_owner (bool), total_indirect_pct, and per-natural-person breakdown. Exactly 25% IS a beneficial owner (>=25 threshold). NOT the CTA/BOI domestic reporting rule (31 USC 5336) removed by FinCEN IFR 2025-03-21. For OFAC 50%-Rule sanctions aggregation see art-91-ownership-50pct-aggregator. Synthetic entity IDs only. Zero PII by construction.

- Page: https://ainumbers.co/chaingraph/art-268-compute-cdd-ownership-25pct.html
- Markdown twin: https://ainumbers.co/chaingraph/art-268-compute-cdd-ownership-25pct.md
- MCP tool: compute_cdd_ownership_25pct (endpoint https://mcp.ainumbers.co/mcp)

## Inputs

- natural_persons (unknown, optional)
- ownership_tiers (unknown, optional)
- target_entity_id (unknown, optional)

## Outputs

- below_threshold (array, optional)
- below_threshold_count (integer, optional)
- beneficial_owner_count (integer, optional)
- beneficial_owners (array, optional)
- entities_evaluated (integer, optional)
- is_beneficial_owner (boolean, optional)
- methodology (string, optional)
- not_legal_advice (string, optional)
- pii_note (string, optional)
- regime_note (string, optional)
- regulatory_basis (string, optional)
- table_source (string, optional)
- table_version (string, optional)
- threshold_pct (integer, optional)

## Sample

```json
{
  "ownership_tiers": [
    {
      "entity_id": "EntityABC",
      "parent_id": "NP_ALPHA",
      "ownership_pct": 25
    }
  ],
  "natural_persons": [
    "NP_ALPHA"
  ],
  "target_entity_id": "EntityABC"
}
```

## Verify

Run the sample policy_parameters through MCP tool `compute_cdd_ownership_25pct` at https://mcp.ainumbers.co/mcp (or the page form) and check the returned receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.
