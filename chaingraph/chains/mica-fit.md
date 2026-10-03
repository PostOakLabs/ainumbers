# MiCA CASP Fit Diagnostic

Single-node D0 diagnostic scoping a CASP's MiCA Title-V lifecycle readiness and routing to the right MiCA chain; ART/EMT-issuer cases route to the existing stablecoin chains.

- Page: https://ainumbers.co/chaingraph/chains/mica-fit.html
- Markdown twin: https://ainumbers.co/chaingraph/chains/mica-fit.md

## Workflow chain: MiCA CASP Fit Diagnostic

Single-node D0 diagnostic scoping a CASP's MiCA Title-V lifecycle readiness and routing to the right MiCA chain; ART/EMT-issuer cases route to the existing stablecoin chains.

Domain: Digital-Asset Rails

### Steps

1. art-98-mica-casp-fit-diagnostic
   readiness grade routes to mica-casp-authorization / mica-transitional / mica-whitepaper / mica-mar-surveillance / mica-travel-rule / mica-token-scoping / mica-audit-pack

### Chain verify

Run the workflow through the MCP server (run_chain at https://mcp.ainumbers.co/mcp) and check each step receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.

### Ask your agent

Question: We plan to passport custody services into the EU. What readiness grade would our current MiCA posture earn?
Run the AINumbers MCP tool `run_chain` with {"chain":"mica-fit"} and read `art-98-mica-casp-fit-diagnostic.readiness_grade`.
Re-run with `inputs` for `art-98-mica-casp-fit-diagnostic`, reusing the values that result echoed, with `inputs` changed so the posture is authorisation-stage with own funds and MAR arrangements in place. Compare the same field.
Verify: call `verify_execution_hash` (https://mcp.ainumbers.co/mcp) with `claimed_hash` set to `composite_execution_hash` and the full `composite_artifact`.
Ledger, for a human re-check: https://ledger.ainumbers.co/
PII rule: send synthetic or anonymised inputs only. The MCP server runs these kernels and logs no payloads.
Chain page: https://ainumbers.co/chaingraph/chains/mica-fit.html
