# Compute HMDA Rate Spread

Computes the HMDA rate spread (APR minus APOR) per FFIEC methodology and classifies against HMDA reportability thresholds: 1.5 pp (first lien), 3.5 pp (subordinate lien), 6.5 pp (HELOC). Outputs rate_spread_pct, lien classification, is_reportable flag, and HPML indicator (1.5 pp first / 3.5 pp sub, triggers escrow and appraisal requirements under TILA). Table version: FFIEC-RATE-SPREAD-METHODOLOGY-2023.

- Page: https://ainumbers.co/chaingraph/art-230-compute-hmda-rate-spread.html
- Markdown twin: https://ainumbers.co/chaingraph/art-230-compute-hmda-rate-spread.md
- MCP tool: compute_hmda_rate_spread (endpoint https://mcp.ainumbers.co/mcp)

## Inputs

- apor_pct (number, optional): Percentage value
- apr_pct (number, optional): Percentage value
- lien_type (unknown, required)
- lock_date (unknown, required)
- product_type (unknown, required)

## Outputs

- apor_pct (number, optional)
- apor_source_note (string, optional)
- apr_pct (integer, optional)
- hmda_report_code (string, optional)
- is_reportable (boolean, optional)
- lien_type (string, optional)
- lock_date (string, optional)
- pii_note (string, optional)
- product_type (string, optional)
- rate_spread_pct (number, optional)
- regulatory_basis (string, optional)
- reportability_threshold_pct (number, optional)
- table_source (string, optional)
- table_version (string, optional)

## Sample

```json
{
  "apr_pct": 7,
  "apor_pct": 5.5,
  "lien_type": "first",
  "product_type": "closed_end",
  "lock_date": "2026-01-15"
}
```

## Verify

Run the sample policy_parameters through MCP tool `compute_hmda_rate_spread` at https://mcp.ainumbers.co/mcp (or the page form) and check the returned receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.
