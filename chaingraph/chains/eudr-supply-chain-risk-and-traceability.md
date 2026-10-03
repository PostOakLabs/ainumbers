# EUDR Supply-Chain Risk and Traceability

Score country-of-production against EUDR benchmark risk tiers (low/standard/high) and inspection rates 1/3/9% (art-168) -> validate single-DDS upstream traceability linking and custody-chain integrity (art-169) -> A-F EUDR readiness diagnostic across scope, geolocation, DDS submission, risk assessment, mitigation, and retention dimensions (art-170). Full supply-chain risk and readiness pipeline. Reg. EU 2023/1115.

- Page: https://ainumbers.co/chaingraph/chains/eudr-supply-chain-risk-and-traceability.html
- Markdown twin: https://ainumbers.co/chaingraph/chains/eudr-supply-chain-risk-and-traceability.md

## Workflow chain: EUDR Supply-Chain Risk and Traceability

Score country-of-production against EUDR benchmark risk tiers (low/standard/high) and inspection rates 1/3/9% (art-168) -> validate single-DDS upstream traceability linking and custody-chain integrity (art-169) -> A-F EUDR readiness diagnostic across scope, geolocation, DDS submission, risk assessment, mitigation, and retention dimensions (art-170). Full supply-chain risk and readiness pipeline. Reg. EU 2023/1115.

Domain: EUDR

### Steps

1. art-168-eudr-country-benchmark-risk-scorer
   Country benchmark risk feeds traceability linker
2. art-169-eudr-supply-chain-traceability-linker
   Supply-chain integrity verdict feeds readiness diagnostic
3. art-170-eudr-readiness-diagnostic
   Exports A-F EUDR readiness grade with enforcement deadlines with execution_hash - final stage

### Chain verify

Run the workflow through the MCP server (run_chain at https://mcp.ainumbers.co/mcp) and check each step receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.

### Ask your agent

Question: Half our cocoa now ships from a new origin. What due-diligence depth does EUDR demand for that country before we file?
Run the AINumbers MCP tool `run_chain` with {"chain":"eudr-supply-chain-risk-and-traceability"} and read `art-168-eudr-country-benchmark-risk-scorer.benchmark_risk`.
Re-run with `inputs` for `art-168-eudr-country-benchmark-risk-scorer`, reusing the values that result echoed, with `country_code` set to "MM". Compare the same field.
Verify: call `verify_execution_hash` (https://mcp.ainumbers.co/mcp) with `claimed_hash` set to `composite_execution_hash` and the full `composite_artifact`.
Ledger, for a human re-check: https://ledger.ainumbers.co/
PII rule: send synthetic or anonymised inputs only. The MCP server runs these kernels and logs no payloads.
Chain page: https://ainumbers.co/chaingraph/chains/eudr-supply-chain-risk-and-traceability.html
