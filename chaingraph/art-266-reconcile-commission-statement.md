# Commission Statement Reconciler

Line-item reconciliation of expected vs. received commission payments per contract. Computes variance_amount and variance_pct per line. Sets has_discrepancy (bool) when any line exceeds the tolerance_pct threshold. Returns discrepancy_lines[] and summary totals. Gate signal for commission-integrity-and-amortization chain (has_discrepancy=true exits early). Zero PII by construction.

- Page: https://ainumbers.co/chaingraph/art-266-reconcile-commission-statement.html
- Markdown twin: https://ainumbers.co/chaingraph/art-266-reconcile-commission-statement.md
- MCP tool: reconcile_commission_statement (endpoint https://mcp.ainumbers.co/mcp)

## Inputs

- statement_lines (unknown, optional)
- tolerance_pct (unknown, optional): Percentage value

## Outputs

- discrepancy_amount (integer, optional)
- discrepancy_classification (string, optional)
- discrepancy_pct (integer, optional)
- has_discrepancy (boolean, optional)
- line_count (integer, optional)
- line_results (array, optional)
- not_legal_advice (string, optional)
- pii_note (string, optional)
- regulatory_basis (string, optional)
- table_source (string, optional)
- table_version (string, optional)
- tolerance_pct (integer, optional)
- total_expected (integer, optional)
- total_stated (integer, optional)

## Sample

```json
{
  "statement_lines": [
    {
      "agent_id": "AGT001",
      "gross_premium": 10000,
      "commission_rate_pct": 10,
      "split_pct": 100,
      "stated_commission": 1000
    }
  ],
  "tolerance_pct": 1
}
```

## Verify

Run the sample policy_parameters through MCP tool `reconcile_commission_statement` at https://mcp.ainumbers.co/mcp (or the page form) and check the returned receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.
