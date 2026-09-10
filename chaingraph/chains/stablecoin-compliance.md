# Stablecoin Compliance (GENIUS Act / MiCA)

Issuance architecture > reserve stress testing > GENIUS Act compliance > MiCA white paper / CASP > composite stablecoin compliance mandate.

- Page: https://ainumbers.co/chaingraph/chains/stablecoin-compliance.html
- Markdown twin: https://ainumbers.co/chaingraph/chains/stablecoin-compliance.md

## Workflow chain: Stablecoin Compliance (GENIUS Act / MiCA)

Issuance architecture > reserve stress testing > GENIUS Act compliance > MiCA white paper / CASP > composite stablecoin compliance mandate.

Domain: Digital-Asset Rails

### Steps

1. 53-cbdc-architecture-comparator
   architecture_choice feeds Stage 2 reserve stress testing
2. 388-stablecoin-reserve-stress-test-modeller
   reserve_adequacy and stress_results feed Stage 3 GENIUS Act check
3. 386-genius-act-payment-stablecoin-compliance-checker
   genius_compliance_status feeds Stage 4 MiCA white paper
4. 390-mica-white-paper-builder
   Exports stablecoin compliance Policy Mandate - final stage

### Chain verify

Run the workflow through the MCP server (run_chain at https://mcp.ainumbers.co/mcp) and check each step receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.
