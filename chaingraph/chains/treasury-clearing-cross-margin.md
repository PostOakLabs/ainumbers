# FICC-CME Cross-Margining Benefit

W-C. Cross-margining IM-reduction estimate (ART-51, FICC-CME customer expansion Dec 2025) -> combined-netting-set VaR (qfa-02) -> stress test of the offset under 6 historical crises (qfa-03).

- Page: https://ainumbers.co/chaingraph/chains/treasury-clearing-cross-margin.html
- Markdown twin: https://ainumbers.co/chaingraph/chains/treasury-clearing-cross-margin.md

## Workflow chain: FICC-CME Cross-Margining Benefit

W-C. Cross-margining IM-reduction estimate (ART-51, FICC-CME customer expansion Dec 2025) -> combined-netting-set VaR (qfa-02) -> stress test of the offset under 6 historical crises (qfa-03).

Domain: Treasury Clearing

### Steps

1. art-51-cross-margining-benefit-estimator
   im_reduction + eligible_offsets feed the VaR engine
2. qfa-02-portfolio-var-engine
   combined VaR feeds the stress engine
3. qfa-03-stress-test-engine
   Exports composite cross-margin artifact - final stage

### Chain verify

Run the workflow through the MCP server (run_chain at https://mcp.ainumbers.co/mcp) and check each step receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.
