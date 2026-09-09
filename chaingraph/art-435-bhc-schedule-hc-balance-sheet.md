# FR Y-9C Schedule HC (Consolidated Balance Sheet) Mapper

Maps caller-declared FR Y-9C (Financial Statements for Holding Companies) Schedule HC line items - cash, securities, loans and leases, other assets; deposits, borrowings, other liabilities; common stock, surplus, retained earnings, AOCI - into Schedule HC totals (Total assets BHCK2170, Total liabilities BHCK2948, Total equity capital BHCK3210, real public MDRM item codes shared with the Call Report Schedule RC schema under the BHCK consolidated-holding-company prefix) and checks the HC balance-sheet identity within a caller-set rounding tolerance. Y-9C panel = top-tier bank holding companies with total consolidated assets >= $3B (§0.2). NO public XBRL edit taxonomy exists for Y-9C (FFIEC CDR taxonomy covers Call Reports 031/041/051 + UBPR only) - edits are hand-encoded from FR Y-9C instruction text, not sourced from a machine-readable taxonomy. Schedule mapping logic mirrors art-432 (Call Report Schedule RC) 1:1; only the MDRM prefix (BHCK vs RCON) and report_form differ. Not a filer - produces evidence artifacts and form-shaped totals only, never a submission. Line-item values are caller-declared from the holding company's own books; this tool performs only arithmetic aggregation and the identity check, never estimation or audit of individual line items. Feeds art-436 (Schedule HC-R capital).

- Page: https://ainumbers.co/chaingraph/art-435-bhc-schedule-hc-balance-sheet.html
- Markdown twin: https://ainumbers.co/chaingraph/art-435-bhc-schedule-hc-balance-sheet.md
- MCP tool: map_bhc_schedule_hc (endpoint https://mcp.ainumbers.co/mcp)

## Inputs

- entity_id (unknown, required)
- reporting_period (unknown, required)
- rounding_tolerance_usd (number, optional): Amount in US dollars

## Outputs

- assets (array, optional)
- boundary_note (string, optional)
- entity_id (string, optional)
- equity (array, optional)
- identity_balanced (boolean, optional)
- identity_delta_usd (integer, optional)
- liabilities (array, optional)
- report_form (string, optional)
- reporting_period (string, optional)
- rounding_tolerance_usd (integer, optional)
- schedule (string, optional)
- taxonomy_note (string, optional)
- total_assets_mdrm (string, optional)
- total_assets_usd (integer, optional)
- total_equity_capital_mdrm (string, optional)
- total_equity_capital_usd (integer, optional)
- total_liabilities_and_equity_usd (integer, optional)
- total_liabilities_mdrm (string, optional)
- total_liabilities_usd (integer, optional)

## Sample

```json
{
  "entity_id": "RSSD-1073757",
  "reporting_period": "2026-03-31",
  "rounding_tolerance_usd": 1,
  "cash_and_due_from_usd": 226409000,
  "securities_htm_usd": 0,
  "securities_afs_usd": 864213000,
  "loans_and_leases_net_usd": 1191560000,
  "bank_premises_usd": 21670000,
  "other_assets_usd": 368340000,
  "total_deposits_usd": 2128004000,
  "borrowings_usd": 250000000,
  "other_liabilities_usd": 52478000,
  "common_stock_usd": 3020000,
  "surplus_usd": 177631000,
  "retained_earnings_usd": 61059000,
  "aoci_usd": 0
}
```

## Verify

Run the sample policy_parameters through MCP tool `map_bhc_schedule_hc` at https://mcp.ainumbers.co/mcp (or the page form) and check the returned receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.
