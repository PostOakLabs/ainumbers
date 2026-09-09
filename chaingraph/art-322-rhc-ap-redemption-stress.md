# AP Concentration + Redemption-Path Stress

Stress-tests the one-token-equals-one-share economic-exposure claim for Robinhood Chain stock tokens against actual redemption reachability. BBVI is the sole Authorised Participant at issuance; only Authorised Participants may subscribe or redeem directly from Robinhood Assets (Jersey) Limited after KYB, everyone else is secondary-market-only. Enumerates AP concentration, premium/discount exposure if the sole AP stops market-making, and issuer-credit exposure distinct from the underlying equity. Verify-only; never recommends a position. Zero network, zero PII.

- Page: https://ainumbers.co/chaingraph/art-322-rhc-ap-redemption-stress.html
- Markdown twin: https://ainumbers.co/chaingraph/art-322-rhc-ap-redemption-stress.md
- MCP tool: stress_test_ap_redemption_path (endpoint https://mcp.ainumbers.co/mcp)

## Inputs

- authorised_participants (unknown, optional)
- issuer_credit (unknown, optional)
- secondary_market_depth (unknown, optional)

## Outputs

- ap_count (integer, optional)
- concentration_risk (string, optional)
- issuer_credit_exposure_distinct (boolean, optional)
- liquidity_flag (string, optional)
- not_investment_advice (string, optional)
- premium_discount_exposure (boolean, optional)
- redemption_path (string, optional)
- redemption_reachable_for_non_ap (boolean, optional)
- structural_dependencies (array, optional)
- verdict (string, optional)

## Sample

```json
{
  "authorised_participants": [
    {
      "name": "BBVI",
      "active": true
    }
  ],
  "secondary_market_depth": {
    "daily_volume_usd": 50000,
    "bid_ask_spread_bps": 20
  },
  "issuer_credit": {
    "obligor": "RHJ",
    "rating_available": false
  }
}
```

## Verify

Run the sample policy_parameters through MCP tool `stress_test_ap_redemption_path` at https://mcp.ainumbers.co/mcp (or the page form) and check the returned receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.
