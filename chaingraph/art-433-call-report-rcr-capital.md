# Call Report Schedule RC-R (Regulatory Capital) Mapper

Maps caller-declared FFIEC Call Report (FFIEC 031) Schedule RC-R regulatory-capital components - CET1, additional Tier 1, Tier 2 capital, total risk-weighted assets, total leverage exposure - into the standard capital ratios (CET1, Tier 1, Total capital, supplementary leverage ratio) and the 2026-04-01 eSLR final rule's GSIB buffer requirement (§0.2), each checked against caller-declared, version-pinned minimums. Not a filer - produces evidence artifacts and form-shaped totals only, never a submission. Capital-component and RWA values are caller-declared; this tool performs only ratio arithmetic and threshold comparison, never risk-weight calculation, exposure classification, or GSIB-status derivation. Feeds art-434 (Call Report edit-check gate) for cross-schedule validation against art-432 (Schedule RC). Not for Y-9C HC-R (see the separate Y-9C kernel).

- Page: https://ainumbers.co/chaingraph/art-433-call-report-rcr-capital.html
- Markdown twin: https://ainumbers.co/chaingraph/art-433-call-report-rcr-capital.md
- MCP tool: map_call_report_schedule_rcr (endpoint https://mcp.ainumbers.co/mcp)

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
- mdrm_note (string, optional)
- ratios (object, optional)
- report_form (string, optional)
- reporting_period (string, optional)
- schedule (string, optional)
- tier1_capital_usd (integer, optional)
- tier2_capital_usd (integer, optional)
- total_capital_usd (integer, optional)
- total_leverage_exposure_usd (integer, optional)
- total_rwa_usd (integer, optional)

## Sample

```json
{
  "entity_id": "FDIC-CERT-3510",
  "reporting_period": "2026-03-31",
  "constants_version": "2026-07-23.basel3-standardized-v1",
  "is_gsib": false,
  "cet1_capital_usd": 186870000,
  "additional_tier1_capital_usd": 0,
  "tier2_capital_usd": 15731000,
  "total_rwa_usd": 1535559000,
  "total_leverage_exposure_usd": 2672192000
}
```

## Verify

Run the sample policy_parameters through MCP tool `map_call_report_schedule_rcr` at https://mcp.ainumbers.co/mcp (or the page form) and check the returned receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.
