# Tempo Fee-AMM Conversion Calculator

Converts a supplied fee-token amount to the validator's token through Tempo's enshrined protocol Fee AMM (Tempo has no native gas token): validatorTokenOut = userTokenIn x 0.9970, 30bps to LPs. Checks the conversion against declared pool reserves for liquidity sufficiency and returns output-or-failure, never a silent overdraw. Fixed-point BigInt math at attodollar scale; calculator only, zero egress.

- Page: https://ainumbers.co/chaingraph/art-388-tempo-fee-amm-converter.html
- Markdown twin: https://ainumbers.co/chaingraph/art-388-tempo-fee-amm-converter.md
- MCP tool: convert_tempo_fee_amm (endpoint https://mcp.ainumbers.co/mcp)

## Inputs

- fee_token (any, required): type not evidenced by kernel source
- max_pool_utilization_bps (any, required): Amount in basis points; type not evidenced by kernel source
- pool_reserves (any, required): type not evidenced by kernel source
- user_token_in (any, required): type not evidenced by kernel source
- validator_token (any, required): type not evidenced by kernel source

## Outputs

- conversion_ok (boolean, optional)
- fee_token (string, optional)
- lp_fee_amount (string, optional)
- max_pool_utilization_bps (integer, optional)
- note (string, optional)
- pool_utilization_bps (integer, optional)
- reason (string, optional)
- validator_token (string, optional)
- validator_token_out (string, optional)

## Sample

```json
{
  "fee_token": "USDT",
  "validator_token": "USDC",
  "user_token_in": "1000000000000000000000",
  "pool_reserves": {
    "fee_token_reserve": "500000000000000000000000",
    "validator_token_reserve": "500000000000000000000000"
  }
}
```

## Verify

Run the sample policy_parameters through MCP tool `convert_tempo_fee_amm` at https://mcp.ainumbers.co/mcp (or the page form) and check the returned receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.
