# Loan Servicing Audit

Three independent recomputations over one loan's servicing math. Step 1 builds the period-by-period amortization schedule from the caller-declared note terms (art-332). Step 2 recomputes how a single borrower payment cascades under the caller-declared bucket application order and diffs the per-bucket split against the servicer's applied amounts (art-664). Step 3 runs the aggregate escrow analysis over the declared starting balance, monthly deposit and projected disbursement schedule, classifying the account as balanced, short, deficient or in surplus with the corresponding remedy (art-342). Each step computes from its own declared inputs; the order is analytical, not a statutory sequence.

- Page: https://ainumbers.co/chaingraph/chains/servicing-audit.html
- Markdown twin: https://ainumbers.co/chaingraph/chains/servicing-audit.md

## Workflow chain: Loan Servicing Audit

Three independent recomputations over one loan's servicing math. Step 1 builds the period-by-period amortization schedule from the caller-declared note terms (art-332). Step 2 recomputes how a single borrower payment cascades under the caller-declared bucket application order and diffs the per-bucket split against the servicer's applied amounts (art-664). Step 3 runs the aggregate escrow analysis over the declared starting balance, monthly deposit and projected disbursement schedule, classifying the account as balanced, short, deficient or in surplus with the corresponding remedy (art-342). Each step computes from its own declared inputs; the order is analytical, not a statutory sequence.

Domain: Consumer Lending & Fair Lending

### Steps

1. art-332-build-amortization-schedule
   Builds the period-by-period amortization schedule and totals from the caller-declared note terms, with a schedule_digest over the result. Stage 1 of 3.
2. art-664-loan-servicing-waterfall-recompute
   Recomputes how one payment cascades under the declared application order and diffs the per-bucket split against the servicer's applied amounts, returning a MATCHES or DIVERGES verdict with per-bucket deltas, or INDETERMINATE naming a missing field. Stage 2 of 3.
3. art-342-compute-escrow-analysis
   Runs the aggregate escrow analysis over the declared balances, deposits and disbursements, classifying the account and naming the spread or refund remedy. Final stage.

### Chain verify

Run the workflow through the MCP server (run_chain at https://mcp.ainumbers.co/mcp) and check each step receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.

### Ask your agent

Question: The servicer applied this month's payment and says escrow is fine. Does an independent recompute of the split and the aggregate escrow position agree before we post the cycle?
Run the AINumbers MCP tool `run_chain` with {"chain":"servicing-audit"} and read `art-664-loan-servicing-waterfall-recompute.verdict`.
Re-run with `inputs` for `art-664-loan-servicing-waterfall-recompute`, reusing the values that result echoed, with `payment_amount` set to 9000. Compare the same field.
Verify: call `verify_execution_hash` (https://mcp.ainumbers.co/mcp) with `claimed_hash` set to `composite_execution_hash` and the full `composite_artifact`.
Ledger, for a human re-check: https://ledger.ainumbers.co/
PII rule: send synthetic or anonymised inputs only. The MCP server runs these kernels and logs no payloads.
Chain page: https://ainumbers.co/chaingraph/chains/servicing-audit.html
