# Record Fund Positions

Gives a fund's declared positions snapshot, as of a stated valuation date, its own citable execution_hash - the upstream input-receipt that the proven NAV chain (art-373-recompute-fund-nav) currently hashes internally, and that a separate wiring node can instead cite via an optional positions_ref rather than re-declaring the same holdings. Attests that a declared snapshot exists exactly as stated, over caller-supplied holdings rows (security_id, quantity, currency) and a declared shares_outstanding. HARD FENCE: fund_id, valuation_date, every holding row, and shares_outstanding are supplied and asserted, never fetched (zero-egress); this attests THAT a declared snapshot exists as stated, never whether it matches a custodian record, never a live position feed. Section 25 private-inputs review ruled not applicable and stated explicitly: holdings are echoed in cleartext by design, since the node's function is to give the declared snapshot a citable hash, not to hide it behind a commitment. Not fund NAV recomputation (art-373) and not a pricing input (a sibling record_pricing_inputs node covers pricing). Corrections cite the prior artifact via the SPEC.md top-level supersedes field, not a bespoke status registry.

- Page: https://ainumbers.co/chaingraph/art-558-record-fund-positions.html
- Markdown twin: https://ainumbers.co/chaingraph/art-558-record-fund-positions.md
- MCP tool: record_fund_positions (endpoint https://mcp.ainumbers.co/mcp)

## Inputs

- fund_id (unknown, optional)
- holdings (array, required)
- shares_outstanding (number, required)
- valuation_date (unknown, optional)

## Outputs

- disclosure_note (string, optional)
- fence (string, optional)
- fund_id (string, optional)
- holding_count (integer, optional)
- holdings (array, optional)
- not_proven (array, optional)
- shares_outstanding (integer, optional)
- structural_error (string, optional)
- valuation_date (string, optional)

## Sample

```json
{
  "fund_id": "FUND-DEMO-01",
  "valuation_date": "2026-08-05",
  "holdings": [
    {
      "security_id": "SEC-A",
      "quantity": 1000,
      "currency": "USD"
    },
    {
      "security_id": "SEC-B",
      "quantity": 2500,
      "currency": "GBP"
    },
    {
      "security_id": "SEC-C",
      "quantity": 750,
      "currency": "EUR"
    }
  ],
  "shares_outstanding": 100000
}
```

## Verify

Run the sample policy_parameters through MCP tool `record_fund_positions` at https://mcp.ainumbers.co/mcp (or the page form) and check the returned receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.
