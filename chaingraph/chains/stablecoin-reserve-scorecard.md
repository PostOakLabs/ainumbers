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

### Ask your agent

Question: The issuer June reserve disclosure is in. Does the declared reserve mix still cover tokens in circulation under MiCA?
Run the AINumbers MCP tool `run_chain` with {"chain":"stablecoin-reserve-scorecard"} and read `art-512-check-mica-reserve-disclosure.segregation.meets_declared_minimum`.
Re-run with `inputs` for `art-512-check-mica-reserve-disclosure`, reusing the values that result echoed, with `token_type` set to "ART". Compare the same field.
Verify: call `verify_execution_hash` (https://mcp.ainumbers.co/mcp) with `claimed_hash` set to `composite_execution_hash` and the full `composite_artifact`.
Ledger, for a human re-check: https://ledger.ainumbers.co/
PII rule: send synthetic or anonymised inputs only. The MCP server runs these kernels and logs no payloads.
Chain page: https://ainumbers.co/chaingraph/chains/stablecoin-reserve-scorecard.html
