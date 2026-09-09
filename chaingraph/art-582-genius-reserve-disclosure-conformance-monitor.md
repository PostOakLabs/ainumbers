# GENIUS Act Reserve-Disclosure Conformance Monitor

Checks a monthly PPSI reserve disclosure against two statute-derived GENIUS Act S.394 §4 requirements: 1:1 reserve coverage arithmetic and attestation presence/timeliness against the statutory monthly cadence. Verdict per requirement (MET/NOT_MET/INDETERMINATE). NARROWED 2026-08-07: the permitted-asset composition check is out of scope because no final GENIUS Act implementing regulation exists as of that date (all OCC/FDIC/Treasury/FinCEN/NCUA instruments remain NPRM/ANPRM). Never claims final-rule attribution or compliance certification. Cross-links the shipped pre-issuance precheck_reserve_attestation (art-06) and the fuller check_genius_reserve_disclosure (art-275).

- Page: https://ainumbers.co/chaingraph/art-582-genius-reserve-disclosure-conformance-monitor.html
- Markdown twin: https://ainumbers.co/chaingraph/art-582-genius-reserve-disclosure-conformance-monitor.md
- MCP tool: check_genius_reserve_disclosure_conformance (endpoint https://mcp.ainumbers.co/mcp)

## Inputs

- attestation_date (unknown, optional)
- attestation_present (boolean, required)
- examiner_name (unknown, optional)
- examiner_registered (boolean, required)
- onchain_supply_check (unknown, optional)
- outstanding_tokens_reported (number, optional)
- period_end_date (unknown, optional)
- report_period (unknown, optional)
- token_price (number, optional)
- total_reserves_usd (number, optional): Amount in US dollars

## Outputs

- attestation_date (string, optional)
- attestation_present (boolean, optional)
- coverage_ratio_pct (string, optional)
- days_after_period_end (string, optional)
- examiner_name (string, optional)
- examiner_registered (boolean, optional)
- onchain_supply_check (object, optional)
- overall_determination (string, optional)
- period_end_date (string, optional)
- report_period (string, optional)
- requirement_verdicts (array, optional)
- reserve_shortfall_usd (string, optional)
- scope_note (string, optional)
- statutory_attestation_window_days (integer, optional)
- total_liabilities_usd (integer, optional)
- total_reserves_usd (integer, optional)

## Sample

```json
{}
```

## Verify

Run the sample policy_parameters through MCP tool `check_genius_reserve_disclosure_conformance` at https://mcp.ainumbers.co/mcp (or the page form) and check the returned receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.
