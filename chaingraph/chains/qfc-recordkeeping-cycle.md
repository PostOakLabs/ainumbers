# QFC Part 371 Recordkeeping Cycle

Single-stage cycle over an institution's own 12 CFR part 371 qualified-financial-contract position, counterparty, and collateral file. The validator checks the file's shape against the appendix's published record layout and ties the file's declared totals to a supplied control-total summary, reporting a shape defect and a totals mismatch as two separate, never-merged findings. The rollup emits the closed decision enum: auto_pass, review_required, or escalate (did_not_run when no control-total summary is supplied). A file nonconformance routes the finding to internal audit as reviewer; the daily-capability recordkeeping check closes with a preparer/reviewer pair rather than a named external approver, since this is an internal standing test rather than a supervisor-facing filing - an approver role binding stays available where the institution runs this co-sourced. The bundle evidences the institution's own basis for asserting part 371 recordkeeping conformance; it is not a filing and offers no advice on whether a contract is in fact a covered QFC.

- Page: https://ainumbers.co/chaingraph/chains/qfc-recordkeeping-cycle.html
- Markdown twin: https://ainumbers.co/chaingraph/chains/qfc-recordkeeping-cycle.md

## Workflow chain: QFC Part 371 Recordkeeping Cycle

Single-stage cycle over an institution's own 12 CFR part 371 qualified-financial-contract position, counterparty, and collateral file. The validator checks the file's shape against the appendix's published record layout and ties the file's declared totals to a supplied control-total summary, reporting a shape defect and a totals mismatch as two separate, never-merged findings. The rollup emits the closed decision enum: auto_pass, review_required, or escalate (did_not_run when no control-total summary is supplied). A file nonconformance routes the finding to internal audit as reviewer; the daily-capability recordkeeping check closes with a preparer/reviewer pair rather than a named external approver, since this is an internal standing test rather than a supervisor-facing filing - an approver role binding stays available where the institution runs this co-sourced. The bundle evidences the institution's own basis for asserting part 371 recordkeeping conformance; it is not a filing and offers no advice on whether a contract is in fact a covered QFC.

Domain: Audit & Assurance

### Steps

1. art-537-qfc-recordkeeping-file-validator
   File-shape validation against the part 371 appendix record layout plus a control-total tie-out, and the rollup closed decision enum, close the recordkeeping-conformance evidence pack. Single stage.

### Chain verify

Run the workflow through the MCP server (run_chain at https://mcp.ainumbers.co/mcp) and check each step receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.

### Ask your agent

Question: The QFC recordkeeping file is ready to file. Do its declared totals tie to the control summary behind it?
Run the AINumbers MCP tool `run_chain` with {"chain":"qfc-recordkeeping-cycle"} and read `art-537-qfc-recordkeeping-file-validator.decision.gate_policy`.
Re-run with `inputs` for `art-537-qfc-recordkeeping-file-validator`, reusing the values that result echoed, with `control_totals` changed so its position_count is 3 while the file declares 2. Compare the same field.
Verify: call `verify_execution_hash` (https://mcp.ainumbers.co/mcp) with `claimed_hash` set to `composite_execution_hash` and the full `composite_artifact`.
Ledger, for a human re-check: https://ledger.ainumbers.co/
PII rule: send synthetic or anonymised inputs only. The MCP server runs these kernels and logs no payloads.
Chain page: https://ainumbers.co/chaingraph/chains/qfc-recordkeeping-cycle.html
