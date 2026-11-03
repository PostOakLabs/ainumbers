# Take-Home Pay Check

Verify a paycheck's take-home pay in three stages: IRS Publication 15-T percentage-method federal withholding (ART-338), FICA and net-pay computation (ART-339), then a session receipt aggregating the run's execution hashes (CRY-05). Federal taxes only; state and local withholding are out of scope. Not tax advice.

- Page: https://ainumbers.co/chaingraph/chains/paycheck-take-home-check.html
- Markdown twin: https://ainumbers.co/chaingraph/chains/paycheck-take-home-check.md

## Workflow chain: Take-Home Pay Check

Verify a paycheck's take-home pay in three stages: IRS Publication 15-T percentage-method federal withholding (ART-338), FICA and net-pay computation (ART-339), then a session receipt aggregating the run's execution hashes (CRY-05). Federal taxes only; state and local withholding are out of scope. Not tax advice.

Domain: Consumer & Wealth Compliance

### Steps

1. art-338-compute-federal-withholding
   Produces federal_withholding_per_period via the IRS Publication 15-T percentage method; tax_year is declared identically on both compute nodes
2. art-339-compute-gross-to-net
   Produces net_pay with the FICA breakdown; the run's execution_hash anchors this stage
3. cry-05-agent-action-audit-trail-aggregator
   Produces session_receipt_root, the Merkle root over the run's execution_hashes (final stage)

### Chain verify

Run the workflow through the MCP server (run_chain at https://mcp.ainumbers.co/mcp) and check each step receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.

### Ask your agent

Question: A job offer quotes $5,000 biweekly pay. What is the take-home pay for a single filer in tax year 2026?
Run the AINumbers MCP tool `run_chain` with {"chain":"paycheck-take-home-check"} and read `art-339-compute-gross-to-net.net_pay`.
Re-run with `inputs` for `art-339-compute-gross-to-net`, reusing the values that result echoed, with `gross_wages_per_period` set to 6000. Compare the same field.
Verify: call `verify_execution_hash` (https://mcp.ainumbers.co/mcp) with `claimed_hash` set to `composite_execution_hash` and the full `composite_artifact`.
Ledger, for a human re-check: https://ledger.ainumbers.co/
PII rule: send synthetic or anonymised inputs only. The MCP server runs these kernels and logs no payloads.
Chain page: https://ainumbers.co/chaingraph/chains/paycheck-take-home-check.html
