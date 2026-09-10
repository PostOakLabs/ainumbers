# Call Report Schedule RC (Balance Sheet) Mapper

Maps caller-declared FFIEC Call Report (FFIEC 031) Schedule RC line items - cash, securities, loans and leases, other assets; deposits, borrowings, other liabilities; common stock, surplus, retained earnings, AOCI - into Schedule RC totals (Total assets RCON2170, Total liabilities RCON2948, Total equity capital RCON3210, real public MDRM item codes) and checks the RC balance-sheet identity (Total assets == Total liabilities + Total equity capital) within a caller-set rounding tolerance. Not a filer - produces evidence artifacts and form-shaped totals only, never a submission. Line-item values are caller-declared from the institution's own books; this tool performs only arithmetic aggregation and the identity check, never estimation or audit of individual line items. Feeds art-433 (Schedule RC-R capital) and art-434 (Call Report edit-check gate) for cross-schedule validation. Not for Y-9C (see the separate Y-9C kernel, which uses instruction-text-encoded edits, not a public taxonomy).

- Page: https://ainumbers.co/chaingraph/art-432-call-report-rc-balance-sheet.html
- Markdown twin: https://ainumbers.co/chaingraph/art-432-call-report-rc-balance-sheet.md
- MCP tool: map_call_report_schedule_rc (endpoint https://mcp.ainumbers.co/mcp)

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
- total_assets_mdrm (string, optional)
- total_assets_usd (integer, optional)
- total_equity_capital_mdrm (string, optional)
- total_equity_capital_usd (integer, optional)
- total_liabilities_and_equity_usd (integer, optional)
- total_liabilities_mdrm (string, optional)
- total_liabilities_usd (integer, optional)
- xbrl_json_annex1_note (string, optional)

## Sample

```json
{
  "entity_id": "FDIC-CERT-3510",
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

Run the sample policy_parameters through MCP tool `map_call_report_schedule_rc` at https://mcp.ainumbers.co/mcp (or the page form) and check the returned receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.
