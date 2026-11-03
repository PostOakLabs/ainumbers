# MLA MAPR Cashflow Check

Recompute a closed-end loan's Military Annual Percentage Rate from the borrower's actual cash flows and charges in two stages: first recompute the MAPR by the Regulation Z actuarial method over the 32 CFR 232.4(c)(1) charge set and compare it with the 36 percent cap in 232.4(b) (ART-616), then a session receipt aggregating the run's execution hashes (CRY-05). Advances, payments, timings, and charges are caller-supplied inputs; bona fide fee and application-fee exception questions are surfaced for manual review, never decided. The result is an arithmetic recompute, never a legal determination and never a covered-borrower determination. Not legal advice.

- Page: https://ainumbers.co/chaingraph/chains/mla-mapr-cashflow-check.html
- Markdown twin: https://ainumbers.co/chaingraph/chains/mla-mapr-cashflow-check.md

## Workflow chain: MLA MAPR Cashflow Check

Recompute a closed-end loan's Military Annual Percentage Rate from the borrower's actual cash flows and charges in two stages: first recompute the MAPR by the Regulation Z actuarial method over the 32 CFR 232.4(c)(1) charge set and compare it with the 36 percent cap in 232.4(b) (ART-616), then a session receipt aggregating the run's execution hashes (CRY-05). Advances, payments, timings, and charges are caller-supplied inputs; bona fide fee and application-fee exception questions are surfaced for manual review, never decided. The result is an arithmetic recompute, never a legal determination and never a covered-borrower determination. Not legal advice.

Domain: Consumer Lending & Fair Lending

### Steps

1. art-616-mla-mapr-actuarial-recompute
   Recomputes a closed-end loan's Military Annual Percentage Rate from caller-supplied advances, payments, and charges by the Regulation Z actuarial method over the 32 CFR 232.4(c)(1) charge set; classifies each charge with its paragraph citation; compares the recomputed rate with the 36 percent cap in 232.4(b); surfaces bona fide fee and application-fee exception questions for manual review
2. cry-05-agent-action-audit-trail-aggregator
   Produces session_receipt_root, the Merkle root over the run's execution_hashes (final stage)

### Chain verify

Run the workflow through the MCP server (run_chain at https://mcp.ainumbers.co/mcp) and check each step receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.

### Ask your agent

Question: My lender says my MAPR is 34 percent, but the fees look high. From my actual advances and payments, is it over the 36 percent cap?
Run the AINumbers MCP tool `run_chain` with {"chain":"mla-mapr-cashflow-check"} and read `art-616-mla-mapr-actuarial-recompute.exceeds_cap`.
Re-run with `inputs` for `art-616-mla-mapr-actuarial-recompute`, reusing the values that result echoed, with `payment_amount` set to 1050. Compare the same field.
Verify: call `verify_execution_hash` (https://mcp.ainumbers.co/mcp) with `claimed_hash` set to `composite_execution_hash` and the full `composite_artifact`.
Ledger, for a human re-check: https://ledger.ainumbers.co/
PII rule: send synthetic or anonymised inputs only. The MCP server runs these kernels and logs no payloads.
Chain page: https://ainumbers.co/chaingraph/chains/mla-mapr-cashflow-check.html
