# Stablecoin Cash Equivalent Test (FASB Proposed 2026-08)

Applies the FASB proposed Update of 2026-08-18 (Statement of Cash Flows (Topic 230): Cash Equivalents-Disclosure Enhancement and Evaluation of Certain Digital Assets, exposure draft, comments due 2026-11-19) to the DECLARED redemption and reserve terms of one stablecoin holding, criterion by criterion, and returns per-criterion PASS / FAIL / NOT_DETERMINABLE verdicts, a collective classification (MEETS_PROPOSED_EXAMPLES / DOES_NOT_MEET / NOT_DETERMINABLE) always labelled with the proposal status, the disclosure checklist the text proposes, and a Policy Mandate export of the declared terms and result. Inputs are declared terms only: direct issuer redemption right, on-demand redeemability, known redemption amount, gates or suspension terms, intermediary-only access, segregated one-to-one short-term liquid reserves, original maturity, and a declared law-or-regulation prohibition term. Secondary-market salability alone never qualifies (the pinned Case-B boundary). Significance thresholds for fees and minimums are declared policy parameters, not values from the text. SCOPE LIMITS: the node evaluates declared terms only and never says how an entity must account, presenting a qualifying asset as a cash equivalent is an accounting policy election; this page is not an accounting opinion. Issuer reserve adequacy and issuer disclosure evidence is served by other estate nodes (art-06, art-275, art-582); this node consumes no issuer evidence. Refuses any input outside the declared shape; a missing (as opposed to type-invalid) required term yields NOT_DETERMINABLE, not a guess.

- Page: https://ainumbers.co/chaingraph/797-stablecoin-cash-equivalent-test.html
- Markdown twin: https://ainumbers.co/chaingraph/797-stablecoin-cash-equivalent-test.md
- MCP tool: check_stablecoin_cash_equiv (endpoint https://mcp.ainumbers.co/mcp)

## Sample

```json
{
  "profile": "fasb_proposed_2026_08",
  "holding": {
    "holder_has_direct_issuer_redemption": true,
    "redemption_on_demand": true,
    "redemption_amount_known": true,
    "gates_or_suspension_terms": false,
    "access_via_intermediary_only": false,
    "issuer_reserve_short_term_liquid_one_to_one": true,
    "original_maturity_days": 1,
    "token_label": "Digital Asset B",
    "redemption_fees_bp": 0,
    "redemption_settlement_days": 0,
    "laws_prohibit_cash_equivalent_treatment": false
  }
}
```

## Verify

Run the sample policy_parameters through MCP tool `check_stablecoin_cash_equiv` at https://mcp.ainumbers.co/mcp (or the page form) and check the returned receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.
