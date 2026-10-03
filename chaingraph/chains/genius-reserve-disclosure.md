# GENIUS Act Monthly Reserve Disclosure

Single-node D0 diagnostic linting an extracted monthly reserve disclosure against GENIUS Act S.394 §4: composition, tenor, custody, certification, examiner, MoM diff, on-chain supply cross-check. Carries a terminal §27 dual_control(2) CEO/CFO accountability gate (threshold 2 over role approver); a FAIL /monthly_disclosure_determination routes to the reserved escalate target.

- Page: https://ainumbers.co/chaingraph/chains/genius-reserve-disclosure.html
- Markdown twin: https://ainumbers.co/chaingraph/chains/genius-reserve-disclosure.md

## Workflow chain: GENIUS Act Monthly Reserve Disclosure

Single-node D0 diagnostic linting an extracted monthly reserve disclosure against GENIUS Act S.394 §4: composition, tenor, custody, certification, examiner, MoM diff, on-chain supply cross-check. Carries a terminal §27 dual_control(2) CEO/CFO accountability gate (threshold 2 over role approver); a FAIL /monthly_disclosure_determination routes to the reserved escalate target.

Domain: Digital-Asset Rails

### Steps

1. art-275-genius-reserve-disclosure-checker
   monthly_disclosure_determination and failing_dimensions feed the issuer's compliance record; a FAIL determination routes to the reserved escalate target; standalone monthly recurring check

### Chain verify

Run the workflow through the MCP server (run_chain at https://mcp.ainumbers.co/mcp) and check each step receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.

### Ask your agent

Question: The monthly reserve disclosure is drafted. Will it pass the GENIUS monthly check as written, or does something in the pack still fail?
Run the AINumbers MCP tool `run_chain` with {"chain":"genius-reserve-disclosure"} and read `art-275-genius-reserve-disclosure-checker.monthly_disclosure_determination`.
Verify: call `verify_execution_hash` (https://mcp.ainumbers.co/mcp) with `claimed_hash` set to `composite_execution_hash` and the full `composite_artifact`.
Ledger, for a human re-check: https://ledger.ainumbers.co/
PII rule: send synthetic or anonymised inputs only. The MCP server runs these kernels and logs no payloads.
Chain page: https://ainumbers.co/chaingraph/chains/genius-reserve-disclosure.html
