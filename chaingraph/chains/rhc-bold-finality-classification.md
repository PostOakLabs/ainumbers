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
