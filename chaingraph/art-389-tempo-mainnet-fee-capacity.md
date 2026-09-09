# TIP-1010 Mainnet Fee & Payment-Lane Capacity Calculator

Per-tx fee (fee_microusd = ceil(base_fee_attodollars_per_gas x gas_used / 1e12)) and payment-lane TPS headroom for a supplied payment mix, against the published TIP-1010 mainnet constants (base fee 2e10 attodollars/gas, 500M gas/block, ~94% payment-lane reservation). Successor to model_tempo_gas_economics (art-107), which predates these constants. Every parameter is declared with its TIP-1010 citation and carried as protocol_version so a base-fee governance change is a data re-pin, never a code change. Does not read /docs/api/rpc (outside Tempo's stable API contract). Fixed-point BigInt math, calculator only, zero egress.

- Page: https://ainumbers.co/chaingraph/art-389-tempo-mainnet-fee-capacity.html
- Markdown twin: https://ainumbers.co/chaingraph/art-389-tempo-mainnet-fee-capacity.md
- MCP tool: compute_tempo_mainnet_fee_capacity (endpoint https://mcp.ainumbers.co/mcp)

## Inputs

- block_time_seconds (number, required)
- payment_mix (array, required)
- protocol_parameters (unknown, required)

## Outputs

- block_time_seconds (integer, optional)
- line_items (array, optional)
- note (string, optional)
- protocol_parameters_used (object, optional)
- protocol_version (string, optional)
- summary (object, optional)

## Sample

```json
{
  "block_time_seconds": 1,
  "payment_mix": [
    {
      "label": "tip20-transfer",
      "gas_used": "50000",
      "count": "100"
    },
    {
      "label": "complex-tx",
      "gas_used": "200000",
      "count": "10"
    }
  ]
}
```

## Verify

Run the sample policy_parameters through MCP tool `compute_tempo_mainnet_fee_capacity` at https://mcp.ainumbers.co/mcp (or the page form) and check the returned receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.
