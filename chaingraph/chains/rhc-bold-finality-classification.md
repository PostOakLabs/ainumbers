# Robinhood Chain BoLD Finality Classification

Gated two-step chain classifying settlement finality on Robinhood Chain. Step 1 classifies the underlying settlement asset finality, step 2 classifies the BoLD challenge-window state. Gate on /claim_verdict: overstated routes to a false-finality-claim flag, default proceeds to the finality class record.

- Page: https://ainumbers.co/chaingraph/chains/rhc-bold-finality-classification.html
- Markdown twin: https://ainumbers.co/chaingraph/chains/rhc-bold-finality-classification.md

## Workflow chain: Robinhood Chain BoLD Finality Classification

Gated two-step chain classifying settlement finality on Robinhood Chain. Step 1 classifies the underlying settlement asset finality, step 2 classifies the BoLD challenge-window state. Gate on /claim_verdict: overstated routes to a false-finality-claim flag, default proceeds to the finality class record.

Domain: Digital-Asset Rails

### Steps

1. art-59-settlement-asset-finality-classifier
   settlement asset finality classification feeds the BoLD challenge-window check.
2. art-321-rhc-bold-finality-classifier
   finality_class, earliest_final_at, and claim_verdict are the chain output.

### Chain verify

Run the workflow through the MCP server (run_chain at https://mcp.ainumbers.co/mcp) and check each step receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.

### Ask your agent

Question: The bridge dashboard shows a settlement as final. Is the BoLD challenge window expired for that assertion?
Run the AINumbers MCP tool `run_chain` with {"chain":"rhc-bold-finality-classification"} and read `art-321-rhc-bold-finality-classifier.finality_class`.
Re-run with `inputs` for `art-321-rhc-bold-finality-classifier`, reusing the values that result echoed, with `current_time` set to 600000. Compare the same field.
Verify: call `verify_execution_hash` (https://mcp.ainumbers.co/mcp) with `claimed_hash` set to `composite_execution_hash` and the full `composite_artifact`.
Ledger, for a human re-check: https://ledger.ainumbers.co/
PII rule: send synthetic or anonymised inputs only. The MCP server runs these kernels and logs no payloads.
Chain page: https://ainumbers.co/chaingraph/chains/rhc-bold-finality-classification.html
