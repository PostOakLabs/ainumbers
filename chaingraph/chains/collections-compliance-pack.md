# Collections Compliance Pack

Linear two-step chain for debt-collection compliance review. Step 1 checks a declared call log against the Regulation F 12 CFR 1006.14(b) 7-in-7 and post-conversation quiet-period rebuttable presumptions. Step 2 checks a debt-validation-notice content-element checklist against 12 CFR 1006.34 / Model Form B-1 and computes the 30-day response-period math. Both presumption and completeness checks are over DECLARED inputs - neither determines that harassment occurred or that a notice's disclosed amounts are accurate.

- Page: https://ainumbers.co/chaingraph/chains/collections-compliance-pack.html
- Markdown twin: https://ainumbers.co/chaingraph/chains/collections-compliance-pack.md

## Workflow chain: Collections Compliance Pack

Linear two-step chain for debt-collection compliance review. Step 1 checks a declared call log against the Regulation F 12 CFR 1006.14(b) 7-in-7 and post-conversation quiet-period rebuttable presumptions. Step 2 checks a debt-validation-notice content-element checklist against 12 CFR 1006.34 / Model Form B-1 and computes the 30-day response-period math. Both presumption and completeness checks are over DECLARED inputs - neither determines that harassment occurred or that a notice's disclosed amounts are accurate.

Domain: Consumer Lending & Fair Lending

### Steps

1. art-402-validate-regf-call-frequency
   Per-debt 7-in-7 and quiet-period presumption findings. Independent of Step 2's notice-completeness check - both run against the same declared debt collection file.
2. art-403-check-debt-validation-notice
   Validation-notice element completeness grade and 30-day response-period math, completing the collections compliance review.

### Chain verify

Run the workflow through the MCP server (run_chain at https://mcp.ainumbers.co/mcp) and check each step receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.

### Ask your agent

Question: Our dialer placed a call each day for a week on one debt. Does the log trip the seven-in-seven frequency presumption?
Run the AINumbers MCP tool `run_chain` with {"chain":"collections-compliance-pack"} and read `art-402-validate-regf-call-frequency.debts_with_seven_in_seven_presumption`.
Re-run with `inputs` for `art-402-validate-regf-call-frequency`, reusing the values that result echoed, with `inputs` changed so an eighth call lands on 2026-07-07. Compare the same field.
Verify: call `verify_execution_hash` (https://mcp.ainumbers.co/mcp) with `claimed_hash` set to `composite_execution_hash` and the full `composite_artifact`.
Ledger, for a human re-check: https://ledger.ainumbers.co/
PII rule: send synthetic or anonymised inputs only. The MCP server runs these kernels and logs no payloads.
Chain page: https://ainumbers.co/chaingraph/chains/collections-compliance-pack.html
