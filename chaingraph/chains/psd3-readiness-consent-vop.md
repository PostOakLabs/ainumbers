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
