# Arc xReserve Issuance Compliance

W-C chain. Lint Arc xReserve config for GENIUS Act §4 eligible assets, yield prohibition (§4(a)(11)), MiCA Art. 54, and USYC composition.

- Page: https://ainumbers.co/chaingraph/chains/arc-xreserve-issuance.html
- Markdown twin: https://ainumbers.co/chaingraph/chains/arc-xreserve-issuance.md

## Workflow chain: Arc xReserve Issuance Compliance

W-C chain. Lint Arc xReserve config for GENIUS Act §4 eligible assets, yield prohibition (§4(a)(11)), MiCA Art. 54, and USYC composition.

Domain: Digital-Asset Rails

### Steps

1. art-42-arc-fit-diagnostic
   arc_score → xReserve/issuance dimension
2. art-45-arc-xreserve-linter
   grade, checks_failed, compliance_verdict - xReserve compliance - final stage

### Chain verify

Run the workflow through the MCP server (run_chain at https://mcp.ainumbers.co/mcp) and check each step receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.

### Ask your agent

Question: Before we issue a stablecoin through xReserve on Arc, does the reserve mix and mint-control setup clear every check?
Run the AINumbers MCP tool `run_chain` with {"chain":"arc-xreserve-issuance"} and read `art-45-arc-xreserve-linter.verdict`.
Re-run with `inputs` for `art-45-arc-xreserve-linter`, reusing the values that result echoed, with `cctp_domains` set to 0. Compare the same field.
Verify: call `verify_execution_hash` (https://mcp.ainumbers.co/mcp) with `claimed_hash` set to `composite_execution_hash` and the full `composite_artifact`.
Ledger, for a human re-check: https://ledger.ainumbers.co/
PII rule: send synthetic or anonymised inputs only. The MCP server runs these kernels and logs no payloads.
Chain page: https://ainumbers.co/chaingraph/chains/arc-xreserve-issuance.html
