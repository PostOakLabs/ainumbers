# Cleared Repo Margin & Haircut

W-B. FICC VaR-margin estimate (ART-50) -> CRE22/d349 repo haircuts (508) -> margin-call collateral mobilization (513) -> portfolio VaR distribution (qfa-02).

- Page: https://ainumbers.co/chaingraph/chains/treasury-clearing-repo-margin.html
- Markdown twin: https://ainumbers.co/chaingraph/chains/treasury-clearing-repo-margin.md

## Workflow chain: Cleared Repo Margin & Haircut

W-B. FICC VaR-margin estimate (ART-50) -> CRE22/d349 repo haircuts (508) -> margin-call collateral mobilization (513) -> portfolio VaR distribution (qfa-02).

Domain: Treasury Clearing

### Steps

1. art-50-ficc-margin-netting-estimator
   net_cleared_im + margin_by_bucket feed the haircut calculator
2. 508-repo-haircut-collateral-calculator
   haircut-adjusted collateral value feeds the mobilizer
3. 513-margin-call-collateral-mobilizer
   mobilization plan + shortfall feed the VaR engine
4. qfa-02-portfolio-var-engine
   Exports composite repo-margin artifact - final stage

### Chain verify

Run the workflow through the MCP server (run_chain at https://mcp.ainumbers.co/mcp) and check each step receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.
