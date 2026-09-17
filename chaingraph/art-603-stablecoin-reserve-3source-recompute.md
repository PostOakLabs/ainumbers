# Stablecoin Reserve 3-Source Recompute

Recomputes reserve ratio, weighted-average maturity (WAM), and per-holding GENIUS eligible-asset match from three independently-sourced, caller-declared legs, then reconciles them against each other, skew-gated on how far apart their as-of dates are. Leg A is the issuer's own published reserve report extended with a per-asset-class breakdown; Leg B is the EDGAR N-MFP Part 1 series-level summary for the government money-market fund holding reserves (never the Part 3 per-security schedule); Leg C is a declared on-chain supply figure. Each leg is optional at the type level and a missing leg drives every check that depends on it to INDETERMINATE, never a fabricated pass. Emits reserve-ratio, WAM-ceiling, and per-holding GENIUS eligible-asset verdicts in MET/NOT_MET/INDETERMINATE and MATCHES_CRITERION/DOES_NOT_MATCH/INDETERMINATE vocabulary, three cross-source reconcile checks in RECONCILED/DISCREPANT/INDETERMINATE vocabulary, and an overall_determination worst-of rollup. Not re-specifying the shipped art-582 (1:1 top-line coverage + report-timeliness only) or art-584 (Merkle-sum PoR consistency); this node is the granular per-asset-class recompute and cross-source reconcile neither of those covers. A RECOMPUTE only: never a solvency claim, never an audit, never a third-party sign-off, never 'satisfies GENIUS'. Per-holding GENIUS eligible-asset flags report criteria-match only, with the statutory catch-all item always INDETERMINATE and never auto-matched; there is no overall_eligibility field of any kind.

- Page: https://ainumbers.co/chaingraph/art-603-stablecoin-reserve-3source-recompute.html
- Markdown twin: https://ainumbers.co/chaingraph/art-603-stablecoin-reserve-3source-recompute.md
- MCP tool: recompute_stablecoin_reserve_3source (endpoint https://mcp.ainumbers.co/mcp)

## Inputs

- max_as_of_skew_days (number, optional)
- leg_a (object,null, optional)
- leg_b (object,null, optional)
- leg_c (object,null, optional)

## Outputs

- overall_determination (string, optional)
- leg_a (object, optional)
- leg_b (object, optional)
- leg_c (object, optional)
- max_as_of_skew_days_global (number,null, optional)
- as_of_skew_pairs (object, optional)
- as_of_skew_threshold_days (number, optional)
- reserve_ratio (object, optional)
- wam (object, optional)
- genius_eligible_holdings (array, optional)
- provisional_nprm_detail (array, optional)
- reconciles (array, optional)
- not_proven (array, optional)
- determination_note (string, optional)
- regulatory_framework (string, optional)

## Sample

```json
{
  "leg_a": {
    "report_period": "2027-02",
    "period_end_date": "2027-02-28",
    "as_of": "2027-02-28",
    "source_digest": "sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
    "total_reserves_usd": 1050000000,
    "outstanding_tokens_reported": 1000000000,
    "token_price": 1,
    "reserves_in_fund_fraction": 0.8,
    "asset_breakdown": [
      {
        "asset_class": "us_coin_and_currency",
        "amount_usd": 50000000,
        "maturity_bucket_days": 0
      },
      {
        "asset_class": "treasury_bill_93d_or_less",
        "amount_usd": 800000000,
        "maturity_bucket_days": 20,
        "institution": "US Treasury"
      },
      {
        "asset_class": "government_mmf_solely_foregoing",
        "amount_usd": 200000000,
        "maturity_bucket_days": 25,
        "institution": "Fund X"
      }
    ]
  },
  "leg_b": {
    "as_of": "2027-02-28",
    "source_digest": "sha256:bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
    "accession_number": "0001234567-27-000123",
    "total_net_assets": 840000000,
    "nav_per_share": 1,
    "shares_outstanding": 840000000,
    "wam_days": 21,
    "wal_days": 40,
    "filing_date": "2027-03-05"
  },
  "leg_c": {
    "as_of": "2027-02-28",
    "source_digest": "sha256:cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc",
    "onchain_supply": 1000200000
  }
}
```

## Verify

Run the sample policy_parameters through MCP tool `recompute_stablecoin_reserve_3source` at https://mcp.ainumbers.co/mcp (or the page form) and check the returned receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.
