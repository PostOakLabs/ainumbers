# EMIR Reconciliation & Lifecycle

Pair two counterparties EMIR Refit reports by UTI and reconcile up to 148 matching fields within configurable numeric tolerance, flagging reconciliation breaks (art-156) -> validate the action type against the prior reported state of the UTI (art-157) -> grade the firm overall EMIR Refit reporting readiness across five dimensions: ISO 20022 cutover, UPI sourcing, UTI sharing SLA, reconciliation tolerance, and lifecycle controls; returns A-F grade and gap list (art-158). Exports readiness attestation with execution_hash.

- Page: https://ainumbers.co/chaingraph/chains/emir-reconciliation-and-lifecycle.html
- Markdown twin: https://ainumbers.co/chaingraph/chains/emir-reconciliation-and-lifecycle.md

## Workflow chain: EMIR Reconciliation & Lifecycle

Pair two counterparties EMIR Refit reports by UTI and reconcile up to 148 matching fields within configurable numeric tolerance, flagging reconciliation breaks (art-156) -> validate the action type against the prior reported state of the UTI (art-157) -> grade the firm overall EMIR Refit reporting readiness across five dimensions: ISO 20022 cutover, UPI sourcing, UTI sharing SLA, reconciliation tolerance, and lifecycle controls; returns A-F grade and gap list (art-158). Exports readiness attestation with execution_hash.

Domain: EMIR

### Steps

1. art-156-emir-counterparty-pairing-reconciler
   Pairing and reconciliation feeds lifecycle event validator
2. art-157-emir-lifecycle-event-validator
   Lifecycle validity feeds readiness diagnostic
3. art-158-emir-reporting-readiness-diagnostic
   Exports EMIR Refit readiness attestation with execution_hash - final stage

### Chain verify

Run the workflow through the MCP server (run_chain at https://mcp.ainumbers.co/mcp) and check each step receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.
