# Certified Payroll Compliance Pack

Check a federal construction week's payroll end to end in two recompute stages: first recompute whether each worker on a caller-declared certified payroll was paid at or above the wage-determination rate for their classification, with Contract Work Hours and Safety Standards Act overtime at time-and-a-half on the basic hourly rate (ART-574), then attest that the week's bulk disbursement run is internally consistent and matches its authorized control total in count and value, with duplicate candidates, roster movement, and limit breaches surfaced (ART-518), closing with a session receipt aggregating the run's execution hashes (CRY-05). Payroll rows, wage determinations, payee records, and control totals are caller-supplied inputs; a deficiency or a reconciliation break is an arithmetic finding, never a legal determination. Not legal advice.

- Page: https://ainumbers.co/chaingraph/chains/certified-payroll-compliance-pack.html
- Markdown twin: https://ainumbers.co/chaingraph/chains/certified-payroll-compliance-pack.md

## Workflow chain: Certified Payroll Compliance Pack

Check a federal construction week's payroll end to end in two recompute stages: first recompute whether each worker on a caller-declared certified payroll was paid at or above the wage-determination rate for their classification, with Contract Work Hours and Safety Standards Act overtime at time-and-a-half on the basic hourly rate (ART-574), then attest that the week's bulk disbursement run is internally consistent and matches its authorized control total in count and value, with duplicate candidates, roster movement, and limit breaches surfaced (ART-518), closing with a session receipt aggregating the run's execution hashes (CRY-05). Payroll rows, wage determinations, payee records, and control totals are caller-supplied inputs; a deficiency or a reconciliation break is an arithmetic finding, never a legal determination. Not legal advice.

Domain: HR & Benefits Compliance

### Steps

1. art-574-certified-payroll-prevailing-wage-recompute
   Recomputes, for one stated certified-payroll week, whether each worker on a caller-declared payroll was paid at or above the wage-determination rate for their classification, with Contract Work Hours and Safety Standards Act overtime at time-and-a-half on the basic hourly rate and fringe due straight-time for every hour
2. art-518-bulk-disbursement-integrity
   Attests that a bulk payment run is internally consistent and matches its authorization: reconciles per-payee records against the authorized control total in count and value, surfaces duplicate-candidate clusters, reports payee roster movement against the prior run, and flags limit breaches
3. cry-05-agent-action-audit-trail-aggregator
   Produces session_receipt_root, the Merkle root over the run's execution_hashes (final stage)

### Chain verify

Run the workflow through the MCP server (run_chain at https://mcp.ainumbers.co/mcp) and check each step receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.

### Ask your agent

Question: Our subcontractor's certified payroll for the week is ready to pay. Did every worker meet the prevailing wage, and does the payment run match its control total?
Run the AINumbers MCP tool `run_chain` with {"chain":"certified-payroll-compliance-pack"} and read `art-518-bulk-disbursement-integrity.control_total_reconciled`.
Re-run with `inputs` for `art-518-bulk-disbursement-integrity`, reusing the values that result echoed, with `per_run_limit_minor_units` set to 50000000. Compare the same field.
Verify: call `verify_execution_hash` (https://mcp.ainumbers.co/mcp) with `claimed_hash` set to `composite_execution_hash` and the full `composite_artifact`.
Ledger, for a human re-check: https://ledger.ainumbers.co/
PII rule: send synthetic or anonymised inputs only. The MCP server runs these kernels and logs no payloads.
Chain page: https://ainumbers.co/chaingraph/chains/certified-payroll-compliance-pack.html
