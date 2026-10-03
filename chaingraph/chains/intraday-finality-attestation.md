# Intraday Finality Attestation Receipt

Five-step shared-ledger intraday finality receipt: settlement-asset finality-regime classification, Linea L2 finality-window classification, on-chain cash-leg finality check, settlement-orchestrator ship-readiness attestation, and a document-integrity anchor over the composite digest. Composes into replayable evidence of "final at window Y" for a correspondent bank or auditor. Verify-only - never asserts on-chain settlement it did not observe. The receipt does not yet carry a receipt:// resolver link (pending the N1 MCP Resources work); this is a planned upgrade, not a missing requirement.

- Page: https://ainumbers.co/chaingraph/chains/intraday-finality-attestation.html
- Markdown twin: https://ainumbers.co/chaingraph/chains/intraday-finality-attestation.md

## Workflow chain: Intraday Finality Attestation Receipt

Five-step shared-ledger intraday finality receipt: settlement-asset finality-regime classification, Linea L2 finality-window classification, on-chain cash-leg finality check, settlement-orchestrator ship-readiness attestation, and a document-integrity anchor over the composite digest. Composes into replayable evidence of "final at window Y" for a correspondent bank or auditor. Verify-only - never asserts on-chain settlement it did not observe. The receipt does not yet carry a receipt:// resolver link (pending the N1 MCP Resources work); this is a planned upgrade, not a missing requirement.

Domain: Verification & Proof Receipts

### Steps

1. art-59-settlement-asset-finality-classifier
   finality_tier and singleness_verdict feed the L2 finality-window classification
2. art-290-check-linea-l2-finality-window
   finality_tier and safe_to_release feed the on-chain cash-leg finality check
3. 506-onchain-cash-leg-finality-checker
   cash-leg verdict feeds the settlement-orchestrator attestation
4. art-292-attest-settlement-orchestrator
   composite ship-readiness grade completes the intraday finality attestation; feeds the optional document-integrity anchor
5. art-121-document-integrity-anchor
   Anchors the composite receipt digest as an eIDAS Art.41-aligned electronic timestamp. Optional terminal stage.

### Chain verify

Run the workflow through the MCP server (run_chain at https://mcp.ainumbers.co/mcp) and check each step receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.

### Ask your agent

Question: Can we release the cash leg of this atomic settlement now, or does its finality model hold the payment?
Run the AINumbers MCP tool `run_chain` with {"chain":"intraday-finality-attestation"} and read `506-onchain-cash-leg-finality-checker.verdict`.
Re-run with `inputs` for `506-onchain-cash-leg-finality-checker`, reusing the values that result echoed, with `finality_model` set to "traditional_wire". Compare the same field.
Verify: call `verify_execution_hash` (https://mcp.ainumbers.co/mcp) with `claimed_hash` set to `composite_execution_hash` and the full `composite_artifact`.
Ledger, for a human re-check: https://ledger.ainumbers.co/
PII rule: send synthetic or anonymised inputs only. The MCP server runs these kernels and logs no payloads.
Chain page: https://ainumbers.co/chaingraph/chains/intraday-finality-attestation.html
