# Escrow Statement Check

Audit a mortgage servicer's escrow accounting statement from the borrower's side, line by line: recompute the aggregate-accounting trial running balance month by month from the stated opening balance, monthly escrow deposits, and disbursements; diff the servicer's stated end-of-month balances against the recomputation, flagging each discrepant line; check the stated cushion against the one-sixth cap; and classify the account as balanced, shortage, surplus, or deficiency (732), then a session receipt aggregating the run's execution hashes (CRY-05). This checks the borrower-side statement, distinct from the servicer-side servicing-audit chain. Numeric values only, never identifiers; a divergence is an arithmetic finding, never a legal determination. Not legal advice.

- Page: https://ainumbers.co/chaingraph/chains/escrow-statement-check.html
- Markdown twin: https://ainumbers.co/chaingraph/chains/escrow-statement-check.md

## Workflow chain: Escrow Statement Check

Audit a mortgage servicer's escrow accounting statement from the borrower's side, line by line: recompute the aggregate-accounting trial running balance month by month from the stated opening balance, monthly escrow deposits, and disbursements; diff the servicer's stated end-of-month balances against the recomputation, flagging each discrepant line; check the stated cushion against the one-sixth cap; and classify the account as balanced, shortage, surplus, or deficiency (732), then a session receipt aggregating the run's execution hashes (CRY-05). This checks the borrower-side statement, distinct from the servicer-side servicing-audit chain. Numeric values only, never identifiers; a divergence is an arithmetic finding, never a legal determination. Not legal advice.

Domain: Consumer Lending & Fair Lending

### Steps

1. 732-borrower-escrow-auditor
   Recomputes the aggregate-accounting trial running balance month by month from the stated opening balance, monthly escrow deposits, and disbursements; the servicer's stated end-of-month balances are diffed line by line against the recomputation with each discrepant line flagged, the stated cushion is checked against the one-sixth cap, and the account is classified as balanced, shortage, surplus, or deficiency
2. cry-05-agent-action-audit-trail-aggregator
   Produces session_receipt_root, the Merkle root over the run's execution_hashes (final stage)

### Chain verify

Run the workflow through the MCP server (run_chain at https://mcp.ainumbers.co/mcp) and check each step receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.

### Ask your agent

Question: My servicer's annual escrow statement raised my payment. Is the statement's math right?
Run the AINumbers MCP tool `run_chain` with {"chain":"escrow-statement-check"} and read `732-borrower-escrow-auditor.account_status`.
Re-run with `inputs` for `732-borrower-escrow-auditor`, reusing the values that result echoed, with `stated_cushion` set to 300. Compare the same field.
Verify: call `verify_execution_hash` (https://mcp.ainumbers.co/mcp) with `claimed_hash` set to `composite_execution_hash` and the full `composite_artifact`.
Ledger, for a human re-check: https://ledger.ainumbers.co/
PII rule: send synthetic or anonymised inputs only. The MCP server runs these kernels and logs no payloads.
Chain page: https://ainumbers.co/chaingraph/chains/escrow-statement-check.html
