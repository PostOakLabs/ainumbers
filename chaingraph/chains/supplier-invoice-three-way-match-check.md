# Supplier Invoice Three-Way Match Check

Decide whether a supplier invoice is safe to pay in two independent stages: match the invoice against its purchase order and goods receipt line by line, with quantity, price-tolerance, and totals checks plus duplicate-invoice suspicion screening (ART-701), then recompute the invoice's line VAT, tax subtotals, and grand total under the declared rounding convention and compare against the document-asserted amounts (ART-294), closing with a session receipt aggregating the run's execution hashes (CRY-05). Arithmetic checks only; not a fraud determination and not tax advice.

- Page: https://ainumbers.co/chaingraph/chains/supplier-invoice-three-way-match-check.html
- Markdown twin: https://ainumbers.co/chaingraph/chains/supplier-invoice-three-way-match-check.md

## Workflow chain: Supplier Invoice Three-Way Match Check

Decide whether a supplier invoice is safe to pay in two independent stages: match the invoice against its purchase order and goods receipt line by line, with quantity, price-tolerance, and totals checks plus duplicate-invoice suspicion screening (ART-701), then recompute the invoice's line VAT, tax subtotals, and grand total under the declared rounding convention and compare against the document-asserted amounts (ART-294), closing with a session receipt aggregating the run's execution hashes (CRY-05). Arithmetic checks only; not a fraud determination and not tax advice.

Domain: SME & Commercial Finance

### Steps

1. art-701-three-way-invoice-match
   Matches the invoice against its purchase order and goods receipt: every line paired to a PO line with quantity-over-received, quantity-over-ordered, and price-tolerance verdicts, totals recomputed in minor units, and duplicate-invoice suspicion screening against prior invoices; outcome match, mismatch, no_po, or refused
2. art-294-einvoice-vat-calc-verifier
   Recomputes the invoice's line VAT, per-category tax subtotals, tax total, and grand total under the declared rounding convention and compares each against the document-asserted amounts; arithmetic consistency only, not statutory rate correctness
3. cry-05-agent-action-audit-trail-aggregator
   Produces session_receipt_root, the Merkle root over the run's execution_hashes (final stage)

### Chain verify

Run the workflow through the MCP server (run_chain at https://mcp.ainumbers.co/mcp) and check each step receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.

### Ask your agent

Question: A supplier invoiced 10 widgets at $5.00 each against PO-42, and we received all 10. Does the invoice match the PO and receipt, and is the VAT arithmetic right?
Run the AINumbers MCP tool `run_chain` with {"chain":"supplier-invoice-three-way-match-check"} and read `art-701-three-way-invoice-match.outcome`.
Re-run with `inputs` for `art-701-three-way-invoice-match`, reusing the values that result echoed, with `duplicate_window_days` set to 7. Compare the same field.
Verify: call `verify_execution_hash` (https://mcp.ainumbers.co/mcp) with `claimed_hash` set to `composite_execution_hash` and the full `composite_artifact`.
Ledger, for a human re-check: https://ledger.ainumbers.co/
PII rule: send synthetic or anonymised inputs only. The MCP server runs these kernels and logs no payloads.
Chain page: https://ainumbers.co/chaingraph/chains/supplier-invoice-three-way-match-check.html
