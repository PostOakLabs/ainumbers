# Perp Funding and Carry Calculator

Computes perpetual futures funding rates, compound annual APR, and cross-venue funding differential arbitrage (Hyperliquid hourly vs Binance 8-hour cadence). Models delta-neutral carry strategies combining perp short funding with DeFi collateral yield (Ethena sUSDe). Includes basis analytics and Hyperliquid 4%/hr cap note. Not financial advice.

- Page: https://ainumbers.co/chaingraph/art-270-perp-funding-carry.html
- Markdown twin: https://ainumbers.co/chaingraph/art-270-perp-funding-carry.md
- MCP tool: compute_perp_funding (endpoint https://mcp.ainumbers.co/mcp)

## Inputs

- asset (unknown, required)
- basis_perp_price (number, required)
- basis_spot_price (number, optional)
- cadence_hours (number, required)
- defi_yield_pct_annual (number, required)
- funding_rate_pct_per_period (number, optional)
- taker_fee_pct (number, required): Percentage value
- venue (unknown, required)
- venue2 (unknown, required)
- venue2_cadence_hours (number, required)
- venue2_funding_rate_pct_per_period (number, optional)
- venue2_taker_fee_pct (number, required): Percentage value

## Outputs

- annualized_basis_pct (integer, optional)
- asset (string, optional)
- basis_pct (integer, optional)
- basis_perp_price (integer, optional)
- basis_spot_price (integer, optional)
- basis_usd (integer, optional)
- cadence_hours (integer, optional)
- compound_annualized_rate_pct (number, optional)
- cross_venue_arb (string, optional)
- delta_neutral_carry (string, optional)
- funding_rate_pct_per_period (number, optional)
- hl_funding_cap_pct_per_hour (integer, optional)
- hl_typical_rate_note (string, optional)
- hourly_rate_pct (number, optional)
- not_financial_advice (string, optional)
- pii_note (string, optional)
- regulatory_basis (string, optional)
- simple_annualized_rate_pct (number, optional)
- table_source (string, optional)
- table_version (string, optional)
- venue (string, optional)

## Sample

```json
{}
```

## Verify

Run the sample policy_parameters through MCP tool `compute_perp_funding` at https://mcp.ainumbers.co/mcp (or the page form) and check the returned receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.
