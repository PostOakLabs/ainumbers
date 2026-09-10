# FR Y-9C Schedule HC-R (Regulatory Capital) Calculator

Given caller-supplied CET1/Tier1/Tier2 capital components and risk-weighted assets, computes FR Y-9C Schedule HC-R standard capital ratios plus the supplementary leverage ratio (SLR), including the enhanced-SLR (eSLR) buffer effective 2026-04-01 (§0.2), for top-tier bank holding companies (Y-9C panel = total consolidated assets >= $3B). Schedule mapping and ratio-calculation logic mirrors art-433 (Call Report Schedule RC-R) 1:1 - same thresholds, same eSLR buffer treatment; only report_form and entity type (consolidated holding company vs insured depository institution) differ. NO public XBRL edit taxonomy exists for Y-9C (§0.2) - capital-component field names mirror the FR Y-9/FFIEC BHCK consolidated mnemonic convention, hand-encoded from FR Y-9C instruction text. BOUNDARY: capital component and RWA values are caller-declared; this tool performs only ratio arithmetic and threshold comparison against caller-declared, version-pinned minimums - it does not calculate risk weights, classify exposures, or derive GSIB status. Not a filer - produces evidence artifacts only, never a submission.

- Page: https://ainumbers.co/chaingraph/art-436-bhc-schedule-hcr-capital.html
- Markdown twin: https://ainumbers.co/chaingraph/art-436-bhc-schedule-hcr-capital.md
- MCP tool: map_bhc_schedule_hcr (endpoint https://mcp.ainumbers.co/mcp)

## Inputs

- additional_tier1_capital_usd (number, optional): Amount in US dollars
- cet1_capital_usd (number, optional): Amount in US dollars
- cet1_min_pct (number, optional): Percentage value
- constants_version (unknown, required)
- entity_id (unknown, required)
- eslr_buffer_pct (number, optional): Percentage value
- is_gsib (boolean, required)
- reporting_period (unknown, required)
- slr_min_pct (number, optional): Percentage value
- tier1_capital_usd (number, required): Amount in US dollars
- tier1_min_pct (number, optional): Percentage value
- tier2_capital_usd (number, optional): Amount in US dollars
- total_capital_min_pct (number, optional): Percentage value
- total_leverage_exposure_usd (number, optional): Amount in US dollars
- total_rwa_usd (number, optional): Amount in US dollars

## Outputs

- additional_tier1_capital_usd (integer, optional)
- boundary_note (string, optional)
- cet1_capital_usd (integer, optional)
- constants_version (string, optional)
- entity_id (string, optional)
- eslr (object, optional)
- is_gsib (boolean, optional)
- ratios (object, optional)
- report_form (string, optional)
- reporting_period (string, optional)
- schedule (string, optional)
- taxonomy_note (string, optional)
- tier1_capital_usd (integer, optional)
- tier2_capital_usd (integer, optional)
- total_capital_usd (integer, optional)
- total_leverage_exposure_usd (integer, optional)
- total_rwa_usd (integer, optional)

## Sample

```json
{
  "entity_id": "RSSD-1073757",
  "reporting_period": "2026-03-31",
  "constants_version": "basel3-std-2026.1",
  "is_gsib": false,
  "cet1_capital_usd": 220000000,
  "additional_tier1_capital_usd": 10000000,
  "tier2_capital_usd": 15000000,
  "total_rwa_usd": 1800000000,
  "total_leverage_exposure_usd": 2700000000
}
```

## Verify

Run the sample policy_parameters through MCP tool `map_bhc_schedule_hcr` at https://mcp.ainumbers.co/mcp (or the page form) and check the returned receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.
