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
