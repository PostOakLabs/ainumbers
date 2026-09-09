# IRRBB Standardised Approach Mapper

Map non-maturing deposit (NMD) positions to the EBA standardised / simplified-standardised approach behavioural caps (BCBS d368 para 87 / Annex 2): retail transactional core proportion capped at 90% / average maturity capped at 5 years; retail non-transactional (savings) core capped at 70% / 4.5 years; wholesale core capped at 50% / 4 years. Flags behavioural-option add-ons (e.g. mortgage prepayment) requiring separate treatment. Root node of the irrbb-measurement-and-disclosure chain. NaN-safe. Zero network, zero PII.

- Page: https://ainumbers.co/chaingraph/art-186-irrbb-standardised-approach-mapper.html
- Markdown twin: https://ainumbers.co/chaingraph/art-186-irrbb-standardised-approach-mapper.md
- MCP tool: map_irrbb_standardised_approach (endpoint https://mcp.ainumbers.co/mcp)

## Inputs

- positions (unknown, optional)

## Outputs

- behavioural_mortgage_prepay_pct (integer, optional)
- behavioural_option_addon_required (boolean, optional)
- core_capped (boolean, optional)
- core_deposit_pct_applied (integer, optional)
- core_deposit_pct_input (integer, optional)
- deposit_category (string, optional)
- maturity_cap_years (integer, optional)

## Sample

```json
{
  "positions": {
    "deposit_category": "retail_transactional",
    "core_deposit_pct": 95,
    "behavioural_mortgage_prepay_pct": 15
  }
}
```

## Verify

Run the sample policy_parameters through MCP tool `map_irrbb_standardised_approach` at https://mcp.ainumbers.co/mcp (or the page form) and check the returned receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.
