# Event Contract Terms Lint

Lints a prediction-market event contract's DECLARED settlement terms (source agency kind, unresolvable-outcome fallback, revision rule, expiration-value rule, discretion clause, outcome review availability, dispute window, settlement delay bound, early-close rule, carve-out flag, outcome exhaustiveness and exclusivity) against a caller-declared policy, and emits one PASS or FINDING line per declared policy item plus one intrinsic consistency check, with an overall verdict of PASS, PASS_WITH_FINDINGS or FAIL. Venue-neutral: the only profile knowledge is a closed data table (kalshi_rulebook_v1_29, generic) that marks which finding items carry a pinned primary-text basis; findings cite opaque rule_key identifiers that the node page maps to the pinned passages. Inputs are enums, booleans, integers and opaque labels only - prose, URLs and identifier-like values are refused, never echoed. The node never says a contract is lawful, fair or compliant, and names no venue as compliant; resolution lifecycle work belongs to the parked PM-RESOLUTION-VERIFY design and pricing to art-211 and art-212.

- Page: https://ainumbers.co/chaingraph/806-event-contract-terms-lint.html
- Markdown twin: https://ainumbers.co/chaingraph/806-event-contract-terms-lint.md
- MCP tool: lint_event_contract_terms (endpoint https://mcp.ainumbers.co/mcp)

## Inputs

- profile (string, required): Venue profile. kalshi_rulebook_v1_29 pins finding bases to the rulebook passages on the page; generic takes all rules from caller policy.
- as_of (string, required): Effective date for the profile selection, YYYY-MM-DD. Required.
- terms (object, required): The contract's DECLARED settlement terms: enums, booleans, integers and one opaque label only. No prose, no URLs, no identifiers.
- policy (object, optional): The caller policy. Every item optional; only declared items produce finding lines. forbid/require mismatches drive FAIL; thresholds drive findings.

## Outputs

- refused (boolean, optional)
- reason_code (string,null, optional)
- field (string,null, optional)
- profile_id (string,null, optional)
- profile_venue_label (string,null, optional)
- as_of (string,null, optional)
- contract_label (string,null, optional)
- findings (array, optional)
- evaluated_items (integer, optional)
- verdict (string, optional)
- issues (array, optional)

## Sample

```json
{
  "profile": "kalshi_rulebook_v1_29",
  "as_of": "2026-11-02",
  "terms": {
    "contract_label": "Violence carveout contract",
    "carveout_clause": true,
    "unresolvable_fallback": "last_price",
    "revision_after_settlement": "none",
    "source_agency_kind": "government_statistic",
    "fallback_sources_count": 2,
    "revision_rule": "as_of_expiration",
    "expiration_value_rule": "point",
    "discretion_clause": false,
    "outcome_review_available": true,
    "dispute_window_hours": 720,
    "settlement_delay_hours_max": 12,
    "early_close_rule": "none",
    "outcomes_exhaustive": true,
    "outcomes_exclusive": true
  },
  "policy": {
    "forbid_carveout_clause": true
  }
}
```

## Verify

Run the sample policy_parameters through MCP tool `lint_event_contract_terms` at https://mcp.ainumbers.co/mcp (or the page form) and check the returned receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.
