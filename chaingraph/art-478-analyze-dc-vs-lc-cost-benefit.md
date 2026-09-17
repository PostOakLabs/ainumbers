# Documentary Collection vs Letter of Credit Cost-Benefit

Compares the total cost and risk-adjusted exposure of Documentary Collections (D/P, D/A) against Letters of Credit (Sight, Usance, Confirmed, SBLC) for a trade transaction. Returns a fee breakdown, break-even non-payment probability, and a recommendation, plus a disclosed heuristic LC protection score. Provable node counterpart to tools/423-dc-vs-lc-analyzer.html; that tool page's URC 522 checklist and jurisdiction D/A enforceability reference panels stay browser-only reference material, not computed outputs.

- Page: https://ainumbers.co/chaingraph/art-478-analyze-dc-vs-lc-cost-benefit.html
- Markdown twin: https://ainumbers.co/chaingraph/art-478-analyze-dc-vs-lc-cost-benefit.md
- MCP tool: analyze_dc_vs_lc_cost_benefit (endpoint https://mcp.ainumbers.co/mcp)

## Inputs

- buyerCountryRisk (unknown, required)
- buyerRelationship (unknown, required)
- dcCollectingCommissionPct (unknown, required)
- dcNonPaymentProbabilityPct (unknown, required)
- dcProtestFeeUSD (unknown, required)
- dcRemittingFeeUSD (unknown, required)
- dcType (unknown, required)
- goodsStatus (unknown, required)
- invoiceValueUSD (unknown, required)
- lcAdvisingFeeUSD (unknown, required)
- lcAmendmentFeeUSD (unknown, required)
- lcConfirmationPctPerQuarter (unknown, required)
- lcExpectedAmendments (unknown, required)
- lcIssuancePctPerQuarter (unknown, required)
- lcNegotiationPct (unknown, required)
- lcType (unknown, required)
- paymentTermDays (unknown, required)
- sellerCountryRisk (unknown, required)

## Outputs

- breakEvenProbabilityPct (integer, optional)
- dcRiskAdjCostUSD (integer, optional)
- dcRiskExposureUSD (integer, optional)
- dcTotalFeesUSD (integer, optional)
- heuristic_note (string, optional)
- lcProtectionScore (integer, optional)
- lcRiskAdjCostUSD (integer, optional)
- lcTotalFeesUSD (integer, optional)
- lc_protection_score_heuristic (boolean, optional)
- recommendation (string, optional)

## Sample

```json
{
  "invoiceValueUSD": 500000,
  "sellerCountryRisk": "medium",
  "buyerCountryRisk": "medium",
  "buyerRelationship": "lt2",
  "paymentTermDays": 60,
  "goodsStatus": "shipped",
  "lcType": "sight",
  "lcIssuancePctPerQuarter": 0.125,
  "lcAdvisingFeeUSD": 100,
  "lcConfirmationPctPerQuarter": 0,
  "lcNegotiationPct": 0,
  "lcAmendmentFeeUSD": 75,
  "lcExpectedAmendments": 1,
  "dcType": "dp",
  "dcCollectingCommissionPct": 0.15,
  "dcRemittingFeeUSD": 65,
  "dcProtestFeeUSD": 1000,
  "dcNonPaymentProbabilityPct": 5
}
```

## Verify

Run the sample policy_parameters through MCP tool `analyze_dc_vs_lc_cost_benefit` at https://mcp.ainumbers.co/mcp (or the page form) and check the returned receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.
