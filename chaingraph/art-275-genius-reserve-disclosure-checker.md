# GENIUS Act Monthly Reserve Disclosure Checker

Lints an extracted monthly reserve disclosure against GENIUS Act S.394 §4: composition-category eligibility, tenor, custody locations, a dual_control(2) CEO/CFO certification gate (distinct CEO and CFO identities required, per FDIC NPR 2026-04-10 and OCG SPEC.md §27.3), registered-examiner presence, month-over-month diff, and an on-chain supply cross-check against a pasted figure. Successor to the pre-issuance precheck_reserve_attestation (art-06): that tool is the pre-issuance readiness gate, this is the recurring post-issuance monthly filing check. Never claims cryptographic verification of the source PDF.

- Page: https://ainumbers.co/chaingraph/art-275-genius-reserve-disclosure-checker.html
- Markdown twin: https://ainumbers.co/chaingraph/art-275-genius-reserve-disclosure-checker.md
- MCP tool: check_genius_reserve_disclosure (endpoint https://mcp.ainumbers.co/mcp)

## Inputs

- assets (unknown, required)
- certifying_officers (unknown, required)
- examiner_name (unknown, optional)
- issuer_type (unknown, optional)
- onchain_supply_check (unknown, optional)
- outstanding_tokens_reported (number, optional)
- prior_month (unknown, optional)
- registered_examiner_named (boolean, required)
- report_month (unknown, optional)
- token_price (number, optional)

## Outputs

- applicable_deadline (string, optional)
- asset_results (array, optional)
- ceo_certified (boolean, optional)
- cfo_certified (boolean, optional)
- conditional_assets_usd (integer, optional)
- coverage_ratio_pct (integer, optional)
- custody_disclosed (boolean, optional)
- custody_locations (array, optional)
- dual_control_satisfied (boolean, optional)
- examiner_name (string, optional)
- failing_dimensions (array, optional)
- gate_policy (string, optional)
- mom_diff (string, optional)
- monthly_disclosure_determination (string, optional)
- onchain_supply_check (object, optional)
- pdf_extraction_note (string, optional)
- prohibited_assets_usd (integer, optional)
- registered_examiner_named (boolean, optional)
- regulatory_framework (string, optional)
- report_month (string, optional)
- reserve_shortfall_usd (integer, optional)
- total_liabilities_usd (integer, optional)
- total_reserves_usd (integer, optional)

## Sample

```json
{}
```

## Verify

Run the sample policy_parameters through MCP tool `check_genius_reserve_disclosure` at https://mcp.ainumbers.co/mcp (or the page form) and check the returned receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.
