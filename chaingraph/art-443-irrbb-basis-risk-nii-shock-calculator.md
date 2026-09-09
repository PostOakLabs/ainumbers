# IRRBB Basis-Risk NII Shock Calculator

Comptroller's Handbook IRR basis-risk delta-NII calculator: sweeps a single reference-rate shock across multiple priced indices (Prime, SOFR, Fed Funds, CD portfolio, etc.), each with a caller-declared historical beta vs the reference rate, and isolates the incremental delta-NII from indices not moving in lockstep. Distinct from art-369 (Rate Shock Ladder Replay), whose parallel-curve convention assumes one shock moves the entire gap schedule uniformly and cannot see basis risk. Complements art-369 and art-442 as the third leg of a full NII/EVE-shock toolkit. NaN-safe. Zero network, zero PII.

- Page: https://ainumbers.co/chaingraph/art-443-irrbb-basis-risk-nii-shock-calculator.html
- Markdown twin: https://ainumbers.co/chaingraph/art-443-irrbb-basis-risk-nii-shock-calculator.md
- MCP tool: calculate_basis_risk_nii_shock (endpoint https://mcp.ainumbers.co/mcp)

## Inputs

- horizon_months (unknown, required)
- index_exposures (array, required)
- material_threshold_pct (unknown, required): Percentage value
- reference_shock_bps (unknown, required): Amount in basis points

## Outputs

- basis_risk_delta_nii (integer, optional)
- basis_risk_pct_of_parallel (number, optional)
- convention (string, optional)
- horizon_months (integer, optional)
- index_results (array, optional)
- is_material (boolean, optional)
- material_threshold_pct (number, optional)
- parallel_delta_nii (integer, optional)
- reference_shock_bps (integer, optional)
- total_net_exposure (integer, optional)
- total_nii_contribution (integer, optional)

## Sample

```json
{
  "index_exposures": [
    {
      "index_name": "prime",
      "asset_balance": 2000000,
      "liability_balance": 0,
      "beta_vs_reference": 1
    },
    {
      "index_name": "sofr",
      "asset_balance": 500000,
      "liability_balance": 0,
      "beta_vs_reference": 0.9
    },
    {
      "index_name": "cd_portfolio",
      "asset_balance": 0,
      "liability_balance": 1000000,
      "beta_vs_reference": 0.5
    }
  ],
  "reference_shock_bps": 100,
  "horizon_months": 12
}
```

## Verify

Run the sample policy_parameters through MCP tool `calculate_basis_risk_nii_shock` at https://mcp.ainumbers.co/mcp (or the page form) and check the returned receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.
