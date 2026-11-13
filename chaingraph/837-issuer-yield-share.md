# Issuer Reserve Yield Share Check

Recomputes a white-label stablecoin deal's reserve-income split (issuer, platform, distributor, custodian) from aggregate declared values, a period of days with an average reserve value and an annual yield in basis points, or a declared reserve income, and each party's share in integer minor units, with a conservation check that the floored shares sum exactly to the income. Traces every declared holder-facing reward to its payer and funding source and flags any reward whose payer is an issuer class (issuer, permitted_issuer or foreign_issuer; any other payer role is refused) (enacted statutory profile: PL 119-27 § 4(a)(11) bars a permitted payment stablecoin issuer from paying a holder any form of interest or yield solely in connection with holding, using, or retaining the coin) or whose funding is an issuer flow (reserve income), returning NO_ISSUER_YIELD, REVIEW or ISSUER_YIELD_PRESENT. Adjacent: art-45's narrow genius_yield check inside the Arc xReserve linter flags a declared yield switch; reserve composition comes from art-06 and art-275. The node states facts about declared flows only; it never says a deal is lawful. Inputs are aggregate values and role labels only, no live addresses, no named counterparties, no real deal terms.

- Page: https://ainumbers.co/chaingraph/837-issuer-yield-share.html
- Markdown twin: https://ainumbers.co/chaingraph/837-issuer-yield-share.md
- MCP tool: check_issuer_reserve_yield_share (endpoint https://mcp.ainumbers.co/mcp)

## Sample

```json
{
  "profile": "genius_enacted",
  "period": {
    "days": 30,
    "avg_reserve_value_minor": 250000000,
    "reserve_yield_bp": 425
  },
  "split": [
    {
      "party_role": "issuer",
      "fixed_minor": 349315
    },
    {
      "party_role": "platform",
      "fixed_minor": 305650
    },
    {
      "party_role": "distributor",
      "fixed_minor": 218322
    }
  ],
  "holder_rewards": []
}
```

## Verify

Run the sample policy_parameters through MCP tool `check_issuer_reserve_yield_share` at https://mcp.ainumbers.co/mcp (or the page form) and check the returned receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.
