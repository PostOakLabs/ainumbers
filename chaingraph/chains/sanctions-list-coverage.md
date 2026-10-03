# Screening List-Coverage Conformance

Screening config conformance vs EU consolidated + UN + UK Sanctions List (post-OFSI-closure 28 Jan 2026) + OFAC SDN with nexus gating (ART-92) -> Merkle integrity (cry-04).

- Page: https://ainumbers.co/chaingraph/chains/sanctions-list-coverage.html
- Markdown twin: https://ainumbers.co/chaingraph/chains/sanctions-list-coverage.md

## Workflow chain: Screening List-Coverage Conformance

Screening config conformance vs EU consolidated + UN + UK Sanctions List (post-OFSI-closure 28 Jan 2026) + OFAC SDN with nexus gating (ART-92) -> Merkle integrity (cry-04).

Domain: Sanctions

### Steps

1. art-92-screening-list-coverage-checker
   coverage grade + gaps (H1) feed the verifier
2. cry-04-merkle-batch-verifier
   Exports composite coverage artifact with Merkle-root execution_hash (H2) - final stage

### Chain verify

Run the workflow through the MCP server (run_chain at https://mcp.ainumbers.co/mcp) and check each step receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.

### Ask your agent

Question: Our screener covers four lists on a weekly cycle and we on-board EU clients. Does that coverage meet the required set?
Run the AINumbers MCP tool `run_chain` with {"chain":"sanctions-list-coverage"} and read `art-92-screening-list-coverage-checker.coverage_pct`.
Re-run with `inputs` for `art-92-screening-list-coverage-checker`, reusing the values that result echoed, with `config` changed so it screens all four required lists with weekly refresh and an EU nexus. Compare the same field.
Verify: call `verify_execution_hash` (https://mcp.ainumbers.co/mcp) with `claimed_hash` set to `composite_execution_hash` and the full `composite_artifact`.
Ledger, for a human re-check: https://ledger.ainumbers.co/
PII rule: send synthetic or anonymised inputs only. The MCP server runs these kernels and logs no payloads.
Chain page: https://ainumbers.co/chaingraph/chains/sanctions-list-coverage.html
