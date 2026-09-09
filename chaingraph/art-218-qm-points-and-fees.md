# QM Points and Fees Test

Qualified Mortgage points-and-fees test per Reg Z §1026.43(e)(3). Applies version-pinned 2021-2026 tier table with Federal Register citations. Covers five tiers: 3% for loans over tier-1 minimum, fixed dollar amounts for mid-range loans, 5% and 8% for smaller loans. Agents hallucinate current-year thresholds; this node supplies authoritative version-pinned values.

- Page: https://ainumbers.co/chaingraph/art-218-qm-points-and-fees.html
- Markdown twin: https://ainumbers.co/chaingraph/art-218-qm-points-and-fees.md
- MCP tool: check_qm_points_and_fees (endpoint https://mcp.ainumbers.co/mcp)

## Inputs

- loan_amount (number, optional)
- points_and_fees (number, optional)
- year (number, optional)

## Outputs

- effective_date (string, optional)
- fr_citation (string, optional)
- headroom (integer, optional)
- limit (integer, optional)
- limit_fixed (string, optional)
- limit_pct (integer, optional)
- limit_type (string, optional)
- loan_amount (integer, optional)
- note (string, optional)
- pass (boolean, optional)
- points_and_fees (integer, optional)
- regulatory_basis (string, optional)
- tier_label (string, optional)
- year (integer, optional)

## Sample

```json
{
  "loan_amount": 450000,
  "points_and_fees": 12000,
  "year": 2026
}
```

## Verify

Run the sample policy_parameters through MCP tool `check_qm_points_and_fees` at https://mcp.ainumbers.co/mcp (or the page form) and check the returned receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.
