# Claims STP Economics Calculator

Computes the financial business case for insurance claims Straight-Through Processing (STP) automation. Models handling cost reduction from current to target STP rates, leakage delta (change in claim payment leakage from automated vs manual handling), net annual benefit, NPV over a configurable projection horizon, IRR, and per-claim cost reduction. Covers industry benchmarks from McKinsey Insurance 2024, Accenture Claims Transformation 2025, and Majesco Claims Technology Survey 2024. Use in insurer-rbc-action-level chain (downstream when capital below 200% ACL triggers corrective action). ZERO PII: aggregate portfolio metrics only.

- Page: https://ainumbers.co/chaingraph/art-257-calculate-claims-stp-economics.html
- Markdown twin: https://ainumbers.co/chaingraph/art-257-calculate-claims-stp-economics.md
- MCP tool: calculate_claims_stp_economics (endpoint https://mcp.ainumbers.co/mcp)

## Inputs

- annual_claims_volume (unknown, required)
- annual_license_cost (unknown, required)
- automated_handling_cost (unknown, required)
- average_claim_payment (unknown, required)
- current_stp_rate_pct (unknown, required): Percentage value
- discount_rate_pct (unknown, required): Percentage value
- implementation_cost (unknown, required)
- leakage_rate_manual_pct (unknown, required): Percentage value
- leakage_rate_stp_pct (unknown, required): Percentage value
- manual_handling_cost (unknown, required)
- projection_years (unknown, required)
- target_stp_rate_pct (unknown, required): Percentage value

## Outputs

- annual_cashflows (array, optional)
- annual_handling_savings (integer, optional)
- cost_reduction_pct (number, optional)
- cost_reduction_per_claim (number, optional)
- current_annual_cost (integer, optional)
- current_avg_cost_per_claim (integer, optional)
- current_manual_claims (integer, optional)
- current_stp_claims (integer, optional)
- discount_rate_pct (integer, optional)
- irr_pct (number, optional)
- leakage_increase (integer, optional)
- leakage_reduction (integer, optional)
- net_annual_benefit (integer, optional)
- net_leakage_impact (integer, optional)
- not_legal_advice (string, optional)
- npv (number, optional)
- payback_years (number, optional)
- pii_note (string, optional)
- projection_years (integer, optional)
- regulatory_basis (string, optional)
- stp_rate_improvement_ppt (integer, optional)
- table_source (string, optional)
- table_version (string, optional)
- target_annual_cost (integer, optional)
- target_avg_cost_per_claim (number, optional)
- target_manual_claims (integer, optional)
- target_stp_claims (integer, optional)

## Sample

```json
{
  "annual_claims_volume": 100000,
  "current_stp_rate_pct": 40,
  "target_stp_rate_pct": 75,
  "manual_handling_cost": 180,
  "automated_handling_cost": 25,
  "implementation_cost": 5000000,
  "annual_license_cost": 500000,
  "discount_rate_pct": 10,
  "projection_years": 5
}
```

## Verify

Run the sample policy_parameters through MCP tool `calculate_claims_stp_economics` at https://mcp.ainumbers.co/mcp (or the page form) and check the returned receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.
