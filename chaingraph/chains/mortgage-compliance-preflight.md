# Mortgage Compliance Preflight

Gated four-step preflight: Reg Z threshold lookup -> TRID APR accuracy check (gate: exit on understated_violation) -> QM points-and-fees test (gate: exit on fail) -> QM APR-APOR spread classification. First live OCG gated chain using OCG §21.4 decision gates.

- Page: https://ainumbers.co/chaingraph/chains/mortgage-compliance-preflight.html
- Markdown twin: https://ainumbers.co/chaingraph/chains/mortgage-compliance-preflight.md

## Workflow chain: Mortgage Compliance Preflight

Gated four-step preflight: Reg Z threshold lookup -> TRID APR accuracy check (gate: exit on understated_violation) -> QM points-and-fees test (gate: exit on fail) -> QM APR-APOR spread classification. First live OCG gated chain using OCG §21.4 decision gates.

Domain: Consumer Lending & Fair Lending

### Steps

1. art-220-reg-z-threshold-lookup
   Version-pinned threshold tables feed downstream QM and TRID nodes
2. art-217-trid-apr-accuracy
   verdict feeds Stage 3 QM points-and-fees; understated_violation stops the chain
3. art-218-qm-points-and-fees
   pass flag feeds Stage 4 QM spread; points-and-fees failure stops the chain
4. art-219-qm-apr-apor-spread
   qm_status and is_hpct complete the preflight report - final stage

### Chain verify

Run the workflow through the MCP server (run_chain at https://mcp.ainumbers.co/mcp) and check each step receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.

### Ask your agent

Question: Before this file is priced as a QM, do the points and fees clear the 2026 cap?
Run the AINumbers MCP tool `run_chain` with {"chain":"mortgage-compliance-preflight"} and read `art-218-qm-points-and-fees.pass`.
Re-run with `inputs` for `art-218-qm-points-and-fees`, reusing the values that result echoed, with `points_and_fees` set to 15000. Compare the same field.
Verify: call `verify_execution_hash` (https://mcp.ainumbers.co/mcp) with `claimed_hash` set to `composite_execution_hash` and the full `composite_artifact`.
Ledger, for a human re-check: https://ledger.ainumbers.co/
PII rule: send synthetic or anonymised inputs only. The MCP server runs these kernels and logs no payloads.
Chain page: https://ainumbers.co/chaingraph/chains/mortgage-compliance-preflight.html
