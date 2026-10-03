# FFIEC Call Report Edit-Check Gate (Schedule RC + RC-R)

Schedule RC balance-sheet mapper and Schedule RC-R capital mapper feed the Call Report edit-check gate, which runs cross-schedule identity and capital-stack checks and emits an auto_pass / review_required §27 gate verdict.

- Page: https://ainumbers.co/chaingraph/chains/call-report-edit-gate.html
- Markdown twin: https://ainumbers.co/chaingraph/chains/call-report-edit-gate.md

## Workflow chain: FFIEC Call Report Edit-Check Gate (Schedule RC + RC-R)

Schedule RC balance-sheet mapper and Schedule RC-R capital mapper feed the Call Report edit-check gate, which runs cross-schedule identity and capital-stack checks and emits an auto_pass / review_required §27 gate verdict.

Domain: Bank Capital & Credit Risk

### Steps

1. art-432-call-report-rc-balance-sheet
   RC balance-sheet totals (total assets, liabilities, equity capital) feed Stage 3 cross-schedule edit checks
2. art-433-call-report-rcr-capital
   RC-R capital ratios and RWA feed Stage 3 cross-schedule edit checks against Stage 1 Schedule RC
3. art-434-call-report-edit-check-gate
   emits per-check pass/fail verdicts plus an auto_pass | review_required gate_status for the §27 dual_control/review_required gate ahead of submission-evidence export; terminal check

### Chain verify

Run the workflow through the MCP server (run_chain at https://mcp.ainumbers.co/mcp) and check each step receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.

### Ask your agent

Question: Quarter-end capital numbers are in. Does the total capital ratio still clear the declared minimum before this Call Report goes out?
Run the AINumbers MCP tool `run_chain` with {"chain":"call-report-edit-gate"} and read `art-433-call-report-rcr-capital.ratios.total_capital_pass`.
Re-run with `inputs` for `art-433-call-report-rcr-capital`, reusing the values that result echoed, with `total_rwa_usd` set to 3000000000. Compare the same field.
Verify: call `verify_execution_hash` (https://mcp.ainumbers.co/mcp) with `claimed_hash` set to `composite_execution_hash` and the full `composite_artifact`.
Ledger, for a human re-check: https://ledger.ainumbers.co/
PII rule: send synthetic or anonymised inputs only. The MCP server runs these kernels and logs no payloads.
Chain page: https://ainumbers.co/chaingraph/chains/call-report-edit-gate.html
