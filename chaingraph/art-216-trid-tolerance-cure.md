# TRID Fee Tolerance and Cure

TRID fee tolerance analysis and cure calculation per Reg Z §1026.19(e)(3). Each closing fee arrives with its tolerance bucket already assigned by the caller (zero-tolerance, ten-percent cumulative, or no-tolerance-limit); this node does not derive that membership, because the §1026.19(e)(3)(ii)(A)-(C) tests turn on provider identity, whether the consumer was permitted to shop for the provider, and creditor-affiliate status, and none of those facts are inputs here. Computes 10% bucket aggregate overage, identifies violations, and returns the cure amount required to make the consumer whole under TRID. The §1026.19(e)(3)(iv)(A)-(F) grounds for a revised estimate (changed circumstance affecting settlement charges, changed circumstance affecting eligibility, consumer-requested revision, interest-rate-dependent charges, expiration of the estimate, and delayed settlement on a construction loan) are not distinguished from one another: each fee carries one caller-declared changed-circumstance boolean, and which ground supports it is outside scope.

- Page: https://ainumbers.co/chaingraph/art-216-trid-tolerance-cure.html
- Markdown twin: https://ainumbers.co/chaingraph/art-216-trid-tolerance-cure.md
- MCP tool: compute_trid_tolerance_cure (endpoint https://mcp.ainumbers.co/mcp)

## Inputs

- fees (array, required)

## Outputs

- cure_amount (integer, optional)
- cure_required (boolean, optional)
- fee_analysis (array, optional)
- note (string, optional)
- regulatory_basis (string, optional)
- ten_pct_bucket_increase (integer, optional)
- ten_pct_bucket_le_sum (integer, optional)
- ten_pct_excess (integer, optional)
- ten_pct_threshold (integer, optional)
- ten_pct_violation (boolean, optional)
- total_violations (integer, optional)
- violations (array, optional)
- zero_tolerance_violations (integer, optional)

## Sample

```json
{
  "fees": [
    {
      "name": "origination_fee",
      "bucket": "zero_tolerance",
      "le_amount": 1500,
      "cd_amount": 1500
    },
    {
      "name": "appraisal",
      "bucket": "ten_pct_cumulative",
      "le_amount": 600,
      "cd_amount": 640
    },
    {
      "name": "title_service",
      "bucket": "ten_pct_cumulative",
      "le_amount": 1200,
      "cd_amount": 1250
    },
    {
      "name": "hazard_insurance",
      "bucket": "no_tolerance_limit",
      "le_amount": 900,
      "cd_amount": 1100
    }
  ]
}
```

## Verify

Run the sample policy_parameters through MCP tool `compute_trid_tolerance_cure` at https://mcp.ainumbers.co/mcp (or the page form) and check the returned receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.
