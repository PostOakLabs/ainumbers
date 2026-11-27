# Amortization Schedule to Actuarial APR Check

Three-step chain. Step 1 rebuilds the amortization schedule from loan amount, note rate, and term, for level-payment, ARM, interest-only, balloon, and temporary-buydown structures, and for a payment derived from the note rate. Step 2 computes the actuarial annual percentage rate and finance charge from that schedule under 12 CFR 1026 Appendix J. Step 3 is the receipt step only. Step 1 matters for non-level schedules, where the payment stream is irregular and must be built before any rate is solved; for a level-payment loan, step 2 alone suffices, since its advances and payments are already a regular stream. This chain makes NO disclosed-APR comparison and NO section 1026.22(a) tolerance claim: step 2 emits no tolerance, and art-217-trid-apr-accuracy, which carries tolerance, is not in this chain. The finance charge equals total interest only when the schedule fully amortizes, with ending balance zero; for a balloon schedule the finance charge differs by the ending balance. The actuarial APR is a Regulation Z computation, not a GAAP ASC 470 effective interest rate, and fees and costs enter it only if they are in the payment stream. Art-332 has no fee input: its advances are one amount equal to the full loan amount, so the amount financed in step 2 is the full loan amount. Prepaid finance charges, including points and origination fees, are not modelled. The APR from this chain is therefore not the Regulation Z disclosed APR when such fees exist; for an ordinary loan it is close to the note rate. Compare this APR to a disclosed APR only for fee-free loans. Federal math only; not legal advice and not tax or accounting advice.

- Page: https://ainumbers.co/chaingraph/chains/amortization-schedule-to-actuarial-apr-check.html
- Markdown twin: https://ainumbers.co/chaingraph/chains/amortization-schedule-to-actuarial-apr-check.md

## Workflow chain: Amortization Schedule to Actuarial APR Check

Three-step chain. Step 1 rebuilds the amortization schedule from loan amount, note rate, and term, for level-payment, ARM, interest-only, balloon, and temporary-buydown structures, and for a payment derived from the note rate. Step 2 computes the actuarial annual percentage rate and finance charge from that schedule under 12 CFR 1026 Appendix J. Step 3 is the receipt step only. Step 1 matters for non-level schedules, where the payment stream is irregular and must be built before any rate is solved; for a level-payment loan, step 2 alone suffices, since its advances and payments are already a regular stream. This chain makes NO disclosed-APR comparison and NO section 1026.22(a) tolerance claim: step 2 emits no tolerance, and art-217-trid-apr-accuracy, which carries tolerance, is not in this chain. The finance charge equals total interest only when the schedule fully amortizes, with ending balance zero; for a balloon schedule the finance charge differs by the ending balance. The actuarial APR is a Regulation Z computation, not a GAAP ASC 470 effective interest rate, and fees and costs enter it only if they are in the payment stream. Art-332 has no fee input: its advances are one amount equal to the full loan amount, so the amount financed in step 2 is the full loan amount. Prepaid finance charges, including points and origination fees, are not modelled. The APR from this chain is therefore not the Regulation Z disclosed APR when such fees exist; for an ordinary loan it is close to the note rate. Compare this APR to a disclosed APR only for fee-free loans. Federal math only; not legal advice and not tax or accounting advice.

Domain: Consumer Lending & Fair Lending

### Steps

1. art-332-build-amortization-schedule
   Schedule build from loan amount, note rate, and term. Output fields: advances[] and payments[], each element with amount and periods_from_consummation, plus schedule[] and totals. Step 2 input fields are the same advances[] and payments[] arrays, read unchanged.
2. art-215-reg-z-appendix-j-apr
   Actuarial APR solve from advances[] and payments[], each element with amount and periods_from_consummation, read unchanged. Output fields: apr_pct, periodic_rate, finance_charge, advance_total, payment_total. No disclosed-APR comparison; no tolerance output.
3. cry-05-agent-action-audit-trail-aggregator
   Receipt step: session_receipt_root, the Merkle root over the run's execution_hashes (final stage). Receipt only; no computation.

### Chain verify

Run the workflow through the MCP server (run_chain at https://mcp.ainumbers.co/mcp) and check each step receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.

### Ask your agent

Question: What is the total interest and actuarial APR on a fee-free $28,000 loan at 9.9% for 72 months, and how does the schedule move if the loan amount is $30,000?
Run the AINumbers MCP tool `run_chain` with {"chain":"amortization-schedule-to-actuarial-apr-check"} and read `art-332-build-amortization-schedule.totals.total_interest`.
Re-run with `inputs` for `art-332-build-amortization-schedule`, reusing the values that result echoed, with `loan_amount` set to 30000. Compare the same field.
Verify: call `verify_execution_hash` (https://mcp.ainumbers.co/mcp) with `claimed_hash` set to `composite_execution_hash` and the full `composite_artifact`.
Ledger, for a human re-check: https://ledger.ainumbers.co/
PII rule: send synthetic or anonymised inputs only. The MCP server runs these kernels and logs no payloads.
Chain page: https://ainumbers.co/chaingraph/chains/amortization-schedule-to-actuarial-apr-check.html
