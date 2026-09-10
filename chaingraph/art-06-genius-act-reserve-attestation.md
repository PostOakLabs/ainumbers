# GENIUS Act Reserve Attestation Pre-Check

1:1 reserve coverage, reserve-composition eligibility against GENIUS Act permitted-asset classes, monthly reserve-report figures against AICPA 2025 Criteria for CEO/CFO certification. Distinct from MiCA reserve stress.

- Page: https://ainumbers.co/chaingraph/art-06-genius-act-reserve-attestation.html
- Markdown twin: https://ainumbers.co/chaingraph/art-06-genius-act-reserve-attestation.md
- MCP tool: precheck_reserve_attestation (endpoint https://mcp.ainumbers.co/mcp)

## Inputs

- aicpa_answers (unknown, required)
- assets (array, required)
- issuer_type (unknown, optional)
- outstanding_tokens (number, required)
- token_price (number, optional)

## Outputs

- aicpa_2025_score_pct (number, required)
- applicable_deadline (string, required)
- asset_results (array, required)
- attestation_readiness_determination (string, required)
- conditional_assets_usd (number, required)
- coverage_ratio_pct (null,number, required)
- failing_dimensions (array, required)
- prohibited_assets_usd (number, required)
- regulatory_framework (string, required)
- reserve_shortfall_usd (null,number, required)
- total_liabilities_usd (number, required)
- total_reserves_usd (number, required)
- warnings (array, required)

## Sample

```json
{}
```

## Verify

Run the sample policy_parameters through MCP tool `precheck_reserve_attestation` at https://mcp.ainumbers.co/mcp (or the page form) and check the returned receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.
