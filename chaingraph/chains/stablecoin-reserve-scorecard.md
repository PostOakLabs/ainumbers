# Stablecoin Reserve Scorecard

Merkle-sum Proof-of-Reserves verification feeding a MiCA reserve disclosure check, presented as one dated scorecard over an issuer's published attestation.

- Page: https://ainumbers.co/chaingraph/chains/stablecoin-reserve-scorecard.html
- Markdown twin: https://ainumbers.co/chaingraph/chains/stablecoin-reserve-scorecard.md

## Workflow chain: Stablecoin Reserve Scorecard

Merkle-sum Proof-of-Reserves verification feeding a MiCA reserve disclosure check, presented as one dated scorecard over an issuer's published attestation.

Domain: Digital-Asset Rails

### Steps

1. art-280-reserve-proof-verifier
   reserve_proof_determination and not_proven feed the disclosure-level coverage, composition, segregation and cadence check as corroborating cryptographic evidence of the same reserve; each check keeps its own not_proven scope, never merged into a single verdict
2. art-512-check-mica-reserve-disclosure
   coverage, composition, segregation and cadence findings, plus the caller-declared rule set they were checked against, feed the scorecard's export; terminal stage

### Chain verify

Run the workflow through the MCP server (run_chain at https://mcp.ainumbers.co/mcp) and check each step receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.
