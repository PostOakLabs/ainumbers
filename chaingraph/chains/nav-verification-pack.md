# NAV Verification Pack

Fund NAV recomputation from declared inputs > NAV-error materiality testing against a declared policy > fee-waiver-aware expense-ratio check as an independent rider: composite fund NAV verification pack for administrators and auditors.

- Page: https://ainumbers.co/chaingraph/chains/nav-verification-pack.html
- Markdown twin: https://ainumbers.co/chaingraph/chains/nav-verification-pack.md

## Workflow chain: NAV Verification Pack

Fund NAV recomputation from declared inputs > NAV-error materiality testing against a declared policy > fee-waiver-aware expense-ratio check as an independent rider: composite fund NAV verification pack for administrators and auditors.

Domain: Securities Settlement

### Steps

1. art-373-recompute-fund-nav
   recomputed NAV per share, component breakdown, and input digests feed Stage 2 materiality testing and Stage 3 expense-ratio check
2. art-374-test-nav-error-materiality
   material/immaterial verdict and affected-period math complete the primary NAV-verification path
3. art-375-compute-fund-expense-ratios
   gross/net expense ratios and TER computed as an independent rider against the same declared accrual conventions as Stage 1, not sequential on Stage 2

### Chain verify

Run the workflow through the MCP server (run_chain at https://mcp.ainumbers.co/mcp) and check each step receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.
