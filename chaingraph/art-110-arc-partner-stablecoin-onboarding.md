# Arc Partner Stablecoin Onboarding Conformance

Score a non-USD stablecoin issuer readiness to join Circle Partner Stablecoins on Arc against technical/operational, reserve-management, and risk-management standards. Outputs an A–F composite grade, gap list, and eligibility verdict. Optional Ed25519 §​16 proof produces a conformance attestation verifiable by Circle or a supervisor. Distinct from arc-xreserve-issuance (USDC/GENIUS issuer path).

- Page: https://ainumbers.co/chaingraph/art-110-arc-partner-stablecoin-onboarding.html
- Markdown twin: https://ainumbers.co/chaingraph/art-110-arc-partner-stablecoin-onboarding.md
- MCP tool: score_partner_stablecoin_readiness (endpoint https://mcp.ainumbers.co/mcp)

## Inputs

- issuer_profile (unknown, required)

## Outputs

- ccy (string, optional)
- composite_grade (integer, optional)
- eligible (boolean, optional)
- gaps (array, optional)
- grade (string, optional)
- home_regime (string, optional)
- reserve_score (integer, optional)
- risk_score (integer, optional)
- tech_score (integer, optional)
- verdict (string, optional)

## Sample

```json
{
  "issuer_profile": {
    "ccy": "EURC",
    "reserve_composition": [
      "liquid_sovereign",
      "cash_equivalent",
      "ecb_eligible"
    ],
    "attestation_cadence": "monthly",
    "risk_mgmt_controls": [
      "aml_screening",
      "transaction_monitoring",
      "sanctions_screening",
      "kyc_program"
    ],
    "technical_caps": [
      "evm_compatibility",
      "mint_burn_api",
      "on_chain_attestation",
      "iso20022_messaging",
      "circle_api_v2"
    ],
    "home_regime": "MiCA-EMT"
  }
}
```

## Verify

Run the sample policy_parameters through MCP tool `score_partner_stablecoin_readiness` at https://mcp.ainumbers.co/mcp (or the page form) and check the returned receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.
