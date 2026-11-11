# Claim Dispute Bundle to PLD Disclosure Pack

Back office flow scoped to the dispute lifecycle. Two-step product-liability disclosure flow: build a two-sided replay-challenge dossier for a disputed execution claim, then build the disclosure and rebuttal pack from the receipts in that bundle. The pack traces the receipts in the step 1 bundle; the operator is responsible for putting only in-window receipts into the claim, because art-308 does not filter receipts by disputed_window. Step 1's insufficient_evidence and bundle_claim_strength travel with the pack next to step 2's trace_digest and gap_in_window, so a pack built after step 1 reported insufficient_evidence never reads as a complete dossier. Prepared for Directive (EU) 2024/2853, transposition 9 December 2026.

- Page: https://ainumbers.co/chaingraph/chains/claim-dispute-bundle-to-pld-disclosure-pack.html
- Markdown twin: https://ainumbers.co/chaingraph/chains/claim-dispute-bundle-to-pld-disclosure-pack.md

## Workflow chain: Claim Dispute Bundle to PLD Disclosure Pack

Back office flow scoped to the dispute lifecycle. Two-step product-liability disclosure flow: build a two-sided replay-challenge dossier for a disputed execution claim, then build the disclosure and rebuttal pack from the receipts in that bundle. The pack traces the receipts in the step 1 bundle; the operator is responsible for putting only in-window receipts into the claim, because art-308 does not filter receipts by disputed_window. Step 1's insufficient_evidence and bundle_claim_strength travel with the pack next to step 2's trace_digest and gap_in_window, so a pack built after step 1 reported insufficient_evidence never reads as a complete dossier. Prepared for Directive (EU) 2024/2853, transposition 9 December 2026.

Domain: AI & Agent Governance

### Steps

1. art-307-claim-dispute-bundle-builder
   Then the step 2 run takes the step 1 output's receipts unchanged by name and builds the trace digest and rebuttal mapping from them
2. art-308-pld-disclosure-pack-builder
   Then the disclosure and rebuttal pack is built from the bundle's receipts, with gap_in_window flagged when the receipt set is empty, and step 1's insufficient_evidence and bundle_claim_strength shown next to trace_digest and gap_in_window
3. cry-05-agent-action-audit-trail-aggregator
   Then the session receipts are aggregated into the session receipt

### Chain verify

Run the workflow through the MCP server (run_chain at https://mcp.ainumbers.co/mcp) and check each step receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.

### Ask your agent

Question: A product defect is alleged and disclosure is requested. Does the pack trace the bundle's receipts, and is there a gap we must admit?
Run the AINumbers MCP tool `run_chain` with {"chain":"claim-dispute-bundle-to-pld-disclosure-pack"} and read `art-308-pld-disclosure-pack-builder.gap_in_window`.
Re-run with `inputs` for `art-308-pld-disclosure-pack-builder`, reusing the values that result echoed, with `receipts` changed so remove every receipt and watch trace_digest go null and gap_in_window go true. Compare the same field.
Verify: call `verify_execution_hash` (https://mcp.ainumbers.co/mcp) with `claimed_hash` set to `composite_execution_hash` and the full `composite_artifact`.
Ledger, for a human re-check: https://ledger.ainumbers.co/
PII rule: send synthetic or anonymised inputs only. The MCP server runs these kernels and logs no payloads.
Chain page: https://ainumbers.co/chaingraph/chains/claim-dispute-bundle-to-pld-disclosure-pack.html
