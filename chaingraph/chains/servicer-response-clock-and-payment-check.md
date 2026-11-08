# Servicer Response Clock and Payment Check

Check how a mortgage servicer handled an account in three stages: first compute the Regulation X response and action clocks for error notices, information requests, and loss-mitigation applications, with due dates and clock states from the event dates (733), then recompute how one payment was applied across escrow, fee, interest, and principal buckets under the note's declared application order, with verdict MATCHES, DIVERGES, or INDETERMINATE (ART-664), then a session receipt aggregating the run's execution hashes (CRY-05). Event dates, loan values, bucket balances, and the application order are caller-supplied inputs; a missed clock or a divergence is an arithmetic and sequence finding, never a legal determination. Not legal advice.

- Page: https://ainumbers.co/chaingraph/chains/servicer-response-clock-and-payment-check.html
- Markdown twin: https://ainumbers.co/chaingraph/chains/servicer-response-clock-and-payment-check.md

## Workflow chain: Servicer Response Clock and Payment Check

Check how a mortgage servicer handled an account in three stages: first compute the Regulation X response and action clocks for error notices, information requests, and loss-mitigation applications, with due dates and clock states from the event dates (733), then recompute how one payment was applied across escrow, fee, interest, and principal buckets under the note's declared application order, with verdict MATCHES, DIVERGES, or INDETERMINATE (ART-664), then a session receipt aggregating the run's execution hashes (CRY-05). Event dates, loan values, bucket balances, and the application order are caller-supplied inputs; a missed clock or a divergence is an arithmetic and sequence finding, never a legal determination. Not legal advice.

Domain: Consumer Lending & Fair Lending

### Steps

1. 733-servicing-compliance-clock
   Computes servicer-compliance due dates and clock states from event dates and loan values: error-resolution and information-request clocks, loss-mitigation acknowledgment and evaluation, the 120-day pre-foreclosure bar, payment-crediting and payoff-statement deadlines, each obligation with its Regulation X paragraph citation
2. art-664-loan-servicing-waterfall-recompute
   Recomputes how a single payment applies across escrow, fee, interest, and principal buckets under the note's caller-declared application order and diffs the recomputed per-bucket breakdown against the core's actual applied amounts, with verdict MATCHES, DIVERGES, or INDETERMINATE
3. cry-05-agent-action-audit-trail-aggregator
   Produces session_receipt_root, the Merkle root over the run's execution_hashes (final stage)

### Chain verify

Run the workflow through the MCP server (run_chain at https://mcp.ainumbers.co/mcp) and check each step receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.

### Ask your agent

Question: My servicer applied my monthly payment, but escrow got more and principal less than the note's order says. Was the payment applied correctly?
Run the AINumbers MCP tool `run_chain` with {"chain":"servicer-response-clock-and-payment-check"} and read `art-664-loan-servicing-waterfall-recompute.verdict`.
Re-run with `inputs` for `art-664-loan-servicing-waterfall-recompute`, reusing the values that result echoed, with `payment_amount` set to 1850. Compare the same field.
Verify: call `verify_execution_hash` (https://mcp.ainumbers.co/mcp) with `claimed_hash` set to `composite_execution_hash` and the full `composite_artifact`.
Ledger, for a human re-check: https://ledger.ainumbers.co/
PII rule: send synthetic or anonymised inputs only. The MCP server runs these kernels and logs no payloads.
Chain page: https://ainumbers.co/chaingraph/chains/servicer-response-clock-and-payment-check.html
