# Call Report Published Edit-Check Gate

Runs a curated battery of FFIEC-style published Call Report edit checks - balance-sheet identity, capital-stack ordering (CET1 <= Tier 1 <= Total capital), ratio-vs-component consistency, cross-schedule entity/period match - against art-432 (Schedule RC) and art-433 (Schedule RC-R) output payloads, the same class of check FFIEC's own edit-check system runs against filed data before CDR publication. Emits a per-check pass/fail verdict list plus an overall gate_status (auto_pass | review_required) using the §27 Human Accountability gate-policy vocabulary, so this node can sit directly ahead of a §27 dual_control/review_required gate on downstream export or submission-evidence chains. Curated representative battery, not the FFIEC's full published edit-check catalog (thousands of checks) - does not claim FFIEC edit-check completeness. Not a filer - produces evidence artifacts only, never a submission.

- Page: https://ainumbers.co/chaingraph/art-434-call-report-edit-check-gate.html
- Markdown twin: https://ainumbers.co/chaingraph/art-434-call-report-edit-check-gate.md
- MCP tool: run_call_report_edit_checks (endpoint https://mcp.ainumbers.co/mcp)

## Inputs

- rc_output_payload (boolean, required)
- rcr_output_payload (boolean, required)
- rounding_tolerance_usd (number, optional): Amount in US dollars

## Outputs

- all_fatal_passed (boolean, optional)
- check_count (integer, optional)
- checks (array, optional)
- coverage_note (string, optional)
- entity_id (string, optional)
- fatal_failure_count (integer, optional)
- gate_status (string, optional)
- report_form (string, optional)
- reporting_period (string, optional)
- rounding_tolerance_usd (integer, optional)
- warning_failure_count (integer, optional)

## Sample

```json
{
  "rounding_tolerance_usd": 1,
  "rc_output_payload": {
    "entity_id": "FDIC-CERT-3510",
    "reporting_period": "2026-03-31",
    "report_form": "FFIEC 031",
    "schedule": "RC",
    "assets": [
      {
        "key": "cash_and_due_from_usd",
        "mdrm": "RCON0071",
        "label": "Cash and balances due from depository institutions",
        "value_usd": 226409000
      },
      {
        "key": "securities_htm_usd",
        "mdrm": "RCON1754",
        "label": "Held-to-maturity securities",
        "value_usd": 0
      },
      {
        "key": "securities_afs_usd",
        "mdrm": "RCON1773",
        "label": "Available-for-sale securities",
        "value_usd": 864213000
      },
      {
        "key": "loans_and_leases_net_usd",
        "mdrm": "RCON2122",
        "label": "Total loans and leases, net of unearned income and allowance",
        "value_usd": 1191560000
      },
      {
        "key": "bank_premises_usd",
        "mdrm": "RCON2145",
        "label": "Bank premises and fixed assets",
        "value_usd": 21670000
      },
      {
        "key": "other_assets_usd",
        "mdrm": "RCON2160",
        "label": "Other assets",
        "value_usd": 368340000
      }
    ],
    "total_assets_usd": 2672192000,
    "total_assets_mdrm": "RCON2170",
    "liabilities": [
      {
        "key": "total_deposits_usd",
        "mdrm": "RCON2200",
        "label": "Total deposits",
        "value_usd": 2128004000
      },
      {
        "key": "borrowings_usd",
        "mdrm": "RCON2800",
        "label": "Total borrowings",
        "value_usd": 250000000
      },
      {
        "key": "other_liabilities_usd",
        "mdrm": "RCON2930",
        "label": "Other liabilities",
        "value_usd": 52478000
      }
    ],
    "total_liabilities_usd": 2430482000,
    "total_liabilities_mdrm": "RCON2948",
    "equity": [
      {
        "key": "common_stock_usd",
        "mdrm": "RCON3230",
        "label": "Common stock",
        "value_usd": 3020000
      },
      {
        "key": "surplus_usd",
        "mdrm": "RCON3839",
        "label": "Surplus",
        "value_usd": 177631000
      },
      {
        "key": "retained_earnings_usd",
        "mdrm": "RCON3632",
        "label": "Retained earnings",
        "value_usd": 61059000
      },
      {
        "key": "aoci_usd",
        "mdrm": "RCON3216",
        "label": "Accumulated other comprehensive income",
        "value_usd": 0
      }
    ],
    "total_equity_capital_usd": 241710000,
    "total_equity_capital_mdrm": "RCON3210",
    "total_liabilities_and_equity_usd": 2672192000,
    "identity_delta_usd": 0,
    "identity_balanced": true,
    "rounding_tolerance_usd": 1,
    "boundary_note": "Line-item values are caller-declared from the institution's own books; this kernel performs only the arithmetic aggregation into Schedule RC totals and the Total assets == Total liabilities + Total equity capital identity check. It does not derive, estimate, or audit any individual line item.",
    "xbrl_json_annex1_note": "MDRM concept codes above (RCON2170/RCON2948/RCON3210) align with the §13.13 xBRL-JSON export profile's Annex 1 FFIEC Call Report mapping; rendering to that profile is a separate exporter work unit, not performed by this kernel."
  },
  "rcr_output_payload": {
    "entity_id": "FDIC-CERT-3510",
    "reporting_period": "2026-03-31",
    "report_form": "FFIEC 031",
    "schedule": "RC-R",
    "constants_version": "2026-07-23.basel3-standardized-v1",
    "is_gsib": false,
    "cet1_capital_usd": 186870000,
    "additional_tier1_capital_usd": 0,
    "tier1_capital_usd": 186870000,
    "tier2_capital_usd": 15731000,
    "total_capital_usd": 202601000,
    "total_rwa_usd": 1535559000,
    "total_leverage_exposure_usd": 2672192000,
    "ratios": {
      "cet1_ratio_pct": 0.121695,
      "cet1_min_pct": 0.045,
      "cet1_pass": true,
      "tier1_ratio_pct": 0.121695,
      "tier1_min_pct": 0.06,
      "tier1_pass": true,
      "total_capital_ratio_pct": 0.13194,
      "total_capital_min_pct": 0.08,
      "total_capital_pass": true,
      "supplementary_leverage_ratio_pct": 0.069931,
      "slr_min_pct": 0.03,
      "slr_pass": true
    },
    "eslr": {
      "applicable": false,
      "buffer_pct": 0,
      "required_slr_pct": null,
      "pass": true,
      "final_rule_citation": "eSLR final rule, published 2025-12-01, effective 2026-04-01 (§0.2)"
    },
    "boundary_note": "Capital component and RWA values are caller-declared; this kernel performs only ratio arithmetic and threshold comparison against caller-declared, version-pinned minimums. It does not calculate risk weights, classify exposures, or derive GSIB status.",
    "mdrm_note": "Schedule RC-R MDRM item prefixes vary by advanced vs. standardized approach and reporting vintage; capital-component field names here mirror the FDIC BankFind Suite mnemonics (RBCT1J tier1, RBCT2 tier2, RWAJT total RWA), which the FDIC itself derives from filed Call Report Schedule RC-R submissions."
  }
}
```

## Verify

Run the sample policy_parameters through MCP tool `run_call_report_edit_checks` at https://mcp.ainumbers.co/mcp (or the page form) and check the returned receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.
