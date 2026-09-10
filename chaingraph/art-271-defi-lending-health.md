# DeFi Lending Health and Liquidation Monitor

Computes DeFi lending health factor, liquidation price, borrow capacity, and distance to liquidation for Aave v3, Morpho Blue, Fluid, Sky (MakerDAO v2), and Liquity v2. Handles LTV mode (Aave/Morpho/Fluid) and collateral-ratio mode (Sky/Liquity). Per-protocol liquidation mechanism notes. Not financial advice.

- Page: https://ainumbers.co/chaingraph/art-271-defi-lending-health.html
- Markdown twin: https://ainumbers.co/chaingraph/art-271-defi-lending-health.md
- MCP tool: assess_defi_lending (endpoint https://mcp.ainumbers.co/mcp)

## Inputs

- collateral_amount (number, required)
- collateral_price_usd (number, optional): Amount in US dollars
- collateral_value_usd (number, optional): Amount in US dollars
- debt_value_usd (number, optional): Amount in US dollars
- liquidation_bonus_pct (number, required): Percentage value
- liquidation_threshold_pct (number, required): Percentage value
- protocol (unknown, required)

## Outputs

- borrow_capacity_usd (integer, optional)
- buffer_to_liquidation_pct (number, optional)
- collateral_value_usd (integer, optional)
- current_ltv_pct (integer, optional)
- debt_value_usd (integer, optional)
- distance_to_liquidation_pct (number, optional)
- health_factor (number, optional)
- health_status (string, optional)
- liquidation_bonus_pct (integer, optional)
- liquidation_mechanism (string, optional)
- liquidation_mechanism_note (string, optional)
- liquidation_penalty_usd (integer, optional)
- liquidation_price_usd (number, optional)
- liquidation_threshold_pct (integer, optional)
- not_financial_advice (string, optional)
- pii_note (string, optional)
- protocol (string, optional)
- regulatory_basis (string, optional)
- table_source (string, optional)
- table_version (string, optional)

## Sample

```json
{}
```

## Verify

Run the sample policy_parameters through MCP tool `assess_defi_lending` at https://mcp.ainumbers.co/mcp (or the page form) and check the returned receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.
