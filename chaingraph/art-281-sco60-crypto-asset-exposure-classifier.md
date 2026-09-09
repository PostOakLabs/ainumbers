# SCO60 Crypto-Asset Exposure Classifier

Classifies a crypto-asset position into Basel SCO60 Group 1a, 1b, 2a, or 2b (BCBS d545 Prudential treatment of cryptoasset exposures), applies the Group 1 infrastructure-risk capital add-on, and checks the Group 2 exposure limit of 1% of Tier 1 capital. National implementation timelines vary; never asserts jurisdictional adoption. NaN-safe. Zero network, zero PII.

- Page: https://ainumbers.co/chaingraph/art-281-sco60-crypto-asset-exposure-classifier.html
- Markdown twin: https://ainumbers.co/chaingraph/art-281-sco60-crypto-asset-exposure-classifier.md
- MCP tool: classify_sco60_exposure (endpoint https://mcp.ainumbers.co/mcp)

## Inputs

- position (unknown, optional)

## Outputs

- base_risk_weight_pct (integer, optional)
- classification (string, optional)
- gaps (array, optional)
- group (string, optional)
- group2_exposure_pct_tier1 (integer, optional)
- group2_limit_breached (boolean, optional)
- infra_addon_capped (boolean, optional)
- infra_addon_pct_applied (integer, optional)
- infra_addon_pct_input (integer, optional)
- pillar3_precheck_pass (boolean, optional)
- risk_weight_applied_pct (integer, optional)

## Sample

```json
{
  "position": {
    "classification": "tokenized_traditional",
    "meets_group1_conditions": true,
    "infrastructure_risk_addon_pct": 200,
    "group2_exposure_amount": 0,
    "bank_tier1_capital": 1000000
  }
}
```

## Verify

Run the sample policy_parameters through MCP tool `classify_sco60_exposure` at https://mcp.ainumbers.co/mcp (or the page form) and check the returned receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.
