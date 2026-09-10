# Restaking Delegation and Slashing Risk Analyzer

Models restaking delegation rewards, operator fees, AVS yield, and slashing-waterfall risk for EigenLayer and Symbiotic. Computes slashing exposure through a configurable first-loss buffer-tranche model, probability-weighted expected annual slash cost, and slashing-insurance economics. Not financial advice.

- Page: https://ainumbers.co/chaingraph/art-272-restaking-risk.html
- Markdown twin: https://ainumbers.co/chaingraph/art-272-restaking-risk.md
- MCP tool: assess_restaking_risk (endpoint https://mcp.ainumbers.co/mcp)

## Inputs

- avs_reward_apy_pct (number, required): Percentage value
- base_staking_apy_pct (number, required): Percentage value
- eth_price_usd (number, optional): Amount in US dollars
- first_loss_tranche_pct (number, required): Percentage value
- insurance_enabled (boolean, required)
- insurance_premium_pct_of_rewards (number, optional)
- operator_fee_pct (number, required): Percentage value
- protocol (unknown, required)
- slash_magnitude_pct (number, required): Percentage value
- slashing_risk_pct (number, required): Percentage value
- staked_eth (number, optional)

## Outputs

- buffer_absorbs_usd (integer, optional)
- delegator_net_slash_eth (number, optional)
- delegator_net_slash_usd (integer, optional)
- eth_price_usd (integer, optional)
- expected_annual_slash_usd (number, optional)
- first_loss_tranche_pct (integer, optional)
- gross_apy_pct (integer, optional)
- gross_usd_per_year (integer, optional)
- insurance_enabled (boolean, optional)
- insurance_makes_sense (boolean, optional)
- insurance_premium_pct_of_rewards (number, optional)
- insurance_premium_usd_per_year (number, optional)
- max_slash_usd (integer, optional)
- net_apy_pct (number, optional)
- net_apy_risk_adjusted_pct (number, optional)
- net_usd_per_year (integer, optional)
- net_usd_per_year_risk_adjusted (number, optional)
- net_with_insurance_apy_pct (number, optional)
- net_with_insurance_usd_per_year (number, optional)
- not_financial_advice (string, optional)
- operator_cut_pct (number, optional)
- operator_fee_usd_per_year (integer, optional)
- pii_note (string, optional)
- protocol (string, optional)
- protocol_note (string, optional)
- regulatory_basis (string, optional)
- risk_reward_ratio (number, optional)
- slash_magnitude_pct (integer, optional)
- slashing_risk_pct (number, optional)
- staked_eth (integer, optional)
- staked_usd (integer, optional)
- table_source (string, optional)
- table_version (string, optional)

## Sample

```json
{}
```

## Verify

Run the sample policy_parameters through MCP tool `assess_restaking_risk` at https://mcp.ainumbers.co/mcp (or the page form) and check the returned receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.
