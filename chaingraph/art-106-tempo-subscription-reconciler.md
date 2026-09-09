# Tempo Subscription & Streaming Settlement Reconciler

Reconcile executed MPP recurring/streamed draws against the authorized mandate envelope, prove draw-set integrity via Merkle root, and detect per-cycle cap breaches, cumulative-cap violations, and mandate-expiry/revocation breaches. Distinct from tempo-mpp-agent (pre-execution authorization): this audits the post-execution draw lifecycle.

- Page: https://ainumbers.co/chaingraph/art-106-tempo-subscription-reconciler.html
- Markdown twin: https://ainumbers.co/chaingraph/art-106-tempo-subscription-reconciler.md
- MCP tool: reconcile_mpp_subscription (endpoint https://mcp.ainumbers.co/mcp)

## Inputs

- draws (array, required)
- envelope (unknown, required)

## Outputs

- breaches (array, optional)
- cumulative_ok (boolean, optional)
- cycles_ok (boolean, optional)
- draw_count (integer, optional)
- draw_merkle_root (string, optional)
- residual_envelope (integer, optional)
- total_drawn (integer, optional)
- verdict (string, optional)

## Sample

```json
{
  "envelope": {
    "cap_total": 1000,
    "cap_per_cycle": 100,
    "cadence": "monthly",
    "valid_until": 9999999999,
    "mode": "subscription"
  },
  "draws": [
    {
      "seq": 1,
      "amount": 95,
      "ts": 1750000000,
      "cycle": 1
    },
    {
      "seq": 2,
      "amount": 90,
      "ts": 1752600000,
      "cycle": 2
    },
    {
      "seq": 3,
      "amount": 80,
      "ts": 1755200000,
      "cycle": 3
    }
  ]
}
```

## Verify

Run the sample policy_parameters through MCP tool `reconcile_mpp_subscription` at https://mcp.ainumbers.co/mcp (or the page form) and check the returned receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.
