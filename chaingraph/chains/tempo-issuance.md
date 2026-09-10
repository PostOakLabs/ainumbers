# Tempo Stablecoin Issuance

W-B chain. TIP-20 config lint + TIP-403 policy design → GENIUS Act reserve pre-check → AML typology pre-screen. Dual US GENIUS PPSI + EU MiCA EMT compliance.

- Page: https://ainumbers.co/chaingraph/chains/tempo-issuance.html
- Markdown twin: https://ainumbers.co/chaingraph/chains/tempo-issuance.md

## Workflow chain: Tempo Stablecoin Issuance

W-B chain. TIP-20 config lint + TIP-403 policy design → GENIUS Act reserve pre-check → AML typology pre-screen. Dual US GENIUS PPSI + EU MiCA EMT compliance.

Domain: Digital-Asset Rails

### Steps

1. art-37-tempo-stablecoin-issuance
   genius_checks, mica_checks, overall_verdict, and issuer_lei feed Stage 2 reserve pre-check
2. art-06-genius-act-reserve-attestation
   reserve_attestation verdict feeds Stage 3 AML pre-screen
3. art-10-amla-transaction-typology-risk-scorer
   Exports composite stablecoin issuance compliance mandate - final stage

### Chain verify

Run the workflow through the MCP server (run_chain at https://mcp.ainumbers.co/mcp) and check each step receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.
