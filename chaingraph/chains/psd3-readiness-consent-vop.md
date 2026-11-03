# PSD3 Readiness, Consent Stress and VoP Match Rate

Three independent computations over an open-banking payment-initiation surface. Step 1 scores the six-domain PSD3 and PSR readiness rubric and produces a prioritised gap table (art-14). Step 2 stresses the consent-lifecycle state machine by Monte Carlo and checks the ASPSP availability threshold (sim-07). Step 3 analyses batch payee name-match rates at the declared strictness (art-11). Each step computes from its own declared inputs; the order is analytical. The graph dates PSD3 readiness at 2027-06-01.

- Page: https://ainumbers.co/chaingraph/chains/psd3-readiness-consent-vop.html
- Markdown twin: https://ainumbers.co/chaingraph/chains/psd3-readiness-consent-vop.md

## Workflow chain: PSD3 Readiness, Consent Stress and VoP Match Rate

Three independent computations over an open-banking payment-initiation surface. Step 1 scores the six-domain PSD3 and PSR readiness rubric and produces a prioritised gap table (art-14). Step 2 stresses the consent-lifecycle state machine by Monte Carlo and checks the ASPSP availability threshold (sim-07). Step 3 analyses batch payee name-match rates at the declared strictness (art-11). Each step computes from its own declared inputs; the order is analytical. The graph dates PSD3 readiness at 2027-06-01.

Domain: Open Banking / Open Finance

### Steps

1. art-14-psd3-psr-readiness-checker
   Six-domain PSD3 and PSR readiness scores with a prioritised gap table. Stage 1 of 3.
2. sim-07-open-banking-consent-flow-stress
   Consent-lifecycle terminal-state distribution and the ASPSP availability compliance check. Stage 2 of 3.
3. art-11-vop-batch-match-rate-analyser
   Batch match, close-match and no-match counts with the resulting match rate at the declared strictness. Final stage.

### Chain verify

Run the workflow through the MCP server (run_chain at https://mcp.ainumbers.co/mcp) and check each step receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.

### Ask your agent

Question: What share of open-banking consent flows complete end to end, and does that clear the regulatory success threshold?
Run the AINumbers MCP tool `run_chain` with {"chain":"psd3-readiness-consent-vop"} and read `sim-07-open-banking-consent-flow-stress.success_rate`.
Re-run with `inputs` for `sim-07-open-banking-consent-flow-stress`, reusing the values that result echoed, with `pAuthFail` set to 0.01. Compare the same field.
Verify: call `verify_execution_hash` (https://mcp.ainumbers.co/mcp) with `claimed_hash` set to `composite_execution_hash` and the full `composite_artifact`.
Ledger, for a human re-check: https://ledger.ainumbers.co/
PII rule: send synthetic or anonymised inputs only. The MCP server runs these kernels and logs no payloads.
Chain page: https://ainumbers.co/chaingraph/chains/psd3-readiness-consent-vop.html
