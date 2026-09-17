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
