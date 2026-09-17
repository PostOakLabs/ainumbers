# Stablecoin Corridor Economics Model

Models the all-in cost of a USDC-based remittance corridor: on-ramp fee, chain gas fee, off-ramp/local-rail fee, FX spread, and pre-funding float savings vs correspondent banking. Computes gross/net cost in bps and %, savings vs traditional MTO benchmark, and break-even send amount. Rail-agnostic: parameterises the Felix/Circle/Bitso pattern but is NOT tied to a specific protocol. Disambiguates from model_x402_settlement (x402 protocol), model_tempo_payment_economics (Tempo Network), and model_arc_cpn_economics (Arc Protocol CPN). For RPW cross-corridor benchmarking use compare_corridor_cost (art-249). ZERO PII.

- Page: https://ainumbers.co/chaingraph/art-250-model-stablecoin-corridor-economics.html
- Markdown twin: https://ainumbers.co/chaingraph/art-250-model-stablecoin-corridor-economics.md
- MCP tool: model_stablecoin_corridor_economics (endpoint https://mcp.ainumbers.co/mcp)

## Inputs

- chain_fee_usd (unknown, required): Amount in US dollars
- correspondent_cost_pct (unknown, required): Percentage value
- float_days (unknown, required): Duration in days
- float_savings_rate_pct (unknown, required): Percentage value
- fx_spread_pct (unknown, required): Percentage value
- off_ramp_fee_pct (unknown, required): Percentage value
- on_ramp_fee_pct (unknown, required): Percentage value
- send_amount_usd (unknown, required): Amount in US dollars

## Outputs

- break_even_usd (number, optional)
- chain_fee_usd (number, optional)
- correspondent_cost_pct (integer, optional)
- correspondent_cost_usd (integer, optional)
- disambiguation (string, optional)
- float_savings_usd (integer, optional)
- fx_markup_share_of_traditional (number, optional)
- fx_spread_usd (integer, optional)
- gross_cost_bps (number, optional)
- gross_cost_pct (number, optional)
- gross_stablecoin_cost_usd (number, optional)
- meets_sdg_target (boolean, optional)
- net_cost_bps (number, optional)
- net_cost_pct (number, optional)
- net_stablecoin_cost_usd (number, optional)
- off_ramp_fee_usd (integer, optional)
- on_ramp_fee_usd (integer, optional)
- pii_note (string, optional)
- regulatory_basis (string, optional)
- savings_vs_traditional_pct (number, optional)
- savings_vs_traditional_usd (number, optional)
- sdg_target_pct (integer, optional)
- send_amount_usd (integer, optional)
- table_source (string, optional)
- table_version (string, optional)

## Sample

```json
{
  "send_amount_usd": 1000,
  "on_ramp_fee_pct": 0.5,
  "chain_fee_usd": 0.01,
  "off_ramp_fee_pct": 0.3,
  "fx_spread_pct": 0.2,
  "float_savings_rate_pct": 4,
  "float_days": 0,
  "correspondent_cost_pct": 6
}
```

## Verify

Run the sample policy_parameters through MCP tool `model_stablecoin_corridor_economics` at https://mcp.ainumbers.co/mcp (or the page form) and check the returned receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.
