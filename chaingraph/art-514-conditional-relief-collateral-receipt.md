# Conditional-Relief Collateral Receipt

Shows, per acceptance and per day, that every condition of a conditional regulatory relief - no-action, exemptive, or comfort-letter - held before a firm accepted an asset as collateral in reliance on it: a per-condition PASS/FAIL/UNDECIDABLE verdict against the caller's own versioned condition set (never a silent PASS on absent evidence), a version-staleness check comparing the version the caller relied on against the version the condition set was evidenced against, the applicable capital charge from the caller's own table, and a revocation-exposure figure - the capital and eligibility delta if the relief were withdrawn at as_of. Portable to any regime - CFTC, SEC, OCC, FCA, MAS - the regime label and every condition are caller-supplied policy input, never a hardcoded rule set. Does not rebuild reserve checking (art-06, art-512, art-280) or haircuts/eligibility (art-444, 505, 508, art-320) - reused upstream in a chain. Renders no eligibility opinion and no investment advice: it reports whether the caller's declared conditions were met against the caller's declared evidence. compliance_control.

- Page: https://ainumbers.co/chaingraph/art-514-conditional-relief-collateral-receipt.html
- Markdown twin: https://ainumbers.co/chaingraph/art-514-conditional-relief-collateral-receipt.md
- MCP tool: build_conditional_relief_collateral_receipt (endpoint https://mcp.ainumbers.co/mcp)

## Inputs

- as_of (unknown, required)
- asset_class (unknown, required)
- capital_charge_table (array, required)
- condition_set (unknown, required)
- declared_haircut_pct (unknown, required): Percentage value
- declared_reporting_cadence (unknown, required)
- declared_valuation (unknown, required)
- issuer_permitted_status (boolean, required)
- last_report_ref (unknown, required)
- position_size (unknown, required)
- relied_on_version (unknown, required)
- relief_regime (unknown, required)
- revocation_charge_pct (unknown, required): Percentage value
- revocation_eligible_without_relief (boolean, required)

## Outputs

- all_conditions_met (boolean, optional)
- applicable_capital_charge (integer, optional)
- applicable_charge_pct (integer, optional)
- as_of (string, optional)
- asset_class (string, optional)
- asset_class_valid (boolean, optional)
- condition_set_version (string, optional)
- conditions (array, optional)
- declared_haircut_pct (integer, optional)
- declared_reporting_cadence (string, optional)
- declared_valuation (integer, optional)
- eligibility_lost_on_revocation (boolean, optional)
- exceptions (array, optional)
- issuer_permitted_status (boolean, optional)
- issuer_permitted_status_declared (boolean, optional)
- last_report_ref (string, optional)
- position_size (integer, optional)
- relied_on_version (string, optional)
- relief_regime (string, optional)
- revocation_capital_charge (integer, optional)
- revocation_capital_delta (integer, optional)
- revocation_charge_pct (integer, optional)
- revocation_eligible_without_relief (boolean, optional)
- revocation_eligible_without_relief_declared (boolean, optional)
- revocation_exposure_material (boolean, optional)
- version_stale (boolean, optional)

## Sample

```json
{
  "relief_regime": "conditional_no_action_relief",
  "relied_on_version": "2026-03-01",
  "condition_set": {
    "version": "2026-03-01",
    "conditions": [
      {
        "condition_id": "COND-01",
        "description": "Reserve attestation filed for the period",
        "evidence_status": "met"
      },
      {
        "condition_id": "COND-02",
        "description": "Issuer remains on the declared permitted list",
        "evidence_status": "met"
      },
      {
        "condition_id": "COND-03",
        "description": "Daily valuation reported to the declared cadence",
        "evidence_status": "met"
      }
    ]
  },
  "asset_class": "payment_stablecoin",
  "issuer_permitted_status": true,
  "declared_valuation": 5000000,
  "declared_haircut_pct": 2,
  "declared_reporting_cadence": "daily",
  "last_report_ref": "RPT-2026-07-31-001",
  "position_size": 5000000,
  "capital_charge_table": [
    {
      "asset_class": "payment_stablecoin",
      "charge_pct": 8
    },
    {
      "asset_class": "tokenized_treasury",
      "charge_pct": 2
    }
  ],
  "revocation_charge_pct": 100,
  "revocation_eligible_without_relief": true,
  "as_of": "2026-07-31T23:59:59Z"
}
```

## Verify

Run the sample policy_parameters through MCP tool `build_conditional_relief_collateral_receipt` at https://mcp.ainumbers.co/mcp (or the page form) and check the returned receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.
