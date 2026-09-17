# Pendle Yield Tokenization Analyzer (PT/YT)

Decomposes Pendle Finance yield tokenization: PT implied fixed yield, YT leverage and break-even APY, PT+YT=1 invariant check, and time-to-maturity analytics. Covers Pendle/Ethena sUSDe presets. Determines whether YT is profitable at current underlying APY and by how much. Not financial advice.

- Page: https://ainumbers.co/chaingraph/art-273-pendle-yield.html
- Markdown twin: https://ainumbers.co/chaingraph/art-273-pendle-yield.md
- MCP tool: compute_pt_yt_yield (endpoint https://mcp.ainumbers.co/mcp)

## Inputs

- days_to_maturity (number, optional)
- investment_usd (number, optional): Amount in US dollars
- pt_price (number, optional)
- underlying_apy_pct (number, optional): Percentage value
- yt_price (number, required)

## Outputs

- days_to_maturity (integer, optional)
- invariant_holds (boolean, optional)
- investment_usd (integer, optional)
- not_financial_advice (string, optional)
- pii_note (string, optional)
- pt_discount_pct (integer, optional)
- pt_implied_fixed_yield_pct (number, optional)
- pt_price (number, optional)
- pt_profit_at_maturity_usd (number, optional)
- pt_return_to_maturity_pct (number, optional)
- pt_simple_apr_pct (number, optional)
- pt_units_bought (number, optional)
- pt_yt_sum (integer, optional)
- regulatory_basis (string, optional)
- table_source (string, optional)
- table_version (string, optional)
- underlying_apy_pct (integer, optional)
- years_to_maturity (number, optional)
- yt_break_even_apy_pct (number, optional)
- yt_leverage (number, optional)
- yt_levered_apy_pct (number, optional)
- yt_margin_of_safety_pct (number, optional)
- yt_net_pnl_if_underlying_stable_usd (number, optional)
- yt_payout_if_underlying_stable_usd (number, optional)
- yt_price (number, optional)
- yt_profitable_at_current (boolean, optional)
- yt_units_bought (number, optional)

## Sample

```json
{}
```

## Verify

Run the sample policy_parameters through MCP tool `compute_pt_yt_yield` at https://mcp.ainumbers.co/mcp (or the page form) and check the returned receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.
