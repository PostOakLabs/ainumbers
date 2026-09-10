# Corporate Action Entitlement Recompute

Deterministic dividend/rights/split entitlement math per record date for a single position, under the ISO 20022 corporate-action event field set migrated by DTCC Important Notice 23890-26 (legacy corporate-actions message format decommission - a DTCC operator mandate, not a regulatory deadline: PSE testing 2026-01, Test Facility 2026-03, PROD testing 2026-07, legacy decommission Q3 2027). entitlement = position_qty x ratio_or_rate, with rounding/proration rules per corporate-action type - all caller-supplied, no security-master lookup, no market-data fetch. Entitlement math only - does NOT validate DTC ISO 20022 message shape; that half is the message-shape validator (art-546), which chains into this node's input.

- Page: https://ainumbers.co/chaingraph/art-547-corporate-action-entitlement-recompute.html
- Markdown twin: https://ainumbers.co/chaingraph/art-547-corporate-action-entitlement-recompute.md
- MCP tool: recompute_corporate_action_entitlement (endpoint https://mcp.ainumbers.co/mcp)

## Inputs

- corporate_action_type (unknown, required)
- position_qty (unknown, required)
- ratio_or_rate (unknown, required)
- record_date (unknown, required)
- reference_id (unknown, required)

## Outputs

- cash_entitlement (integer, optional)
- corporate_action_type (string, optional)
- disambiguation (string, optional)
- dtcc_operator_mandate_basis (string, optional)
- entitlement_computed (boolean, optional)
- entitlement_mode (string, optional)
- error_count (integer, optional)
- fractional_shares (string, optional)
- fractional_shares_present (boolean, optional)
- not_legal_advice (string, optional)
- pii_note (string, optional)
- reference_id (string, optional)
- table_source (string, optional)
- table_version (string, optional)
- violations (array, optional)
- whole_shares (string, optional)

## Sample

```json
{
  "corporate_action_type": "DVCA",
  "position_qty": 1200,
  "ratio_or_rate": 0.42,
  "record_date": "2027-01-15",
  "reference_id": "CA-OPAQUE-2027-0001"
}
```

## Verify

Run the sample policy_parameters through MCP tool `recompute_corporate_action_entitlement` at https://mcp.ainumbers.co/mcp (or the page form) and check the returned receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.
