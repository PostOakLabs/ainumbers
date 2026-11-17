# Government Stablecoin Acceptance Audit

Assesses a government acceptor's aggregate stablecoin receipt ledger against its written acceptance policy, which tokens are eligible, how fast receipts must be converted to fiat, how much unconverted value may be held, and how refunds are handled, and reconciles tokens received, converted and credited in fiat line by line, reporting policy conformance, reconciliation breaks, peak unconverted exposure and an overall verdict. Inputs are aggregate per-day-per-token totals in integer minor units; no payer data is accepted. All policy parameters are caller-declared: the pinned Bermuda government statement (gov.bm, 2026-01-19) names agency stablecoin-payment pilots and USDC as principal token but fixes no conversion window, holding cap, refund rule or custody arrangement. Scope limits: no issuer-side reserve evidence (that is the reserve-attestation node's job), no pricing or FX logic, no jurisdiction profiles shipped, the generic profile only.

- Page: https://ainumbers.co/chaingraph/art-793-government-stablecoin-acceptance.html
- Markdown twin: https://ainumbers.co/chaingraph/art-793-government-stablecoin-acceptance.md
- MCP tool: assess_gov_stablecoin_accept (endpoint https://mcp.ainumbers.co/mcp)

## Inputs

- profile (string, optional)
- policy (object, required)
- receipts (array, required)

## Outputs

- outcome (string, optional)
- profile (string,null, optional)
- rounding_rule (string, optional)
- policy_conformance (object,null, optional)
- reconciliation (object,null, optional)
- exposure (object,null, optional)
- totals (object,null, optional)
- verdict (string, optional)
- refusal_reason (string,null, optional)

## Sample

```json
{
  "profile": "generic",
  "policy": {
    "eligible_tokens": [
      {
        "token_code": "USDC",
        "issuer_regime": "mica_artifact_or_equivalent",
        "reserve_attestation_ref": "reserve-attest-2026-w43"
      }
    ],
    "conversion_window_hours": 24,
    "max_unconverted_value": 5000000,
    "refund_rule": "in_kind",
    "custody": "custodian",
    "fiat_tolerance_value": 0
  },
  "receipts": [
    {
      "token_code": "USDC",
      "day": "2026-03-02",
      "received_value": 1000000,
      "converted_value": 1000000,
      "fiat_credited_value": 1000000,
      "refunds_value": 0,
      "max_hours_to_conversion": 3,
      "conversion_rate_variance_bp": 0
    },
    {
      "token_code": "USDC",
      "day": "2026-03-03",
      "received_value": 2000000,
      "converted_value": 2000000,
      "fiat_credited_value": 2000000,
      "refunds_value": 0,
      "max_hours_to_conversion": 5,
      "conversion_rate_variance_bp": 2
    },
    {
      "token_code": "USDC",
      "day": "2026-03-04",
      "received_value": 500000,
      "converted_value": 500000,
      "fiat_credited_value": 500000,
      "refunds_value": 0,
      "max_hours_to_conversion": 1,
      "conversion_rate_variance_bp": 0
    },
    {
      "token_code": "USDC",
      "day": "2026-03-05",
      "received_value": 3000000,
      "converted_value": 3000000,
      "fiat_credited_value": 3000000,
      "refunds_value": 0,
      "max_hours_to_conversion": 8,
      "conversion_rate_variance_bp": 1
    },
    {
      "token_code": "USDC",
      "day": "2026-03-06",
      "received_value": 750000,
      "converted_value": 750000,
      "fiat_credited_value": 750000,
      "refunds_value": 0,
      "max_hours_to_conversion": 2,
      "conversion_rate_variance_bp": 0
    }
  ]
}
```

## Verify

Run the sample policy_parameters through MCP tool `assess_gov_stablecoin_accept` at https://mcp.ainumbers.co/mcp (or the page form) and check the returned receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.
