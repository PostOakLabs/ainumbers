# Islamic MMF Placement Limits

Checks a money market fund's placements against one pinned authority profile: the Saudi Capital Market Authority Investment Funds Regulations 2025, Article 56(a) to (j), as amended by Board Resolution 1-54-2025. From a fund's net asset value and a list of holdings with opaque issuer, counterparty and group tokens, it reports used percentage, cap, headroom and breach flag for each numeric limit: hedging derivatives, securitisation, single issuer, single counterparty, same group, fund units, weighted average life and liquidity. It also emits a maturity-bucket placement ladder and a stress-test frequency reminder. Government debt that meets the stated exemption is excluded from the concentration tests. Input types outside the permitted list, identifier-like tokens, non-hedging derivatives and any authority other than the pinned Saudi CMA profile are refused by name. Shariah eligibility of each holding is a caller input; the node does not assess it. Outputs are arithmetic and rule checks against the cited text, not a fatwa, Shariah certification, legal opinion or regulatory approval.

- Page: https://ainumbers.co/chaingraph/art-851-islamic-mmf-placement-limits.html
- Markdown twin: https://ainumbers.co/chaingraph/art-851-islamic-mmf-placement-limits.md
- MCP tool: check_islamic_mmf_placement_limits (endpoint https://mcp.ainumbers.co/mcp)

## Sample

```json
{
  "nav_minor_units": 1000000,
  "liquid_minor_units": 150000,
  "holdings": [
    {
      "instrument_type": "debt_instrument",
      "issuer_token": "iss_a",
      "counterparty_token": "cp_a",
      "group_token": "grp_a",
      "amount_minor_units": 100000,
      "remaining_maturity_days": 60
    },
    {
      "instrument_type": "sama_money_market_transaction",
      "issuer_token": "iss_b",
      "counterparty_token": "cp_b",
      "group_token": "grp_b",
      "amount_minor_units": 200000,
      "remaining_maturity_days": 90
    },
    {
      "instrument_type": "sama_regulated_deposit",
      "issuer_token": "iss_c",
      "counterparty_token": "cp_c",
      "group_token": "grp_c",
      "amount_minor_units": 150000,
      "remaining_maturity_days": 120
    },
    {
      "instrument_type": "public_mmf_units",
      "issuer_token": "iss_d",
      "counterparty_token": "cp_d",
      "group_token": "grp_d",
      "amount_minor_units": 100000,
      "remaining_maturity_days": 30
    },
    {
      "instrument_type": "fixed_income_fund_units",
      "issuer_token": "iss_e",
      "counterparty_token": "cp_e",
      "group_token": "grp_e",
      "amount_minor_units": 50000,
      "remaining_maturity_days": 200
    },
    {
      "instrument_type": "debt_instrument",
      "issuer_token": "iss_gov",
      "counterparty_token": "cp_gov",
      "group_token": "grp_gov",
      "amount_minor_units": 200000,
      "remaining_maturity_days": 200,
      "is_saudi_govt": true
    },
    {
      "instrument_type": "derivative",
      "issuer_token": "iss_h",
      "counterparty_token": "cp_h",
      "group_token": "grp_h",
      "amount_minor_units": 20000,
      "remaining_maturity_days": 45,
      "is_hedging_derivative": true,
      "derivative_issuer_prudential": true
    },
    {
      "instrument_type": "debt_instrument",
      "issuer_token": "iss_i",
      "counterparty_token": "cp_i",
      "group_token": "grp_i",
      "amount_minor_units": 50000,
      "remaining_maturity_days": 75,
      "is_securitisation": true
    }
  ]
}
```

## Verify

Run the sample policy_parameters through MCP tool `check_islamic_mmf_placement_limits` at https://mcp.ainumbers.co/mcp (or the page form) and check the returned receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.
