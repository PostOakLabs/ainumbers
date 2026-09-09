# EMIR 3.0 Active Account Representativeness Classifier

Classifies an EU counterparty's posture under EMIR Article 7a (the Active Account Requirement, inserted by Regulation (EU) 2024/2987) across three obligations: whether the active-account obligation applies and is met at an Article-14-authorised CCP; whether the Article 7a(4) representativeness obligation applies, is exempt below the EUR 6 billion notional-clearing-volume threshold, or is met by clearing at least five trades on an annual average basis in each caller-declared most-relevant subcategory per class; and whether a reporting submission falls within the applicable Commission Delegated Regulation (EU) 2026/305 Article 10 window (last day of January or July, first cycle anchored to the stated 2026-07-31 report). Subcategories are bucketed deterministically from caller-declared trade size and maturity against the RTS Annex I tables for EUR fixed-to-float, OIS and FRA, PLN fixed-to-float and FRA (single any/any bucket), and EUR STIR Euribor and euro short-term rate. Which subcategories are ESMA's market-wide most-relevant designation is not derivable from one counterparty's own trades and is taken as a caller-declared input, named in the artifact's not_proven list. Each obligation resolves to MET, NOT_MET, EXEMPT, or INDETERMINATE, and INDETERMINATE covers every case where a required input - clearing-threshold exceedance, active-account status, notional volume, subcategory designation, or reporting date - was not declared; none is guessed toward a passing verdict. Cites Article 7a EMIR and Commission Delegated Regulation (EU) 2026/305, re-verified against EUR-Lex at build. Existing EMIR coverage on this site is trade-report field, lifecycle, UTI and UPI validation only; this is a distinct Active Account Requirement self-check, not a duplicate. Stated boundary: this is not legal advice, and does not independently verify that a declared trade actually cleared or that the counterparty genuinely exceeds the Article 4a clearing threshold.

- Page: https://ainumbers.co/chaingraph/art-576-emir3-active-account-representativeness-classifier.html
- Markdown twin: https://ainumbers.co/chaingraph/art-576-emir3-active-account-representativeness-classifier.md
- MCP tool: classify_emir3_active_account_status (endpoint https://mcp.ainumbers.co/mcp)

## Inputs

- active_account (unknown, required)
- as_of_date (unknown, required)
- clearing_threshold_exceeded (unknown, required)
- counterparty_ref (unknown, required)
- notional_clearing_volume_minor_units (unknown, required)
- reference_period_months (number, required)
- reporting_submission_date (unknown, required)
- subcategory_designations (unknown, required)
- trades (unknown, required)

## Outputs

- as_of_date (string, optional)
- bucket_counts (object, optional)
- citations (object, optional)
- counterparty_ref (string, optional)
- fence (string, optional)
- in_scope (object, optional)
- not_proven (array, optional)
- note (string, optional)
- obligations (object, optional)
- rationale (array, optional)
- rejected_inputs (array, optional)
- subcategory_designations (array, optional)
- trades_classified (array, optional)

## Sample

```json
{
  "counterparty_ref": "SYNTH-CP-001",
  "as_of_date": "2026-08-07",
  "clearing_threshold_exceeded": {
    "eur_pln_ird": false,
    "eur_stir": false
  },
  "active_account": {},
  "trades": [],
  "subcategory_designations": []
}
```

## Verify

Run the sample policy_parameters through MCP tool `classify_emir3_active_account_status` at https://mcp.ainumbers.co/mcp (or the page form) and check the returned receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.
