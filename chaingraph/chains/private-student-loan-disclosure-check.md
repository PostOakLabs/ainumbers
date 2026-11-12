# Private Student Loan Disclosure Check

Three-step chain. Step 1 rebuilds the private student loan amortization schedule from loan amount, rate, and term. Step 2 checks the lender's disclosure packet across the three 12 CFR 1026.46-48 stages, HEOA self-certification presence, and the 3-business-day rescission window. Step 1 payment amount, totals, and execution hash are cited for manual comparison against the disclosed estimated total cost and repayment schedule; the checker does not read the lender's figures. Federal math only; not legal advice.

- Page: https://ainumbers.co/chaingraph/chains/private-student-loan-disclosure-check.html
- Markdown twin: https://ainumbers.co/chaingraph/chains/private-student-loan-disclosure-check.md

## Workflow chain: Private Student Loan Disclosure Check

Three-step chain. Step 1 rebuilds the private student loan amortization schedule from loan amount, rate, and term. Step 2 checks the lender's disclosure packet across the three 12 CFR 1026.46-48 stages, HEOA self-certification presence, and the 3-business-day rescission window. Step 1 payment amount, totals, and execution hash are cited for manual comparison against the disclosed estimated total cost and repayment schedule; the checker does not read the lender's figures. Federal math only; not legal advice.

Domain: Consumer Lending & Fair Lending

### Steps

1. art-332-build-amortization-schedule
   Rebuilds the level-payment amortization schedule from the loan terms; payment amount, totals, and execution hash are cited for manual comparison at step 2.
2. art-405-check-private-student-loan-disclosures
   Checks the disclosure packet across the three 12 CFR 1026.46-48 stages, HEOA self-certification presence, and the 3-business-day rescission window; step-1 totals are compared manually against the disclosed figures.
3. cry-05-agent-action-audit-trail-aggregator
   Produces session_receipt_root, the Merkle root over the run's execution_hashes (final stage)

### Chain verify

Run the workflow through the MCP server (run_chain at https://mcp.ainumbers.co/mcp) and check each step receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.

### Ask your agent

Question: What is the total interest on a $25,000 private student loan at 9% for 120 months, and how does it move if the loan amount is $30,000?
Run the AINumbers MCP tool `run_chain` with {"chain":"private-student-loan-disclosure-check"} and read `art-332-build-amortization-schedule.totals.total_interest`.
Re-run with `inputs` for `art-332-build-amortization-schedule`, reusing the values that result echoed, with `loan_amount` set to 30000. Compare the same field.
Verify: call `verify_execution_hash` (https://mcp.ainumbers.co/mcp) with `claimed_hash` set to `composite_execution_hash` and the full `composite_artifact`.
Ledger, for a human re-check: https://ledger.ainumbers.co/
PII rule: send synthetic or anonymised inputs only. The MCP server runs these kernels and logs no payloads.
Chain page: https://ainumbers.co/chaingraph/chains/private-student-loan-disclosure-check.html
