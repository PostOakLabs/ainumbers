# Servicing Compliance Clock

Computes servicer-compliance due dates and clock states from event dates and loan values: error-resolution and information-request clocks, loss-mitigation acknowledgment and evaluation, the 37-day pre-sale boundary, the 120-day pre-foreclosure bar, no-duplicate processing, force-placed-insurance notice, reminder, cancel and refund clocks, payment-crediting and payoff-statement deadlines, and ARM notice windows with their exception branches. Every obligation carries its paragraph citation and a named business-day calendar assumption. Invalid dates, removed rule branches and over-bound event sets are refused, never computed.

- Page: https://ainumbers.co/chaingraph/733-servicing-compliance-clock.html
- Markdown twin: https://ainumbers.co/chaingraph/733-servicing-compliance-clock.md
- MCP tool: servicing_compliance_clock (endpoint https://mcp.ainumbers.co/mcp)

## Inputs

- events (array, required): Event list, at most 32: rule id, strict ISO trigger date, rule-specific parameters.

## Outputs

- verdict (string, optional)
- obligations (array, optional)
- evidence (object, optional)
- manual_review_required (boolean, optional)

## Sample

```json
{
  "events": [
    {
      "rule": "error_acknowledgment",
      "trigger_date": "2026-11-25"
    }
  ]
}
```

## Verify

Run the sample policy_parameters through MCP tool `servicing_compliance_clock` at https://mcp.ainumbers.co/mcp (or the page form) and check the returned receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.
