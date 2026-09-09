# Arc Multi-Currency Corridor Jurisdiction Router

Route each leg of a multi-currency Arc corridor to its per-currency home regime (EURC→MiCA EMT, JPYC→JP FSA, BRLA→Brazil CMN/BCB, MXNB→MX CNBV, etc.), flag missing per-regime disclosures, and emit PvP handoff (511) + Travel-Rule batch handoff (art-104). Compliance/settlement routing only; FX economics handled separately by the Arc StableFX chain.

- Page: https://ainumbers.co/chaingraph/art-111-arc-corridor-jurisdiction-router.html
- Markdown twin: https://ainumbers.co/chaingraph/art-111-arc-corridor-jurisdiction-router.md
- MCP tool: route_partner_stablecoin_jurisdiction (endpoint https://mcp.ainumbers.co/mcp)

## Inputs

- corridor_legs (array, required)

## Outputs

- disclosure_gaps (array, optional)
- leg_regimes (array, optional)
- pvp_handoff (object, optional)
- travel_rule_handoff (object, optional)
- verdict (string, optional)

## Sample

```json
{
  "corridor_legs": [
    {
      "ccy_pair": "USD/EUR",
      "partner_stablecoin": "EURC",
      "notional": 500000,
      "disclosures_provided": [
        "reserve_attestation_monthly",
        "MiCA_Art21",
        "AML_program"
      ]
    },
    {
      "ccy_pair": "USD/JPY",
      "partner_stablecoin": "JPYC",
      "notional": 300000,
      "disclosures_provided": [
        "PSA_registration",
        "reserve_attestation",
        "AML_program"
      ]
    }
  ]
}
```

## Verify

Run the sample policy_parameters through MCP tool `route_partner_stablecoin_jurisdiction` at https://mcp.ainumbers.co/mcp (or the page form) and check the returned receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.
