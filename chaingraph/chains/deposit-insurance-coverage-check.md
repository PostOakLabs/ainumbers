# Deposit Insurance Coverage Check

Three-stage check over a bank's own deposit insurance numbers. Step 1 computes insured and uninsured minor-unit amounts per ownership right and capacity group against the caller-supplied SMDIA, reporting records that cannot be calculated as undeterminable and naming the missing field (ART-507). Step 2 validates the shape of the institution's own part 370 output file and ties its declared totals to the step 1 recompute, reporting a shape defect and a totals mismatch as separate findings (ART-535). Step 3 produces a session receipt aggregating the run's execution hashes (CRY-05). The output file is the caller's own; the coverage limit is a caller-supplied input and is never assumed. The verdict is an arithmetic and shape finding, never a determination by the FDIC, not a filing, and no deposit insurance advice.

- Page: https://ainumbers.co/chaingraph/chains/deposit-insurance-coverage-check.html
- Markdown twin: https://ainumbers.co/chaingraph/chains/deposit-insurance-coverage-check.md

## Workflow chain: Deposit Insurance Coverage Check

Three-stage check over a bank's own deposit insurance numbers. Step 1 computes insured and uninsured minor-unit amounts per ownership right and capacity group against the caller-supplied SMDIA, reporting records that cannot be calculated as undeterminable and naming the missing field (ART-507). Step 2 validates the shape of the institution's own part 370 output file and ties its declared totals to the step 1 recompute, reporting a shape defect and a totals mismatch as separate findings (ART-535). Step 3 produces a session receipt aggregating the run's execution hashes (CRY-05). The output file is the caller's own; the coverage limit is a caller-supplied input and is never assumed. The verdict is an arithmetic and shape finding, never a determination by the FDIC, not a filing, and no deposit insurance advice.

Domain: Consumer & Wealth Compliance

### Steps

1. art-507-determine-deposit-insurance-coverage
   Computes insured and uninsured minor-unit amounts per ownership right and capacity group against the caller-supplied SMDIA, with records that cannot be calculated reported undeterminable naming the missing field; that recompute is what step 2 ties against. Stage 1 of 3.
2. art-535-fdic370-output-file-validator
   Validates the shape of the institution's own part 370 output file and ties its declared totals to the step 1 recompute, reporting file structure errors and totals mismatches as separate findings with a gate policy verdict; the validated run's execution hashes are what step 3 aggregates. Stage 2 of 3.
3. cry-05-agent-action-audit-trail-aggregator
   Produces session_receipt_root, the Merkle root over the run's execution_hashes (final stage).

### Chain verify

Run the workflow through the MCP server (run_chain at https://mcp.ainumbers.co/mcp) and check each step receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.

### Ask your agent

Question: Our part 370 output file is ready. Does its shape pass, and do its declared totals tie to our coverage recompute?
Run the AINumbers MCP tool `run_chain` with {"chain":"deposit-insurance-coverage-check"} and read `art-535-fdic370-output-file-validator.decision.gate_policy`.
Re-run with `inputs` for `art-535-fdic370-output-file-validator`, reusing the values that result echoed, with `file_records` changed so change one declared insured minor-unit total so it no longer ties to the supplied art-507 recompute. Compare the same field.
Verify: call `verify_execution_hash` (https://mcp.ainumbers.co/mcp) with `claimed_hash` set to `composite_execution_hash` and the full `composite_artifact`.
Ledger, for a human re-check: https://ledger.ainumbers.co/
PII rule: send synthetic or anonymised inputs only. The MCP server runs these kernels and logs no payloads.
Chain page: https://ainumbers.co/chaingraph/chains/deposit-insurance-coverage-check.html
