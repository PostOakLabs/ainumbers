# ERC-8056 Multiplier Reconciler

Reconciles Robinhood Chain stock-token corporate actions against the ERC-8056 scaled UI amount surface. Stock tokens never rebase; splits and dividends land as a uiMultiplier() change plus a UIMultiplierUpdated event while raw balanceOf stays static until redemption. Checks declared corporate-action ratio against the multiplier transition, monotonic event sequencing, and raw-balance invariance. First tooling anywhere for ERC-8056 reconciliation. Zero network, zero PII.

- Page: https://ainumbers.co/chaingraph/art-317-rhc-multiplier-reconciler.html
- Markdown twin: https://ainumbers.co/chaingraph/art-317-rhc-multiplier-reconciler.md
- MCP tool: reconcile_erc8056_multiplier (endpoint https://mcp.ainumbers.co/mcp)

## Inputs

- current_multiplier (unknown, optional)
- declared_action (unknown, optional)
- event_log (unknown, optional)
- prior_multiplier (unknown, optional)
- raw_balance_after (unknown, optional)
- raw_balance_before (unknown, optional)

## Outputs

- computed_ratio (integer, optional)
- declared_action_type (string, optional)
- discrepancies (array, optional)
- event_count (integer, optional)
- expected_ratio (integer, optional)
- ratio_match (boolean, optional)
- raw_balance_invariant (boolean, optional)
- verdict (string, optional)

## Sample

```json
{
  "declared_action": {
    "type": "split",
    "ratio": 2,
    "ex_date": "2026-07-10"
  },
  "prior_multiplier": 1,
  "current_multiplier": 2,
  "raw_balance_before": 1000,
  "raw_balance_after": 1000,
  "event_log": [
    {
      "index": 0,
      "ex_date": "2026-07-10",
      "multiplier_before": 1,
      "multiplier_after": 2
    }
  ]
}
```

## Verify

Run the sample policy_parameters through MCP tool `reconcile_erc8056_multiplier` at https://mcp.ainumbers.co/mcp (or the page form) and check the returned receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.
