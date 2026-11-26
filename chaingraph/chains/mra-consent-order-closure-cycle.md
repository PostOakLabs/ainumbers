# Consent-Order / MRA Remediation Closure Cycle

Single-stage register cycle over an institution's own consent-order Articles or MRA findings and its own remediation-status records. The register computes, per issue, milestone completeness (every committed milestone closed with evidence attached), evidence validity (delivered evidence type matches what the milestone itself declares it calls for), and overdue or on-track timing against each issue's own committed date, reusing the RO remediation-closure cycle's cutoff arithmetic unchanged. The rollup emits the closed human-accountability decision enum: auto_pass, review_required, escalate, or hold. hold and escalate route the register to an exception step naming the issue owner as reviewer; review_required routes to the compliance officer; and a fully closed register that reaches auto_pass still requires a named-human approval record rather than an automatic pass, because whether remediation was appropriate, timely, and sustainable is exactly the judgment the approval record exists to evidence, not to automate. The approver is bound to the institution's own MRA or consent-order response-owner role, named exactly as the order itself names it. The bundle evidences the institution's own basis for asserting closure; it does not itself satisfy a supervisor's own closure determination.

- Page: https://ainumbers.co/chaingraph/chains/mra-consent-order-closure-cycle.html
- Markdown twin: https://ainumbers.co/chaingraph/chains/mra-consent-order-closure-cycle.md

## Workflow chain: Consent-Order / MRA Remediation Closure Cycle

Single-stage register cycle over an institution's own consent-order Articles or MRA findings and its own remediation-status records. The register computes, per issue, milestone completeness (every committed milestone closed with evidence attached), evidence validity (delivered evidence type matches what the milestone itself declares it calls for), and overdue or on-track timing against each issue's own committed date, reusing the RO remediation-closure cycle's cutoff arithmetic unchanged. The rollup emits the closed human-accountability decision enum: auto_pass, review_required, escalate, or hold. hold and escalate route the register to an exception step naming the issue owner as reviewer; review_required routes to the compliance officer; and a fully closed register that reaches auto_pass still requires a named-human approval record rather than an automatic pass, because whether remediation was appropriate, timely, and sustainable is exactly the judgment the approval record exists to evidence, not to automate. The approver is bound to the institution's own MRA or consent-order response-owner role, named exactly as the order itself names it. The bundle evidences the institution's own basis for asserting closure; it does not itself satisfy a supervisor's own closure determination.

Domain: Audit & Assurance

### Steps

1. art-533-mra-remediation-closure-register
   Per-issue milestone completeness, evidence validity and overdue/on-track determinations, plus the rollup closed decision enum, close the closure-evidence bundle. Single stage.

### Chain verify

Run the workflow through the MCP server (run_chain at https://mcp.ainumbers.co/mcp) and check each step receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.

### Ask your agent

Question: Can we tell the examiner this matter requiring attention is closed, or is any committed milestone still open or overdue?
Run the AINumbers MCP tool `run_chain` with {"chain":"mra-consent-order-closure-cycle"} and read `art-533-mra-remediation-closure-register.closed_count`.
Re-run with `inputs` for `art-533-mra-remediation-closure-register`, reusing the values that result echoed, with `remediation_status` changed so remediation_status lists only milestone MS-1, so MS-2 has no closure record. Compare the same field.
Verify: call `verify_execution_hash` (https://mcp.ainumbers.co/mcp) with `claimed_hash` set to `composite_execution_hash` and the full `composite_artifact`.
Ledger, for a human re-check: https://ledger.ainumbers.co/
PII rule: send synthetic or anonymised inputs only. The MCP server runs these kernels and logs no payloads.
Chain page: https://ainumbers.co/chaingraph/chains/mra-consent-order-closure-cycle.html
