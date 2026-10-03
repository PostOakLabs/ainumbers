# Life Illustration Self-Support Test

Linear two-step chain for life insurance illustration compliance and insurer capital review. Step 1 runs the NAIC Model 582 §8C self-support test (year 15 and year 20) and §8D lapse-support check per ASOP 24 - certifies the illustration is not lapse-supported and maintains a non-negative account value. Step 2 computes the RBC action level for the issuing insurer to confirm adequate capital supports the product offering. ZERO PII BY CONSTRUCTION.

- Page: https://ainumbers.co/chaingraph/chains/life-illustration-self-support-test.html
- Markdown twin: https://ainumbers.co/chaingraph/chains/life-illustration-self-support-test.md

## Workflow chain: Life Illustration Self-Support Test

Linear two-step chain for life insurance illustration compliance and insurer capital review. Step 1 runs the NAIC Model 582 §8C self-support test (year 15 and year 20) and §8D lapse-support check per ASOP 24 - certifies the illustration is not lapse-supported and maintains a non-negative account value. Step 2 computes the RBC action level for the issuing insurer to confirm adequate capital supports the product offering. ZERO PII BY CONSTRUCTION.

Domain: Insurance & Reinsurance

### Steps

1. art-253-run-illustration-selfsupport-test
   Illustration validity: self_support_pass (yr15+yr20), lapse_support_flag, and issues list. Passes to RBC capital review.
2. art-254-compute-rbc-action-level
   RBC action level classification (NO_ACTION / COMPANY_ACTION / REGULATORY_ACTION / AUTHORIZED_CONTROL / MANDATORY_CONTROL). Final stage.

### Chain verify

Run the workflow through the MCP server (run_chain at https://mcp.ainumbers.co/mcp) and check each step receipt's execution hash against the ledger at https://ledger.ainumbers.co/. Use synthetic inputs only; never send real personal data.

### Ask your agent

Question: Before the illustration goes to the applicant, does the policy stay self-supporting through year 20?
Run the AINumbers MCP tool `run_chain` with {"chain":"life-illustration-self-support-test"} and read `art-253-run-illustration-selfsupport-test.self_support_pass`.
Re-run with `inputs` for `art-253-run-illustration-selfsupport-test`, reusing the values that result echoed, with `account_values` changed so the year-20 account value is below zero. Compare the same field.
Verify: call `verify_execution_hash` (https://mcp.ainumbers.co/mcp) with `claimed_hash` set to `composite_execution_hash` and the full `composite_artifact`.
Ledger, for a human re-check: https://ledger.ainumbers.co/
PII rule: send synthetic or anonymised inputs only. The MCP server runs these kernels and logs no payloads.
Chain page: https://ainumbers.co/chaingraph/chains/life-illustration-self-support-test.html
