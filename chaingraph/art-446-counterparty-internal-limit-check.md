# Counterparty Internal Limit Check

Counterparty internal credit-limit check: compares each counterparty's caller-supplied current exposure against its board-approved internal limit line (settlement, pre-settlement/PFE, or aggregate limit type), computes utilization percent and headroom, and flags each counterparty WITHIN_LIMIT, WARNING (above the caller-set soft-warning threshold, e.g. 90% of the limit), or BREACH (exposure exceeds the approved limit). This is a deterministic point-in-time check against internally governed limit lines - distinct from the Basel/Reg-YY regulatory single-counterparty threshold check (art-425) - and is NOT a real-time exposure monitor: no live feed, no intraday polling, no scheduled job. Not X: use art-425 for the Basel III / Regulation YY 25%/15%-of-Tier-1 regulatory large-exposures limit; use this node for internal (board- or risk-committee-approved) counterparty limit-line governance.

- Page: https://ainumbers.co/chaingraph/art-446-counterparty-internal-limit-check.html
- Markdown twin: https://ainumbers.co/chaingraph/art-446-counterparty-internal-limit-check.md
- MCP tool: compute_counterparty_limit_check (endpoint https://mcp.ainumbers.co/mcp)

## Inputs

- counterparties (unknown, required)

## Outputs

- breach_list (array, optional)
- counterparties (array, optional)
- note (string, optional)
- regulatory_basis (string, optional)
- warning_list (array, optional)

## Sample

```json
{
  "counterparties": [
    {
      "counterparty_id": "cp-A",
      "counterparty_name": "Counterparty A",
      "limit_type": "settlement",
      "approved_limit_musd": 1000,
      "current_exposure_musd": 400,
      "warning_threshold_pct": 90
    },
    {
      "counterparty_id": "cp-B",
      "counterparty_name": "Counterparty B",
      "limit_type": "aggregate",
      "approved_limit_musd": 1500,
      "current_exposure_musd": 300,
      "warning_threshold_pct": 90
    }
  ]
}
```

## Verify

Run the sample policy_parameters through MCP tool `compute_counterparty_limit_check` at https://mcp.ainumbers.co/mcp (or the page form) and check the returned receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.
