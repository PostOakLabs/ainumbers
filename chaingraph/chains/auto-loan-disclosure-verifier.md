# Auto-Loan Disclosure Verifier

Two-step chain. Step 1 rebuilds the auto-loan amortization schedule from amount financed, rate, and term. Step 2 checks the disclosed Amount Financed, Finance Charge, and Total of Payments against the recomputed totals under 12 CFR 1026.18. Tolerance follows 12 CFR 1026.18(d)(2): $5 when the amount financed is $1,000 or less, $10 when it is more than $1,000. APR is not checked in v1. Dealer participation is a self-declared assertion, not a detected finding. Federal TILA math only; not legal advice and not a discrimination finding.

- Page: https://ainumbers.co/chaingraph/chains/auto-loan-disclosure-verifier.html
- Markdown twin: https://ainumbers.co/chaingraph/chains/auto-loan-disclosure-verifier.md

## Workflow chain: Auto-Loan Disclosure Verifier

Two-step chain. Step 1 rebuilds the auto-loan amortization schedule from amount financed, rate, and term. Step 2 checks the disclosed Amount Financed, Finance Charge, and Total of Payments against the recomputed totals under 12 CFR 1026.18. Tolerance follows 12 CFR 1026.18(d)(2): $5 when the amount financed is $1,000 or less, $10 when it is more than $1,000. APR is not checked in v1. Dealer participation is a self-declared assertion, not a detected finding. Federal TILA math only; not legal advice and not a discrimination finding.

Domain: Consumer Lending & Fair Lending

### Steps

1. art-332-build-amortization-schedule
   Rebuilds the level-payment amortization schedule from the contract terms; totals and schedule digest are cited at step 2.
2. art-404-check-retail-installment-disclosures
   Checks the disclosed Amount Financed, Finance Charge, and Total of Payments against the step-1 totals and digest. Final stage.

### Chain verify

Run the workflow through the MCP server (run_chain at https://mcp.ainumbers.co/mcp) and check each step receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.

### Ask your agent

Question: What is the finance charge on a $28,000 auto loan at 9.9% for 72 months, and how does it move if the amount financed is $30,000?
Run the AINumbers MCP tool `run_chain` with {"chain":"auto-loan-disclosure-verifier"} and read `art-332-build-amortization-schedule.totals.total_interest`.
Re-run with `inputs` for `art-332-build-amortization-schedule`, reusing the values that result echoed, with `loan_amount` set to 30000. Compare the same field.
Verify: call `verify_execution_hash` (https://mcp.ainumbers.co/mcp) with `claimed_hash` set to `composite_execution_hash` and the full `composite_artifact`.
Ledger, for a human re-check: https://ledger.ainumbers.co/
PII rule: send synthetic or anonymised inputs only. The MCP server runs these kernels and logs no payloads.
Chain page: https://ainumbers.co/chaingraph/chains/auto-loan-disclosure-verifier.html
