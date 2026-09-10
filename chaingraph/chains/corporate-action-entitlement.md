# Corporate Action Entitlement

DTC CA ISO 20022 message validator > corporate action entitlement recompute: message-shape validation feeding deterministic dividend/rights/split entitlement math per record date, under the DTCC Important Notice 23890-26 operator mandate field set.

- Page: https://ainumbers.co/chaingraph/chains/corporate-action-entitlement.html
- Markdown twin: https://ainumbers.co/chaingraph/chains/corporate-action-entitlement.md

## Workflow chain: Corporate Action Entitlement

DTC CA ISO 20022 message validator > corporate action entitlement recompute: message-shape validation feeding deterministic dividend/rights/split entitlement math per record date, under the DTCC Important Notice 23890-26 operator mandate field set.

Domain: Securities Settlement

### Steps

1. art-546-dtcc-ca-iso20022-validator
   structure_valid and event_type feed Stage 2 corporate action entitlement recompute
2. art-547-corporate-action-entitlement-recompute
   entitlement_computed, cash_entitlement/whole_shares - final DTC corporate-action entitlement mandate

### Chain verify

Run the workflow through the MCP server (run_chain at https://mcp.ainumbers.co/mcp) and check each step receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.
